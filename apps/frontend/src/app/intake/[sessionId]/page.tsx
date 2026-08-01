'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSessionStore } from '@/stores/session-store';
import { useFaceStore } from '@/stores/face-store';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useFaceEmbedding } from '@/hooks/useFaceEmbedding';
import { useLivenessDetection } from '@/hooks/useLivenessDetection';
import { useIntakeConversation } from '@/hooks/useIntakeConversation';
import { useMobileDetection } from '@/hooks/useMobileDetection';
import { useLanguage } from '@/hooks/useLanguage';
import { socketService } from '@/services/socket';
import { cn } from '@/lib/utils';
import { DarkModeToggle } from '@/components/ui/dark-mode-toggle';
import { LanguageSelector } from '@/components/ui/language-selector';
import { TranscriptView } from '@/components/intake/transcript-view';
import { VoiceInput } from '@/components/intake/VoiceInput';
import { FaceDetectionCanvas } from '@/components/face/FaceDetectionCanvas';
import { FaceRegistrationDialog } from '@/components/face/FaceRegistrationDialog';
import { BriefCard } from '@/components/intake/brief-card';
import { CameraSelector } from '@/components/camera/CameraSelector';

type IntakePhase = 'camera' | 'detecting' | 'intake' | 'brief' | 'complete';

