'use client';

import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/stores/session-store';
import { intakeApi } from '@/services/api';

export default function HomePage() {
  const router = useRouter();
  const setSessionId = useSessionStore((s) => s.setSessionId);

  async function handleStartIntake() {
    try {
      const session = await intakeApi.startSession({
        deviceId: `web-${crypto.randomUUID().slice(0, 8)}`,
      });
      setSessionId(session.id);
      router.push(`/intake/${session.id}`);
    } catch (err) {
      console.error('Failed to start session:', err);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-ayutalk-50 p-4">
      <div className="w-full max-w-lg space-y-8 text-center">
        {/* Logo & Branding */}
        <div className="space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ayutalk-500 shadow-lg shadow-ayutalk-500/20">
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            AyuTalk Care
          </h1>
          <p className="text-lg text-slate-600">
            AI-powered smart clinic intake system
          </p>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-6 text-sm text-slate-500">
            Start a new patient intake session. The system will guide you
            through face detection, identity verification, and AI-assisted
            symptom collection.
          </p>
          <button
            onClick={handleStartIntake}
            className="inline-flex w-full items-center justify-center rounded-lg bg-ayutalk-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-ayutalk-600 focus:outline-none focus:ring-2 focus:ring-ayutalk-500 focus:ring-offset-2 active:scale-[0.98]"
          >
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
              />
            </svg>
            Start New Intake Session
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              ),
              title: 'Face Recognition',
              desc: 'Instant patient identification',
            },
            {
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                />
              ),
              title: 'AI Voice Intake',
              desc: 'Natural symptom conversation',
            },
            {
              icon: (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
                />
              ),
              title: 'Clinical Brief',
              desc: 'AI-generated doctor summary',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-shadow hover:shadow-md"
            >
              <svg
                className="mx-auto mb-2 h-6 w-6 text-ayutalk-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                {feature.icon}
              </svg>
              <h3 className="text-xs font-semibold text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-1 text-[10px] text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
