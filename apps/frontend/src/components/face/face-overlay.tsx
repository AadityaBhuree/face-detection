'use client';

import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, Eye } from 'lucide-react';

export type OverlayStatus =
  | 'idle'
  | 'detecting'
  | 'liveness_check'
  | 'matched'
  | 'no_match'
  | 'registering';

export interface DetectedFace {
  id: string;
  box: { x: number; y: number; width: number; height: number };
  confidence: number;
}

interface FaceOverlayProps {
  /** Current detection status */
  status?: OverlayStatus;
  /** Detected faces (pass empty array when none detected) */
  faces?: DetectedFace[];
  /** Overall detection confidence (0-1) */
  confidence?: number;
  /** Blink progress for liveness (0 to requiredBlinks) */
  blinkCount?: number;
  /** Total blinks required for liveness */
  requiredBlinks?: number;
  /** Whether camera is active */
  isCameraActive?: boolean;
  /** Patient name when matched */
  patientName?: string;
  /** Match confidence score (0-1) */
  matchScore?: number;
  /** CSS class for the container */
  className?: string;
}

export function FaceOverlay({
  status = 'idle',
  faces = [],
  confidence = 0,
  blinkCount = 0,
  requiredBlinks = 2,
  isCameraActive = false,
  patientName,
  matchScore,
  className,
}: FaceOverlayProps) {
  // ─── No camera state ─────────────────────────────────────────
  if (!isCameraActive) {
    return (
      <div
        className={cn(
          'pointer-events-none absolute inset-0 flex items-center justify-center',
          className,
        )}
      >
        <div className="rounded-2xl border-2 border-dashed border-slate-300/50 bg-slate-50/50 p-6 text-center backdrop-blur-sm dark:border-slate-600/30 dark:bg-slate-800/30">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-300 dark:text-slate-600" />
          <p className="mt-2 text-xs text-slate-400">Waiting for camera...</p>
        </div>
      </div>
    );
  }

  // ─── Idle state ──────────────────────────────────────────────
  if (status === 'idle' && faces.length === 0) {
    return (
      <div
        className={cn(
          'pointer-events-none absolute inset-0 flex items-center justify-center',
          className,
        )}
      >
        <div className="rounded-2xl border-2 border-dashed border-slate-300/30 bg-slate-50/30 p-6 text-center backdrop-blur-sm dark:border-slate-600/20 dark:bg-slate-800/20">
          <div className="bg-jeevandata-100 dark:bg-jeevandata-900/50 mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full">
            <Eye className="text-jeevandata-500 h-5 w-5" />
          </div>
          <p className="text-xs font-medium text-slate-400">Position your face in the center</p>
        </div>
      </div>
    );
  }

  // ─── Detecting state ─────────────────────────────────────────
  if (status === 'detecting' || (status === 'idle' && faces.length > 0)) {
    const primaryFace = faces[0];
    const faceTop = primaryFace ? `${primaryFace.box.y * 100}%` : '20%';
    const faceLeft = primaryFace ? `${primaryFace.box.x * 100}%` : '25%';
    const faceWidth = primaryFace ? `${primaryFace.box.width * 100}%` : '50%';
    const faceHeight = primaryFace ? `${primaryFace.box.height * 100}%` : '60%';

    return (
      <div className={cn('pointer-events-none absolute inset-0', className)}>
        {/* Face bounding box */}
        <div
          className="face-overlay animate-pulse"
          style={{ top: faceTop, left: faceLeft, width: faceWidth, height: faceHeight }}
        >
          {/* Corner decorations */}
          <div className="border-jeevandata-400 absolute -left-[2px] -top-[2px] h-4 w-4 border-l-2 border-t-2" />
          <div className="border-jeevandata-400 absolute -right-[2px] -top-[2px] h-4 w-4 border-r-2 border-t-2" />
          <div className="border-jeevandata-400 absolute -bottom-[2px] -left-[2px] h-4 w-4 border-b-2 border-l-2" />
          <div className="border-jeevandata-400 absolute -bottom-[2px] -right-[2px] h-4 w-4 border-b-2 border-r-2" />
        </div>

        {/* Scan line */}
        <div
          className="animate-scan-line via-jeevandata-400/60 absolute left-[25%] h-0.5 w-[50%] bg-gradient-to-r from-transparent to-transparent opacity-70"
          style={{ left: faceLeft, width: faceWidth }}
        />

        {/* Confidence badge */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            {/* Animated ring */}
            <svg className="h-4 w-4" viewBox="0 0 16 16">
              <circle
                cx="8"
                cy="8"
                r="6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-white/20"
              />
              <circle
                cx="8"
                cy="8"
                r="6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={`${2 * Math.PI * 6}`}
                strokeDashoffset={`${2 * Math.PI * 6 * (1 - confidence)}`}
                className="text-jeevandata-400"
                style={{ transition: 'stroke-dashoffset 0.3s ease' }}
              />
            </svg>
            <span>{Math.round(confidence * 100)}% confidence</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Liveness check state ────────────────────────────────────
  if (status === 'liveness_check') {
    return (
      <div className={cn('pointer-events-none absolute inset-0', className)}>
        {/* Face box with purple glow */}
        <div
          className="face-overlay border-violet-400"
          style={{ top: '20%', left: '25%', width: '50%', height: '60%' }}
        >
          <div className="absolute -left-[2px] -top-[2px] h-4 w-4 border-l-2 border-t-2 border-violet-400" />
          <div className="absolute -right-[2px] -top-[2px] h-4 w-4 border-r-2 border-t-2 border-violet-400" />
          <div className="absolute -bottom-[2px] -left-[2px] h-4 w-4 border-b-2 border-l-2 border-violet-400" />
          <div className="absolute -bottom-[2px] -right-[2px] h-4 w-4 border-b-2 border-r-2 border-violet-400" />
        </div>

        {/* Blink progress */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="rounded-full bg-black/60 px-4 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-medium text-white">Liveness check</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              {Array.from({ length: requiredBlinks }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-2 w-2 rounded-full transition-all duration-300',
                    i < blinkCount
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                      : 'bg-white/30',
                  )}
                />
              ))}
              <span className="ml-1 text-[10px] text-white/60">
                {blinkCount}/{requiredBlinks} blinks
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Matched state ───────────────────────────────────────────
  if (status === 'matched') {
    return (
      <div className={cn('pointer-events-none absolute inset-0', className)}>
        {/* Face box with green glow */}
        <div
          className="face-overlay matched animate-pulse-glow"
          style={{ top: '20%', left: '25%', width: '50%', height: '60%' }}
        >
          <div className="absolute -left-[2px] -top-[2px] h-4 w-4 border-l-2 border-t-2 border-emerald-400" />
          <div className="absolute -right-[2px] -top-[2px] h-4 w-4 border-r-2 border-t-2 border-emerald-400" />
          <div className="absolute -bottom-[2px] -left-[2px] h-4 w-4 border-b-2 border-l-2 border-emerald-400" />
          <div className="absolute -bottom-[2px] -right-[2px] h-4 w-4 border-b-2 border-r-2 border-emerald-400" />
        </div>

        {/* Match confirmation */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="animate-scale-in flex items-center gap-2 rounded-full bg-emerald-500/90 px-4 py-2 shadow-lg backdrop-blur-sm">
            <CheckCircle2 className="h-4 w-4 text-white" />
            <div className="text-left">
              <p className="text-xs font-semibold text-white">{patientName ?? 'Patient matched'}</p>
              {matchScore !== undefined && (
                <p className="text-[10px] text-emerald-100">
                  {Math.round(matchScore * 100)}% match confidence
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── No match state ──────────────────────────────────────────
  if (status === 'no_match') {
    return (
      <div className={cn('pointer-events-none absolute inset-0', className)}>
        {/* Face box with amber glow */}
        <div
          className="face-overlay border-amber-400"
          style={{ top: '20%', left: '25%', width: '50%', height: '60%' }}
        >
          <div className="absolute -left-[2px] -top-[2px] h-4 w-4 border-l-2 border-t-2 border-amber-400" />
          <div className="absolute -right-[2px] -top-[2px] h-4 w-4 border-r-2 border-t-2 border-amber-400" />
          <div className="absolute -bottom-[2px] -left-[2px] h-4 w-4 border-b-2 border-l-2 border-amber-400" />
          <div className="absolute -bottom-[2px] -right-[2px] h-4 w-4 border-b-2 border-r-2 border-amber-400" />
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="rounded-full bg-amber-500/80 px-4 py-2 backdrop-blur-sm">
            <p className="text-xs font-medium text-white">New patient — registration required</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Fallback / registering ──────────────────────────────────
  return null;
}
