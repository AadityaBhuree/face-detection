'use client';

interface FaceOverlayProps {
  confidence: number;
}

export function FaceOverlay({ confidence }: FaceOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Face Detection Box */}
      <div
        className="face-overlay animate-pulse"
        style={{
          top: '20%',
          left: '25%',
          width: '50%',
          height: '60%',
        }}
      >
        {/* Corner decorations */}
        <div className="absolute -left-[2px] -top-[2px] h-4 w-4 border-l-2 border-t-2 border-ayutalk-400" />
        <div className="absolute -right-[2px] -top-[2px] h-4 w-4 border-r-2 border-t-2 border-ayutalk-400" />
        <div className="absolute -bottom-[2px] -left-[2px] h-4 w-4 border-b-2 border-l-2 border-ayutalk-400" />
        <div className="absolute -bottom-[2px] -right-[2px] h-4 w-4 border-b-2 border-r-2 border-ayutalk-400" />
      </div>

      {/* Confidence Badge */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <div className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {Math.round(confidence * 100)}% confidence
        </div>
      </div>

      {/* Scan Line Animation */}
      <div
        className="absolute left-[25%] h-0.5 w-[50%] animate-pulse bg-gradient-to-r from-transparent via-ayutalk-400/50 to-transparent"
        style={{
          top: '20%',
          animation: 'scanLine 2s ease-in-out infinite',
        }}
      />

      <style jsx>{`
        @keyframes scanLine {
          0%,
          100% {
            top: 20%;
          }
          50% {
            top: 78%;
          }
        }
      `}</style>
    </div>
  );
}
