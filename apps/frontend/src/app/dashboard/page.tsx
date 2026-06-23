'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { dashboardApi } from '@/services/api';
import { socketService } from '@/services/socket';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────

interface ActiveSession {
  id: string;
  patient: { id: string; name: string; dob: string } | null;
  status: string;
  startedAt: string;
  deviceId: string;
}

interface BriefRecord {
  id: string;
  sessionId: string;
  patientId: string;
  brief: {
    summary?: string;
    chiefComplaint?: string;
    riskFlags?: string[];
    vitalsToCheck?: string[];
    suggestedFollowups?: string[];
    medicationsNote?: string;
    icd10Hints?: string[];
  };
  generatedAt: string;
  session: { id: string; startedAt: string; status: string };
  patient?: { id: string; name: string; dob: string } | null;
}

interface ConversationTurn {
  sessionId: string;
  speaker: string;
  text: string;
  timestamp?: string;
}

// ─── Status helpers ─────────────────────────────────────────────

function getStatusVariant(
  status: string,
): 'success' | 'warning' | 'info' | 'pending' | 'error' {
  const s = status.toLowerCase().replace(/_/g, ' ');
  if (
    s.includes('completed') ||
    s.includes('ready') ||
    s.includes('brief_generated')
  )
    return 'success';
  if (s.includes('in_progress') || s.includes('active') || s.includes('initiated'))
    return 'info';
  if (s.includes('failed') || s.includes('error') || s.includes('timeout'))
    return 'error';
  if (s.includes('transcribing')) return 'warning';
  return 'pending';
}

