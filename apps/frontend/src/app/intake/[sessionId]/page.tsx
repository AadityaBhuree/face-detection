'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useSessionStore } from '@/stores/session-store';
import { useFaceStore } from '@/stores/face-store';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useFaceEmbedding } from '@/hooks/useFaceEmbedding';
import { useLivenessDetection } from '@/hooks/useLivenessDetection';
import { useIntakeConversation } from '@/hooks/useIntakeConversation';
import { intakeApi } from '@/services/api';
import { socketService } from '@/services/socket';
import { cn } from '@/lib/utils';
import { TranscriptView } from '@/components/intake/transcript-view';
import { VoiceInput } from '@/components/intake/VoiceInput';
import { FaceDetectionCanvas } from '@/components/face/FaceDetectionCanvas';
import { FaceRegistrationDialog } from '@/components/face/FaceRegistrationDialog';
import { BriefCard } from '@/components/intake/brief-card';

type IntakePhase = 'camera' | 'detecting' | 'intake' | 'brief' | 'complete';

export default function IntakeSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const { videoRef, isActive, startCamera, stopCamera } =
    useCamera({ facingMode: 'user' });

  const session = useSessionStore();
  const face = useFaceStore();

  const [phase, setPhase] = useState<IntakePhase>('camera');
  const [showRegistration, setShowRegistration] = useState(false);
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
  });

  // ─── Face Embedding & Identity Search ────────────────────────
  const {
    embedding,
    matchResult,
    isSearching: isSearchingEmbedding,
    error: embeddingError,
    searchIdentity,
    generateFromLandmarks,
    registerEmbedding,
    reset: resetEmbedding,
  } = useFaceEmbedding();

  // ─── Liveness Detection ──────────────────────────────────────
  const {
    status: livenessStatus,
    blinkCount,
    ear,
    isAlive,
    startChallenge,
    processFrame: processLivenessFrame,
    reset: resetLiveness,
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

      // Auto-start liveness challenge
      setTimeout(() => startChallenge(), 1000);
    } else {
      stopDetection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // ─── Identity Search (when face is stable and liveness verified) ───
  useEffect(() => {
    if (
      isAlive &&
      detectionResult &&
      isFaceDetected &&
      !registrationAttemptedRef.current
    ) {
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
              const brief = await import('@/services/api').then((m) =>
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
              conversation.startConversation(
                result.patientName ?? 'Patient',
                result.patientId,
              );
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
      session.setStatus(data.status as SessionStatus);
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
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ayutalk-500">
            <span className="text-xs font-bold text-white">AC</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900">
              Intake Session
            </h1>
            <p className="text-xs text-slate-500">
              {session.patient?.name ?? 'Unknown Patient'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              session.status === 'intake_in_progress' &&
                'bg-amber-100 text-amber-700',
              session.status === 'face_matched' && 'bg-emerald-100 text-emerald-700',
              session.status === 'ready' && 'bg-blue-100 text-blue-700',
              session.status === 'error' && 'bg-red-100 text-red-700',
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

      <main className="flex flex-1 gap-6 p-6">
        {/* Left Panel — Camera + Face Detection */}
        <div className="flex w-[420px] flex-col gap-4">
          {/* Camera Feed */}
          <div className="relative overflow-hidden rounded-xl bg-black shadow-lg">
            {/* Video */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                'h-[320px] w-full object-cover',
                !isActive && 'hidden',
              )}
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
                videoWidth={videoRef.current?.videoWidth ?? 640}
                videoHeight={videoRef.current?.videoHeight ?? 480}
                isFaceDetected={isFaceDetected}
                matchColor={face.status === 'matched' ? '#22c55e' : '#0c8ee6'}
                drawLandmarks
                drawConnections
                drawBoundingBox
              />
            )}

            {/* Liveness Status Overlay */}
            {phase === 'detecting' && livenessStatus === 'waiting_for_blink' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <div className="rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm">
                  👁 Please blink naturally ({Math.max(0, 2 - blinkCount)} blinks needed)
                </div>
              </div>
            )}

            {livenessStatus === 'blink_detected' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <div className="rounded-full bg-emerald-500/80 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm">
                  ✓ Blink detected!
                </div>
              </div>
            )}

            {/* Loading Overlay */}
            {phase === 'detecting' && mpLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="text-center">
                  <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
                  <p className="text-sm font-medium text-white">
                    Loading face detection model...
                  </p>
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
                  <div className="rounded-lg bg-ayutalk-500/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
                    Searching identity...
                  </div>
                )}
                {mpError && (
                  <div className="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
                    {mpError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Camera Controls */}
          <div className="flex gap-2">
            {!isActive ? (
              <button
                onClick={startCamera}
                className="flex flex-1 items-center justify-center rounded-lg bg-ayutalk-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-ayutalk-600"
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
                    d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15M2.25 18V9.574c0-1.067.75-1.994 1.802-2.169a47.865 47.865 0 0 1 1.134-.175 2.31 2.31 0 0 0 1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m16.5 12.75-4.198-4.197a4.5 4.5 0 0 0-6.364 6.364l1.5 1.5m6.5-6.5 4.198 4.197a4.5 4.5 0 0 1-6.364 6.364l-1.5-1.5"
                  />
                </svg>
                Start Camera
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="flex flex-1 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-all hover:bg-red-100"
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
                    d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 18.07 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                </svg>
                Stop Camera
              </button>
            )}
          </div>

          {/* Patient Identity Card */}
          {session.patient && phase !== 'camera' && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Identified Patient
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ayutalk-100 text-sm font-bold text-ayutalk-600">
                  {session.patient.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {session.patient.name}
                  </p>
                  <p className="text-xs text-slate-500">
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
              <div className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'h-2 w-2 rounded-full',
                      conversation.isAiThinking ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
                    )} />
                    <h3 className="text-sm font-semibold text-slate-900">
                      AI Voice Intake
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {conversation.isAiThinking && (
                      <span className="flex items-center gap-1.5 text-xs text-amber-600">
                        <span className="flex gap-0.5">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '0ms' }} />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '150ms' }} />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: '300ms' }} />
                        </span>
                        Thinking
                      </span>
                    )}
                    {!conversation.isAiThinking && !conversation.isIntakeComplete && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                        In conversation
                      </span>
                    )}
                    {conversation.isIntakeComplete && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
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
                          className="mx-auto mb-3 h-10 w-10 text-ayutalk-300"
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
                        <p className="text-sm text-slate-400">
                          {conversation.isAiThinking
                            ? 'AI is preparing your intake conversation...'
                            : 'Starting AI intake conversation...'
                          }
                        </p>
                        {conversation.isAiThinking && (
                          <div className="mt-3 flex justify-center gap-1">
                            <span className="h-2 w-2 animate-bounce rounded-full bg-ayutalk-400" style={{ animationDelay: '0ms' }} />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-ayutalk-400" style={{ animationDelay: '150ms' }} />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-ayutalk-400" style={{ animationDelay: '300ms' }} />
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
                    className="flex flex-1 items-center justify-center rounded-lg bg-ayutalk-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-ayutalk-600 active:scale-[0.98]"
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
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-ayutalk-200 border-t-ayutalk-500" />
                  <p className="text-sm text-slate-500">Loading clinical brief...</p>
                </div>
              )}
            </div>
          )}

          {phase === 'camera' && (
            <div className="flex flex-1 items-center justify-center">
              <div className="max-w-md text-center">
                <svg
                  className="mx-auto mb-4 h-16 w-16 text-slate-300"
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
                <h3 className="mb-2 text-lg font-semibold text-slate-900">
                  Start Patient Intake
                </h3>
                <p className="text-sm text-slate-500">
                  Enable your camera to begin the face detection process.
                  We'll identify the patient automatically.
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
