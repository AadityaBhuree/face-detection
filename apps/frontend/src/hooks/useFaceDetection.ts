'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaceLandmarker,
  type FaceLandmarkerResult,
  FilesetResolver,
} from '@mediapipe/tasks-vision';

export interface DetectionResult {
  landmarks: Array<{ x: number; y: number; z: number }>;
  blendshapes?: Array<{ categories: Array<{ categoryName: string; score: number }> }>;
  faceMatrix?: Float32Array;
  detectionTimeMs: number;
}

interface UseFaceDetectionOptions {
  /** Number of faces to detect (default: 1) */
  numFaces?: number;
  /** Whether to output face blendshapes (default: false) */
  outputBlendshapes?: boolean;
  /** Whether to output facial transformation matrix (default: false) */
  outputFaceMatrix?: boolean;
  /** Minimum face detection confidence (default: 0.5) */
  minDetectionConfidence?: number;
  /** Minimum tracking confidence (default: 0.5) */
  minTrackingConfidence?: number;
  /** Model asset path for the .task file */
  modelAssetPath?: string;
  /** Whether detection should auto-start when video is active (default: true) */
  autoStart?: boolean;
  /** Use CPU delegate instead of GPU (for mobile devices with limited GPU). Default: false */
  useCPUDelegate?: boolean;
  /** Optional WebAssembly fileset path override (for CDN fallback) */
  wasmPath?: string;
}

interface UseFaceDetectionReturn {
  /** The current detection result (null if no face detected) */
  result: DetectionResult | null;
  /** Whether MediaPipe is loading */
  isLoading: boolean;
  /** Error message if loading/detection failed */
  error: string | null;
  /** Whether a face is currently detected */
  isFaceDetected: boolean;
  /** Frames per second of detection */
  fps: number;
  /** Start the detection loop on a video element */
  startDetection: (videoElement: HTMLVideoElement) => void;
  /** Stop the detection loop */
  stopDetection: () => void;
}

const DEFAULT_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

export function useFaceDetection(
  options: UseFaceDetectionOptions = {},
): UseFaceDetectionReturn {
  const {
    numFaces = 1,
    outputBlendshapes = false,
    outputFaceMatrix = false,
    minDetectionConfidence = 0.5,
    minTrackingConfidence = 0.5,
    modelAssetPath = DEFAULT_MODEL_URL,
    autoStart = true,
    useCPUDelegate = false,
    wasmPath = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  } = options;

  const [result, setResult] = useState<DetectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [fps, setFps] = useState(0);

  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const isRunningRef = useRef(false);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const lastVideoTimeRef = useRef(-1);
  const delegateRef = useRef<'GPU' | 'CPU'>(useCPUDelegate ? 'CPU' : 'GPU');

  // Initialize FaceLandmarker
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setIsLoading(true);

        const vision = await FilesetResolver.forVisionTasks(wasmPath);

        if (!mounted) return;

        const delegate = delegateRef.current;

        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath,
              delegate,
            },
            runningMode: 'VIDEO',
            outputFaceBlendshapes: outputBlendshapes,
            outputFacialTransformationMatrixes: outputFaceMatrix,
            numFaces,
            minFaceDetectionConfidence: minDetectionConfidence,
            minTrackingConfidence: minTrackingConfidence,
          },
        );

        setIsLoading(false);
      } catch (err) {
        if (mounted) {
          // If GPU delegate failed on mobile, recommend CPU fallback
      const message = err instanceof Error ? err.message : 'MediaPipe initialization failed';
      const suggestion = delegateRef.current === 'GPU' && useCPUDelegate === false
        ? ' Try enabling CPU mode on mobile devices.'
        : '';
      setError(message + suggestion);
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      stopDetection();
      faceLandmarkerRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectLoop = useCallback(() => {
    const video = videoRef.current;
    const landmarker = faceLandmarkerRef.current;
    if (!video || !landmarker || !isRunningRef.current) return;

    const startTimeMs = performance.now();

    // Only detect if video time has changed (new frame available)
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;

      try {
        const detectionResult: FaceLandmarkerResult =
          landmarker.detectForVideo(video, startTimeMs);

        if (
          detectionResult.faceLandmarks &&
          detectionResult.faceLandmarks.length > 0
        ) {
          const faceLandmarks = detectionResult.faceLandmarks[0]!;

          setResult({
            landmarks: faceLandmarks.map((lm) => ({
              x: lm.x,
              y: lm.y,
              z: lm.z ?? 0,
            })),
            blendshapes: detectionResult.faceBlendshapes,
            faceMatrix:
              detectionResult.facialTransformationMatrixes?.[0]?.data,
            detectionTimeMs: performance.now() - startTimeMs,
          });

          setIsFaceDetected(true);
        } else {
          setResult(null);
          setIsFaceDetected(false);
        }
      } catch (detectErr) {
        // Silently skip failed detections (e.g., when video is paused)
        if (isRunningRef.current) {
          console.warn('Face detection error:', detectErr);
        }
      }

      // Calculate FPS
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - lastFpsTimeRef.current;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / elapsed));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
    }

    animFrameRef.current = requestAnimationFrame(detectLoop);
  }, []);

  const startDetection = useCallback(
    (videoElement: HTMLVideoElement) => {
      if (!faceLandmarkerRef.current) {
        setError('Face detection model not loaded yet. Please wait.');
        return;
      }
      if (isRunningRef.current) return;

      videoRef.current = videoElement;
      isRunningRef.current = true;
      lastVideoTimeRef.current = -1;
      detectLoop();
    },
    [detectLoop],
  );

  const stopDetection = useCallback(() => {
    isRunningRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    videoRef.current = null;
    lastVideoTimeRef.current = -1;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    result,
    isLoading,
    error,
    isFaceDetected,
    fps,
    startDetection,
    stopDetection,
  };
}