function getSessionStatusText(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Dashboard Component ────────────────────────────────────────

export default function DashboardPage() {
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [recentBriefs, setRecentBriefs] = useState<BriefRecord[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [briefsLoading, setBriefsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session detail state
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionTurns, setSessionTurns] = useState<ConversationTurn[]>([]);
  const [selectedBrief, setSelectedBrief] = useState<BriefRecord | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const turnsEndRef = useRef<HTMLDivElement>(null);
  const selectedSession = activeSessions.find((s) => s.id === selectedSessionId);

  // ─── Initial Load ──────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [sessionsRes] = await Promise.all([
          dashboardApi.getActiveSessions(1, 50),
        ]);
        setActiveSessions(sessionsRes.data as ActiveSession[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setSessionsLoading(false);
      }
    }
    load();
  }, []);

  // Load briefs on mount
  useEffect(() => {
    async function loadBriefs() {
      try {
        const res = await dashboardApi.getRecentBriefs(1, 20);
        setRecentBriefs(res.data as BriefRecord[]);
      } catch {
        // Briefs may not load if none exist — not critical
      } finally {
        setBriefsLoading(false);
      }
    }
    loadBriefs();
  }, []);

  // ─── WebSocket Subscriptions ───────────────────────────────────

  useEffect(() => {
    const socket = socketService.connect();

    // Listen for session status updates
    const unsubStatus = socketService.onSessionStatus((data) => {
      // Backend emits: { event, sessionId, payload: { status }, timestamp }
      // Socket service types: { status: string } (flat)
      // Handle both formats gracefully
      const payload = data as Record<string, unknown>;
      const status =
        (payload.payload as Record<string, unknown> | undefined)?.status ??
        (data as { status?: string }).status ??
        '';
      const rawSessionId = typeof payload.sessionId === 'string' ? payload.sessionId : '';

      setActiveSessions((prev) =>
        prev.map((s) =>
          s.id === rawSessionId ? { ...s, status: status as string } : s,
        ),
      );
    });

    // Listen for brief:ready — add to briefs list
    const unsubBrief = socketService.onBriefReady((data) => {
      // Refresh briefs list when a new one is generated
      dashboardApi
        .getRecentBriefs(1, 20)
        .then((res) => setRecentBriefs(res.data as BriefRecord[]))
        .catch(() => {});
    });

    // Listen for real-time conversation turns
    const unsubTurns = socketService.onConversationTurn((data) => {
      // Backend emits: { event, sessionId, payload: { speaker, text }, timestamp }
      // Socket service types: { sessionId, speaker, text } (flat)
      // Handle both formats gracefully
      const payload = data as Record<string, unknown>;
      const nestedPayload = payload.payload as
        | Record<string, unknown>
        | undefined;
      const speaker =
        (nestedPayload?.speaker as string) ??
        (data as { speaker?: string }).speaker ??
        '';
      const text =
        (nestedPayload?.text as string) ??
        (data as { text?: string }).text ??
        '';
      const turnSessionId =
        (payload.sessionId as string) ??
        (data as { sessionId?: string }).sessionId ??
        '';
      const timestamp = (payload.timestamp as string) ?? new Date().toISOString();

      // Only add turns for the currently selected session
      if (turnSessionId !== selectedSessionId) return;
      if (!speaker || !text) return;

      setSessionTurns((prev) => {
        const turn: ConversationTurn = {
          sessionId: turnSessionId,
          speaker,
          text,
          timestamp,
        };
        // Avoid duplicates (same text in the last 3 entries)
        const recent = prev.slice(-3);
        if (
          recent.some(
            (t) => t.text === text && t.speaker === speaker,
          )
        )
          return prev;
        return [...prev, turn];
      });
    });

    // Join all active session rooms so we receive their events
    const joinRooms = () => {
      activeSessions.forEach((s) => socketService.joinSession(s.id));
    };
    joinRooms();

    return () => {
      unsubStatus();
      unsubBrief();
      unsubTurns();
      // Leave all session rooms on unmount
      activeSessions.forEach((s) => socketService.leaveSession(s.id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId]);

  // Auto-scroll conversation viewer
  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionTurns]);

  // ─── Actions ───────────────────────────────────────────────────

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
        setSessionTurns([]);
        setSelectedBrief(null);
        return;
      }

      setSelectedSessionId(sessionId);
      setSessionTurns([]);

      // Load the brief for this session if it exists
      const brief = recentBriefs.find((b) => b.sessionId === sessionId);
      setSelectedBrief(brief ?? null);

      // Join the session room for live updates
      socketService.joinSession(sessionId);
    },
    [selectedSessionId, recentBriefs],
  );

  const handleMarkReviewed = useCallback(async (briefId: string) => {
    setReviewingId(briefId);
    try {
      await dashboardApi.markBriefReviewed(briefId);
      // Remove from briefs list
      setRecentBriefs((prev) => prev.filter((b) => b.id !== briefId));
      setSelectedBrief(null);
      // Update session status in active list
      const brief = recentBriefs.find((b) => b.id === briefId);
      if (brief) {
        setActiveSessions((prev) =>
          prev.map((s) =>
            s.id === brief.sessionId ? { ...s, status: 'COMPLETED' } : s,
          ),
        );
      }
    } catch {
      // Error handled silently
    } finally {
      setReviewingId(null);
    }
  }, [recentBriefs]);

  // ─── Stats ─────────────────────────────────────────────────────

  const stats = [
    {
      label: 'Active Sessions',
      value: activeSessions.length,
      color: 'bg-ayutalk-500',
      desc: 'Currently in intake',
    },
    {
      label: 'Ready for Review',
      value: recentBriefs.length,
      color: 'bg-emerald-500',
      desc: 'Briefs awaiting review',
    },
    {
      label: 'In Progress',
      value: activeSessions.filter(
        (s) => s.status === 'INTAKE_IN_PROGRESS' || s.status === 'TRANSCRIBING',
      ).length,
      color: 'bg-amber-500',
      desc: 'Active conversation',
    },
    {
      label: 'Completed Today',
      value: activeSessions.filter((s) => s.status === 'COMPLETED').length,
      color: 'bg-violet-500',
      desc: 'Reviewed sessions',
    },
  ];

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ayutalk-500 shadow-sm">
                <span className="text-sm font-bold text-white">AC</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">
                  Doctor Dashboard
                </h1>
                <p className="text-xs text-slate-500">
                  AyuTalk Care — Live clinic intake monitor
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
              <Link href="/">
                <Button variant="ayutalk" size="sm">
                  <svg
                    className="mr-1.5 h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                  New Intake
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl flex-1 gap-6 p-6">
          {/* Left Panel — Sessions + Briefs */}
          <div className="flex flex-1 flex-col gap-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-4 gap-4">
              {stats.map((stat) => (
                <Card key={stat.label} className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">
                      {stat.label}
                    </p>
                    <div className={cn('h-2 w-2 rounded-full', stat.color)} />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {stat.desc}
                  </p>
                </Card>
              ))}
            </div>

            {/* Active Sessions */}
            <Card>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  Active Intake Sessions
                </h2>
                <span className="text-xs text-slate-400">
                  {activeSessions.length} session
                  {activeSessions.length !== 1 ? 's' : ''}
                </span>
              </div>

              {sessionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-ayutalk-200 border-t-ayutalk-500" />
                </div>
              ) : error ? (
                <div className="px-5 py-8 text-center text-sm text-red-500">
                  {error}
                  <button
                    onClick={() => window.location.reload()}
                    className="ml-2 text-ayutalk-500 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : activeSessions.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                  No active sessions at the moment.
                  <br />
              <Link
                href="/"
                className="mt-1 inline-block text-ayutalk-500 hover:underline"
              >
                Start a new intake
              </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeSessions.map((session) => {
                    const isSelected = selectedSessionId === session.id;
                    const hasBrief = recentBriefs.some(
                      (b) => b.sessionId === session.id,
                    );
                    return (
                      <button
                        key={session.id}
                        onClick={() => handleSelectSession(session.id)}
                        className={cn(
                          'flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-slate-50',
                          isSelected && 'bg-ayutalk-50/50',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                            {session.patient?.name
                              ?.split(' ')
                              .map((n) => n[0])
                              .join('') ?? '?'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {session.patient?.name ?? 'Unknown Patient'}
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatDateTime(session.startedAt)}
                              {session.patient?.dob &&
                                ` · DOB: ${session.patient.dob}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge
                            status={getSessionStatusText(session.status)}
                          />
                          {hasBrief && (
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                          )}
                          {isSelected && (
                            <svg
                              className="h-4 w-4 text-ayutalk-500"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8.25 4.5l7.5 7.5-7.5 7.5"
                              />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Ready Briefs */}
            <Card>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  Completed Briefs
                </h2>
                {briefsLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-ayutalk-200 border-t-ayutalk-500" />
                ) : (
                  <span className="text-xs text-slate-400">
                    {recentBriefs.length} brief
                    {recentBriefs.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {briefsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-ayutalk-200 border-t-ayutalk-500" />
                </div>
              ) : recentBriefs.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                  No completed briefs yet.
                  <br />
                  <span className="text-xs text-slate-300">
                    Briefs appear here once an intake conversation is complete
                  </span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentBriefs.map((record) => {
                    const isSelected = selectedBrief?.id === record.id;
                    const patientName =
                      record.patient?.name ?? record.brief.chiefComplaint ?? 'Patient';
                    return (
                      <button
                        key={record.id}
                        onClick={() => {
                          setSelectedBrief(
                            selectedBrief?.id === record.id ? null : record,
                          );
                          setSelectedSessionId(record.sessionId);
                          setSessionTurns([]);
                        }}
                        className={cn(
                          'flex w-full items-start justify-between px-5 py-4 text-left transition-colors hover:bg-slate-50',
                          isSelected && 'bg-emerald-50/50',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-slate-900">
                              {patientName}
                            </h3>
                            <Badge variant="success" size="sm">
                              New
                            </Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {record.brief.chiefComplaint}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {formatDateTime(record.generatedAt)}
                          </p>
                          {record.brief.riskFlags &&
                            record.brief.riskFlags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {record.brief.riskFlags.map((flag) => (
                                  <span
                                    key={flag}
                                    className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700"
                                  >
                                    ⚠ {flag}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>
                        <Button
                          variant="success"
                          size="sm"
                          loading={reviewingId === record.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkReviewed(record.id);
                          }}
                          className="ml-3 flex-shrink-0"
                        >
                          {reviewingId === record.id ? 'Marking...' : 'Mark Reviewed'}
                        </Button>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Right Panel — Session Detail Drawer */}
          <div
            className={cn(
              'flex w-[420px] flex-shrink-0 flex-col gap-4 transition-all duration-300',
              !selectedSession && 'w-0 overflow-hidden opacity-0',
            )}
          >
            {selectedSession && (
              <>
                {/* Session Info Card */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ayutalk-100 text-xs font-bold text-ayutalk-600">
                        {selectedSession.patient?.name
                          ?.split(' ')
                          .map((n) => n[0])
                          .join('') ?? '?'}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {selectedSession.patient?.name ?? 'Unknown Patient'}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {formatDateTime(selectedSession.startedAt)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge
                      status={getSessionStatusText(selectedSession.status)}
                    />
                  </div>
                </Card>

                {/* Real-time Conversation Viewer */}
                <Card className="flex flex-1 flex-col">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <h3 className="text-sm font-semibold text-slate-900">
                        Live Conversation
                      </h3>
                    </div>
                    <span className="text-xs text-slate-400">
                      {sessionTurns.length} turn
                      {sessionTurns.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {sessionTurns.length === 0 ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="text-center">
                          <svg
                            className="mx-auto mb-2 h-8 w-8 text-slate-300"
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
                          <p className="text-xs text-slate-400">
                            Waiting for conversation...
                          </p>
                          <p className="mt-1 text-[10px] text-slate-300">
                            Turns appear here in real-time
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {sessionTurns.map((turn, i) => (
                          <div
                            key={`${turn.speaker}-${i}-${turn.timestamp}`}
                            className={cn(
                              'flex gap-2',
                              turn.speaker === 'ai'
                                ? 'justify-start'
                                : 'justify-end',
                            )}
                          >
                            {/* AI Message */}
                            {turn.speaker === 'ai' && (
                              <div className="flex max-w-[85%] gap-2">
                                <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-ayutalk-100 text-[10px] font-bold text-ayutalk-600">
                                  AI
                                </div>
                                <div className="rounded-xl rounded-tl-sm bg-slate-100 px-3 py-2">
                                  <p className="text-xs text-slate-700">
                                    {turn.text}
                                  </p>
                                  {turn.timestamp && (
                                    <p className="mt-1 text-[10px] text-slate-400">
                                      {formatTime(turn.timestamp)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Patient Message */}
                            {turn.speaker === 'patient' && (
                              <div className="flex max-w-[85%] flex-row-reverse gap-2">
                                <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                                  P
                                </div>
                                <div className="rounded-xl rounded-tr-sm bg-ayutalk-500 px-3 py-2">
                                  <p className="text-xs text-white">
                                    {turn.text}
                                  </p>
                                  {turn.timestamp && (
                                    <p className="mt-1 text-[10px] text-ayutalk-200">
                                      {formatTime(turn.timestamp)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        <div ref={turnsEndRef} />
                      </>
                    )}
                  </div>
                </Card>

                {/* Selected Brief Preview */}
                {selectedBrief && (
                  <Card className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Clinical Brief
                      </h3>
                      <Badge variant="success" size="sm">
                        Ready
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-medium uppercase text-slate-400">
                          Chief Complaint
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-slate-900">
                          {selectedBrief.brief.chiefComplaint ?? 'N/A'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-medium uppercase text-slate-400">
                          Summary
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                          {selectedBrief.brief.summary ?? 'No summary'}
                        </p>
                      </div>

                      {selectedBrief.brief.riskFlags &&
                        selectedBrief.brief.riskFlags.length > 0 && (
                          <div>
                            <p className="text-[10px] font-medium uppercase text-red-400">
                              Risk Flags
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {selectedBrief.brief.riskFlags.map((flag) => (
                                <span
                                  key={flag}
                                  className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-red-200"
                                >
                                  ⚠ {flag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      {selectedBrief.brief.vitalsToCheck &&
                        selectedBrief.brief.vitalsToCheck.length > 0 && (
                          <div>
                            <p className="text-[10px] font-medium uppercase text-slate-400">
                              Vitals to Check
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {selectedBrief.brief.vitalsToCheck.map((vital) => (
                                <span
                                  key={vital}
                                  className="inline-flex items-center rounded-full bg-ayutalk-50 px-2 py-0.5 text-[10px] font-medium text-ayutalk-700 ring-1 ring-ayutalk-200"
                                >
                                  {vital}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="success"
                          size="sm"
                          className="flex-1"
                          loading={reviewingId === selectedBrief.id}
                          onClick={() => handleMarkReviewed(selectedBrief.id)}
                        >
                          <svg
                            className="mr-1.5 h-3.5 w-3.5"
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
                          Mark as Reviewed
                        </Button>
                        <Button variant="outline" size="sm">
                          <svg
                            className="mr-1.5 h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6.72 14.25l4.46-4.46c.48-.48.48-1.26 0-1.74L9.35 5.36a1.22 1.22 0 00-1.74 0l-4.46 4.46c-.48.48-.48 1.26 0 1.74l1.83 1.83m7.27-5.49L17.7 7.21a1.5 1.5 0 012.12 0l1.5 1.5a1.5 1.5 0 010 2.12l-5.35 5.36-3.18 1.06 1.06-3.18 5.35-5.36z"
                            />
                          </svg>
                          Edit
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