export default function IntakeSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const mobileInfo = useMobileDetection();
  const { locale, setLocale } = useLanguage();
  const {
    videoRef,
    isActive,
    startCamera,
    stopCamera,
    currentFacingMode,
    toggleCamera,
    devices,
    hasMultipleCameras: _hasMultipleCameras,
    error: cameraError,
  } = useCamera({
    facingMode: mobileInfo.isMobile ? 'environment' : 'user',
    isMobile: mobileInfo.isMobile,
  });

  const session = useSessionStore();
  const face = useFaceStore();

  const [phase, setPhase] = useState<IntakePhase>('camera');
  const [showRegistration, setShowRegistration] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState({
    width: 640,
    height: 480,
  });
  const registrationAttemptedRef = useRef(false);
  const conversationStartedRef = useRef(false);

  // ─── AI Intake Conversation ─────────────────────────────────────
  const conversation = useIntakeConversation(sessionId);

  // Sync conversation thinking state to the global store
  useEffect(() => {
    session.setIsAiThinking(conversation.isAiThinking);
  }, [conversation.isAiThinking]);

  // ─── MediaPipe Face Detection ────────────────────────────────
  const {
    result: detectionResult,
    isLoading: mpLoading,
    error: mpError,
    isFaceDetected,
    fps,
    startDetection,
    stopDetection,
  } = useFaceDetection({
    numFaces: 1,
    outputBlendshapes: false,
    outputFaceMatrix: false,
    autoStart: true,
    useCPUDelegate: mobileInfo.hasLimitedGPU,
  });

  // ─── Face Embedding & Identity Search ────────────────────────
  const {
    embedding,
    matchResult: _matchResult,
    isSearching: isSearchingEmbedding,
    error: _embeddingError,
    searchIdentity,
    generateFromLandmarks,
    registerEmbedding: _registerEmbedding,
    reset: _resetEmbedding,
  } = useFaceEmbedding();

  // ─── Liveness Detection ──────────────────────────────────────
  const {
    status: livenessStatus,
    blinkCount,
    ear: _ear,
    isAlive,
    startChallenge,
    processFrame: processLivenessFrame,
    reset: _resetLiveness,
  } = useLivenessDetection({
    requiredBlinks: 2,
    challengeTimeoutMs: 8000,
  });

  // Sync detection results to the face store
  useEffect(() => {
    if (detectionResult) {
      face.setFaces([
        {
          id: 'face-0',
          box: { x: 0, y: 0, width: 1, height: 1 },
          landmarks: detectionResult.landmarks,
          confidence: isFaceDetected ? 0.95 : 0,
        },
      ]);
      face.setFps(fps);

      // Process liveness on each frame
      processLivenessFrame(detectionResult.landmarks);
    } else {
      face.setFaces([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectionResult, isFaceDetected, fps]);

  // When camera becomes active, wire up MediaPipe detection
  useEffect(() => {
    if (isActive && videoRef.current) {
      startDetection(videoRef.current);
      face.setStatus('detecting');
      setPhase('detecting');

      // Store video dimensions for the canvas overlay
      setVideoDimensions({
        width: videoRef.current.videoWidth || 640,
        height: videoRef.current.videoHeight || 480,
      });

      // Auto-start liveness challenge
      setTimeout(() => startChallenge(), 1000);
    } else {
      stopDetection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // ─── Identity Search (when face is stable and liveness verified) ───
  useEffect(() => {
    if (isAlive && detectionResult && isFaceDetected && !registrationAttemptedRef.current) {
      registrationAttemptedRef.current = true;

      const runIdentitySearch = async () => {
        try {
          const result = await searchIdentity(detectionResult.landmarks);

          if (result.isNewPatient) {
            // No match — show registration dialog
            setShowRegistration(true);
          } else {
            // Match found!
            face.setStatus('matched');
            face.setMatchResult(result);
            session.setFaceMatched(true);
            session.setStatus('face_matched');

            // Fetch patient details
            try {
              await import('@/services/api').then((m) =>
                m.dashboardApi.getLatestBrief(result.patientId),
              );
              session.setPatient({
                id: result.patientId,
                name: result.patientName ?? 'Patient',
                dob: '',
                mobile: '',
              });
            } catch {
              // Patient found in Qdrant but not yet in intake records
              session.setPatient({
                id: result.patientId,
                name: result.patientName ?? 'Returning Patient',
                dob: '',
                mobile: '',
              });
            }

            // Notify through WebSocket
            socketService.joinSession(sessionId);

            // Auto-start the AI intake conversation
            if (!conversationStartedRef.current) {
              conversationStartedRef.current = true;
              conversation.startConversation(result.patientName ?? 'Patient', result.patientId, locale);
            }
            setPhase('intake');

            // Generate and store embedding for future matches
            const emb = generateFromLandmarks(detectionResult.landmarks);
            face.setEmbedding(emb);
          }
        } catch (err) {
          console.error('Identity search failed:', err);
          face.setError('Face identification failed. Please try again.');
          registrationAttemptedRef.current = false;
        }
      };

      runIdentitySearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAlive, isFaceDetected, detectionResult]);

  useEffect(() => {
    const unsubStatus = socketService.onSessionStatus((data) => {
      const statusData = data as { status?: string };
      session.setStatus((statusData.status ?? 'idle') as never);
    });

    const unsubBrief = socketService.onBriefReady((data) => {
      session.setBrief({ id: data.briefId });
      setPhase('brief');
    });

    return () => {
      unsubStatus();
      unsubBrief();
      // Reset conversation start flag on unmount to allow restart on re-entry
      conversationStartedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCompleteIntake() {
    try {
      await conversation.completeIntake();
      setPhase('brief');
    } catch {
      // Error is handled by the hook's internal toast — stay on intake phase
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* Skip link for keyboard users */}
      <a
        href="#intake-main"
        className="sr-only z-[60] focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-lg focus:bg-ayutalk-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="bg-ayutalk-500 flex h-8 w-8 items-center justify-center rounded-lg">
              <span className="text-xs font-bold text-white">AC</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900 dark:text-white">
                Intake Session
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {session.patient?.name ?? 'Unknown Patient'}
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <LanguageSelector
            currentLocale={locale}
            onLocaleChange={setLocale}
            compact
          />
          <DarkModeToggle />
          <span
            role="status"
            aria-live="polite"
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              session.status === 'intake_in_progress' &&
                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
              session.status === 'face_matched' &&
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
              session.status === 'ready' &&
                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
              session.status === 'error' &&
                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            )}
          >
            {session.status === 'idle' && 'Waiting'}
            {session.status === 'detecting' && 'Detecting Face'}
            {session.status === 'face_matched' && 'Patient Identified'}
            {session.status === 'intake_in_progress' && 'Intake in Progress'}
            {session.status === 'transcribing' && 'Generating Brief'}
            {session.status === 'ready' && 'Ready for Doctor'}
            {session.status === 'error' && 'Error'}
          </span>
        </div>
      </header>

      <main id="intake-main" className={cn('flex flex-1 gap-6 p-6', mobileInfo.isMobile && 'flex-col')}>
        {/* Left Panel — Camera + Face Detection */}
        <div className={cn('flex flex-col gap-4', mobileInfo.isMobile ? 'w-full' : 'w-[420px]')}>
          {/* Camera Feed */}
          <div className="relative overflow-hidden rounded-xl bg-black shadow-lg">
            {/* Video */}
            <video
              ref={videoRef as React.RefObject<HTMLVideoElement>}
              autoPlay
              playsInline
              muted
              aria-label="Live camera feed for face identification"
              className={cn('h-[320px] w-full object-cover', !isActive && 'hidden')}
            />

            {/* Camera Placeholder */}
            {!isActive && (
              <div className="flex h-[320px] flex-col items-center justify-center bg-slate-900 text-white">
                <svg
                  className="mb-3 h-12 w-12 text-slate-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
                <p className="text-sm text-slate-400">Camera not started</p>
              </div>
            )}

            {/* MediaPipe Face Detection Canvas Overlay */}
            {isActive && detectionResult && (
              <FaceDetectionCanvas
                landmarks={detectionResult.landmarks}
                videoWidth={videoDimensions.width}
                videoHeight={videoDimensions.height}
                isFaceDetected={isFaceDetected}
                matchColor={face.status === 'matched' ? '#22c55e' : '#0c8ee6'}
                drawLandmarks
                drawConnections
                drawBoundingBox
              />
            )}

            {/* Liveness Status Overlay */}
            {phase === 'detecting' && livenessStatus === 'waiting_for_blink' && (
              <div
                role="status"
                aria-live="polite"
                className="absolute bottom-4 left-1/2 -translate-x-1/2"
              >
                <div className="rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm">
                  <span aria-hidden="true">👁 </span>
                  Please blink naturally ({Math.max(0, 2 - blinkCount)} blinks needed)
                </div>
              </div>
            )}

            {livenessStatus === 'blink_detected' && (
              <div
                role="status"
                aria-live="polite"
                className="absolute bottom-4 left-1/2 -translate-x-1/2"
              >
                <div className="rounded-full bg-emerald-500/80 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm">
                  <span aria-hidden="true">✓ </span>
                  Blink detected!
                </div>
              </div>
            )}

            {/* Loading Overlay */}
            {phase === 'detecting' && mpLoading && (
              <div
                role="status"
                aria-live="polite"
                className="absolute inset-0 flex items-center justify-center bg-black/40"
              >
                <div className="text-center">
                  <div
                    aria-hidden="true"
                    className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white"
                  />
                  <p className="text-sm font-medium text-white">Loading face detection model...</p>
                </div>
              </div>
            )}

            {/* Status Badges */}
            {isActive && (
              <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                {face.status === 'matched' && (
                  <div className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
                    ✓ Face Matched — {Math.round(face.confidence * 100)}%
                  </div>
                )}
                {isSearchingEmbedding && (
                  <div
                    role="status"
                    className="bg-ayutalk-500/80 rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm"
                  >
                    Searching identity...
                  </div>
                )}
                {mpError && (
                  <div
                    role="alert"
                    className="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm"
                  >
                    {mpError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Camera Controls — Mobile-aware */}
          <CameraSelector
            currentFacingMode={currentFacingMode}
            devices={devices}
            isActive={isActive}
            error={cameraError}
            onToggleCamera={toggleCamera}
            onStartCamera={startCamera}
            onStopCamera={stopCamera}
            isMobile={mobileInfo.isMobile}
          />

          {/* Patient Identity Card */}
          {session.patient && phase !== 'camera' && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Identified Patient
              </h3>
              <div className="flex items-center gap-3">
                <div className="bg-ayutalk-100 text-ayutalk-600 dark:bg-ayutalk-900/50 dark:text-ayutalk-400 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold">
                  {session.patient.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {session.patient.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    DOB: {session.patient.dob} &middot; {session.patient.mobile}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel — Transcript / Intake / Brief */}
        <div className="flex flex-1 flex-col gap-4">
          {phase === 'intake' && (
            <>
              {/* AI Intake Conversation */}
              <div className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div
                      aria-hidden="true"
                      className={cn(
                        'h-2 w-2 rounded-full',
                        conversation.isAiThinking ? 'animate-pulse bg-amber-400' : 'bg-emerald-500',
                      )}
                    />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      AI Voice Intake
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {conversation.isAiThinking && (
                      <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <span className="flex gap-0.5">
                          <span
                            className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400"
                            style={{ animationDelay: '0ms' }}
                          />
                          <span
                            className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400"
                            style={{ animationDelay: '150ms' }}
                          />
                          <span
                            className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400"
                            style={{ animationDelay: '300ms' }}
                          />
                        </span>
                        Thinking
                      </span>
                    )}
                    {!conversation.isAiThinking && !conversation.isIntakeComplete && (
                      <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                        In conversation
                      </span>
                    )}
                    {conversation.isIntakeComplete && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        ✓ All info gathered
                      </span>
                    )}
                  </div>
                </div>

                {/* Transcript Area */}
                <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: '400px' }}>
                  {conversation.turns.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <svg
                          className="text-ayutalk-300 dark:text-ayutalk-700 mx-auto mb-3 h-10 w-10"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
                          />
                        </svg>
                        <p className="text-sm text-slate-400 dark:text-slate-500">
                          {conversation.isAiThinking
                            ? 'AI is preparing your intake conversation...'
                            : 'Starting AI intake conversation...'}
                        </p>
                        {conversation.isAiThinking && (
                          <div className="mt-3 flex justify-center gap-1">
                            <span
                              className="bg-ayutalk-400 h-2 w-2 animate-bounce rounded-full"
                              style={{ animationDelay: '0ms' }}
                            />
                            <span
                              className="bg-ayutalk-400 h-2 w-2 animate-bounce rounded-full"
                              style={{ animationDelay: '150ms' }}
                            />
                            <span
                              className="bg-ayutalk-400 h-2 w-2 animate-bounce rounded-full"
                              style={{ animationDelay: '300ms' }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <TranscriptView
                      entries={session.transcripts}
                      onStartIntake={() => {
                        // Conversation already started automatically
                      }}
                    />
                  )}
                </div>

                {/* Voice Input Bar */}
                <VoiceInput
                  value={conversation.patientInput}
                  onChange={conversation.setPatientInput}
                  onSend={conversation.sendPatientMessage}
                  disabled={conversation.isAiThinking}
                  isComplete={conversation.isIntakeComplete}
                  sessionId={sessionId}
                  patientName={session.patient?.name ?? 'Patient'}
                />
              </div>

              {/* Action Buttons */}
              {conversation.isIntakeComplete && (
                <div className="flex gap-3">
                  <button
                    onClick={handleCompleteIntake}
                    className="bg-ayutalk-500 hover:bg-ayutalk-600 flex flex-1 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98]"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Complete Intake & Generate Brief
                  </button>
                </div>
              )}
            </>
          )}

          {phase === 'brief' && (
            <div className="flex flex-1 items-center justify-center">
              {session.brief ? (
                <BriefCard
                  brief={{
                    summary: (session.brief.summary as string) ?? '',
                    chiefComplaint: (session.brief.chiefComplaint as string) ?? '',
                    riskFlags: (session.brief.riskFlags as string[]) ?? [],
                    vitalsToCheck: (session.brief.vitalsToCheck as string[]) ?? [],
                    suggestedFollowups: (session.brief.suggestedFollowups as string[]) ?? [],
                    medicationsNote: (session.brief.medicationsNote as string) ?? '',
                    icd10Hints: (session.brief.icd10Hints as string[]) ?? [],
                  }}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="border-ayutalk-200 border-t-ayutalk-500 dark:border-ayutalk-800 dark:border-t-ayutalk-400 h-12 w-12 animate-spin rounded-full border-4" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Loading clinical brief...
                  </p>
                </div>
              )}
            </div>
          )}

          {phase === 'camera' && (
            <div className="flex flex-1 items-center justify-center">
              <div className="max-w-md text-center">
                <svg
                  className="mx-auto mb-4 h-16 w-16 text-slate-300 dark:text-slate-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                  />
                </svg>
                <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                  Start Patient Intake
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Enable your camera to begin the face detection process. We'll identify the patient
                  automatically.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Face Registration Dialog */}
      {showRegistration && (
        <FaceRegistrationDialog
          embedding={embedding}
          isOpen={showRegistration}
          onRegistered={(patientId, patientName) => {
            setShowRegistration(false);
            face.setStatus('matched');
            session.setFaceMatched(true);
            session.setStatus('face_matched');
            session.setPatient({
              id: patientId,
              name: patientName,
              dob: '',
              mobile: '',
            });
            socketService.joinSession(sessionId);
            if (!conversationStartedRef.current) {
              conversationStartedRef.current = true;
              conversation.startConversation(patientName, patientId, locale);
            }
            setPhase('intake');
          }}
          onCancel={() => {
            setShowRegistration(false);
            registrationAttemptedRef.current = false;
          }}
        />
      )}
    </div>
  );
}
