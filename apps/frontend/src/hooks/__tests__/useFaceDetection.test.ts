import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFaceDetection } from '../useFaceDetection';

// ─── Mock @mediapipe/tasks-vision ─────────────────────────────
// The real module loads heavy WASM binaries and requires WebGL.
// We mock it entirely to test the hook's logic in isolation.
//
// IMPORTANT: Use vi.hoisted() because vi.mock() is hoisted to the
// top of the file by Vitest. Variables defined outside hoisted()
// are not yet initialised when the factory runs.

const { mockCreateFromOptions, mockForVisionTasks } = vi.hoisted(() => ({
  mockCreateFromOptions: vi.fn(),
  mockForVisionTasks: vi.fn(),
}));

vi.mock('@mediapipe/tasks-vision', () => ({
  FaceLandmarker: { createFromOptions: mockCreateFromOptions },
  FilesetResolver: { forVisionTasks: mockForVisionTasks },
}));

// ─── Test Helpers ─────────────────────────────────────────────

interface MockFaceLandmarker {
  detectForVideo: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function createMockLandmarker(): MockFaceLandmarker {
  return {
    detectForVideo: vi.fn(),
    close: vi.fn(),
  };
}

function createVideoElement(currentTime = 0): HTMLVideoElement {
  const el = document.createElement('video');
  Object.defineProperty(el, 'currentTime', {
    value: currentTime,
    writable: true,
  });
  return el;
}

function createFaceDetectionResult(options?: {
  hasLandmarks?: boolean;
  numFaces?: number;
}) {
  const { hasLandmarks = true, numFaces = 1 } = options ?? {};

  if (!hasLandmarks) {
    return { faceLandmarks: [], faceBlendshapes: undefined };
  }

  const face = Array.from({ length: 478 }, (_, i) => ({
    x: 0.1 + Math.sin(i * 0.01),
    y: 0.2 + Math.cos(i * 0.01),
    z: 0.3 + Math.sin(i * 0.02),
  }));

  return {
    faceLandmarks: Array.from({ length: numFaces }, () => face),
    faceBlendshapes: undefined,
  };
}

// ─── describe: useFaceDetection ───────────────────────────────

describe('useFaceDetection', () => {
  let mockLandmarker: MockFaceLandmarker;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: successful MediaPipe initialisation
    mockLandmarker = createMockLandmarker();
    mockForVisionTasks.mockResolvedValue({});
    mockCreateFromOptions.mockResolvedValue(mockLandmarker);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Initial State ─────────────────────────────────────────

  describe('initial state', () => {
    it('should start with isLoading true and no data', () => {
      const { result } = renderHook(() => useFaceDetection());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isFaceDetected).toBe(false);
      expect(result.current.fps).toBe(0);
    });
  });

  // ─── Initialisation ────────────────────────────────────────

  describe('initialisation', () => {
    it('should set isLoading to false after successful init', async () => {
      const { result } = renderHook(() => useFaceDetection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeNull();
      expect(mockForVisionTasks).toHaveBeenCalledTimes(1);
      expect(mockCreateFromOptions).toHaveBeenCalledTimes(1);
    });

    it('should pass default options to FaceLandmarker.createFromOptions', async () => {
      renderHook(() => useFaceDetection());

      await waitFor(() => {
        expect(mockCreateFromOptions).toHaveBeenCalled();
      });

      const [, opts] = mockCreateFromOptions.mock.calls[0]!;
      expect(opts).toMatchObject({
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
        minFaceDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        baseOptions: {
          delegate: 'GPU',
        },
      });
    });

    it('should pass custom options to FaceLandmarker.createFromOptions', async () => {
      renderHook(() =>
        useFaceDetection({
          numFaces: 3,
          outputBlendshapes: true,
          outputFaceMatrix: true,
          minDetectionConfidence: 0.8,
          minTrackingConfidence: 0.7,
        }),
      );

      await waitFor(() => {
        expect(mockCreateFromOptions).toHaveBeenCalled();
      });

      const [, opts] = mockCreateFromOptions.mock.calls[0]!;
      expect(opts).toMatchObject({
        numFaces: 3,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.8,
        minTrackingConfidence: 0.7,
      });
    });

    it('should use custom modelAssetPath when provided', async () => {
      const customPath = '/models/face_landmarker.task';
      renderHook(() => useFaceDetection({ modelAssetPath: customPath }));

      await waitFor(() => {
        expect(mockCreateFromOptions).toHaveBeenCalled();
      });

      const [, opts] = mockCreateFromOptions.mock.calls[0]!;
      expect(opts.baseOptions.modelAssetPath).toBe(customPath);
    });

    it('should set error when FilesetResolver fails', async () => {
      mockForVisionTasks.mockRejectedValue(new Error('WASM load failed'));

      const { result } = renderHook(() => useFaceDetection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toContain('WASM load failed');
    });

    it('should set generic error when init fails with non-Error', async () => {
      mockForVisionTasks.mockRejectedValue('string error');

      const { result } = renderHook(() => useFaceDetection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toContain('MediaPipe initialization failed');
    });

    it('should not call createFromOptions if unmounted during init', async () => {
      // Make init a long-running promise
      mockForVisionTasks.mockImplementation(
        () => new Promise(() => {}), // never resolves
      );

      const { unmount } = renderHook(() => useFaceDetection());
      unmount();

      // After unmount, we need a tick for the useEffect cleanup
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockCreateFromOptions).not.toHaveBeenCalled();
    });
  });

  // ─── startDetection / stopDetection ─────────────────────────

  describe('startDetection / stopDetection', () => {
    it('should return error if called before model is ready', () => {
      // Keep init unresolved so landmarker is null
      mockForVisionTasks.mockImplementation(
        () => new Promise(() => {}),
      );

      const { result } = renderHook(() => useFaceDetection());
      const videoEl = createVideoElement(0);

      act(() => {
        result.current.startDetection(videoEl);
      });

      expect(result.current.error).toBe(
        'Face detection model not loaded yet. Please wait.',
      );
    });

    it('should start detection loop after init completes', async () => {
      const { result } = renderHook(() => useFaceDetection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const videoEl = createVideoElement(0);
      mockLandmarker.detectForVideo.mockReturnValue(createFaceDetectionResult());

      act(() => {
        result.current.startDetection(videoEl);
      });

      // Let React re-render after the state update from detectLoop
      await act(async () => {
        await vi.waitFor(() => {
          expect(mockLandmarker.detectForVideo).toHaveBeenCalledTimes(1);
        });
      });

      expect(result.current.isFaceDetected).toBe(true);
    });

    it('should be a no-op if already running', async () => {
      const { result } = renderHook(() => useFaceDetection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const videoEl = createVideoElement(0);
      mockLandmarker.detectForVideo.mockReturnValue(createFaceDetectionResult());

      act(() => {
        result.current.startDetection(videoEl);
        result.current.startDetection(videoEl); // second call
      });

      await act(async () => {
        await vi.waitFor(() => {
          expect(mockLandmarker.detectForVideo).toHaveBeenCalledTimes(1);
        });
      });
    });

    it('should stop the detection loop and reset refs', async () => {
      const { result } = renderHook(() => useFaceDetection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const videoEl = createVideoElement(0);
      mockLandmarker.detectForVideo.mockReturnValue(createFaceDetectionResult());

      act(() => {
        result.current.startDetection(videoEl);
      });

      // Wait for one frame
      await act(async () => {
        await vi.waitFor(() => {
          expect(mockLandmarker.detectForVideo).toHaveBeenCalledTimes(1);
        });
      });

      expect(mockLandmarker.detectForVideo).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.stopDetection();
      });

      // Advance time — no more frames should process
      await act(async () => {
        await vi.waitFor(() => {
          // Should still be at 1 call after stopping
        });
      });

      expect(mockLandmarker.detectForVideo).toHaveBeenCalledTimes(1);
    });

    it('should clean up on unmount', async () => {
      const { result, unmount } = renderHook(() => useFaceDetection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      unmount();

      expect(mockLandmarker.close).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Detection Loop Behaviour ───────────────────────────────
  //
  // These tests use vi.useFakeTimers() + requestAnimationFrame mock
  // to step frame-by-frame through the animation loop.

  describe('detection loop behaviour', () => {
    // ── Track the rAF callback so we can drive frames manually ──
    // We avoid bridging rAF → setTimeout because that creates a
    // timer-ownership conflict when the hook calls cancelAnimationFrame
    // on what was actually created by setTimeout.

    let rafCallback: FrameRequestCallback | null = null;

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date', 'performance'] });

      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCallback = cb;
        return 1;
      });
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
        rafCallback = null;
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      rafCallback = null;
    });

    it('should update result when face landmarks are found', async () => {
      const { result } = renderHook(() => useFaceDetection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const videoEl = createVideoElement(0);
      mockLandmarker.detectForVideo.mockReturnValue(
        createFaceDetectionResult({ hasLandmarks: true }),
      );

      // startDetection calls detectLoop() synchronously
      act(() => {
        result.current.startDetection(videoEl);
      });

      // State updates from detectLoop are flushed by act()
      expect(result.current.isFaceDetected).toBe(true);
      expect(result.current.result).not.toBeNull();
      expect(result.current.result!.landmarks.length).toBe(478);
    });

    it('should set isFaceDetected to false when no landmarks found', async () => {
      const { result } = renderHook(() => useFaceDetection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const videoEl = createVideoElement(0);
      mockLandmarker.detectForVideo.mockReturnValue(
        createFaceDetectionResult({ hasLandmarks: false }),
      );

      act(() => {
        result.current.startDetection(videoEl);
      });

      expect(result.current.isFaceDetected).toBe(false);
      expect(result.current.result).toBeNull();
    });

    it('should skip detection when video currentTime has not changed', async () => {
      const { result } = renderHook(() => useFaceDetection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const videoEl = createVideoElement(0.04);
      mockLandmarker.detectForVideo.mockReturnValue(
        createFaceDetectionResult(),
      );

      // startDetection calls detectLoop synchronously — runs frame 1
      act(() => {
        result.current.startDetection(videoEl);
      });

      expect(mockLandmarker.detectForVideo).toHaveBeenCalledTimes(1);

      // Frame 2 — advance via rAF, currentTime still 0.04 → skip
      act(() => {
        rafCallback?.(Date.now());
      });

      expect(mockLandmarker.detectForVideo).toHaveBeenCalledTimes(1);

      // Frame 3 — currentTime changes → detects
      videoEl.currentTime = 0.08;
      act(() => {
        rafCallback?.(Date.now());
      });

      expect(mockLandmarker.detectForVideo).toHaveBeenCalledTimes(2);
    });

    it('should calculate FPS correctly over multiple frames', async () => {
      const { result } = renderHook(() => useFaceDetection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const videoEl = createVideoElement(0);
      mockLandmarker.detectForVideo.mockReturnValue(
        createFaceDetectionResult(),
      );

      act(() => {
        result.current.startDetection(videoEl);
      });

      // Run 65 frames. Each rAF callback fires detectLoop, which
      // increments frameCountRef. We advance faked time by ~16ms per
      // frame so that after 65 frames (~1040ms) the FPS calculation
      // fires (threshold: elapsed >= 1000).
      for (let i = 0; i < 65; i++) {
        videoEl.currentTime = i * 0.04;
        act(() => {
          rafCallback?.(Date.now());
        });
        // Advance faked Date.now() / performance.now() for next frame
        vi.advanceTimersByTime(16);
      }

      // After >1000ms of faked time, FPS must have been calculated
      expect(result.current.fps).toBeGreaterThan(0);
    });

    it('should not crash when detectForVideo throws', async () => {
      const consoleWarnSpy = vi
        .spyOn(globalThis.console, 'warn')
        .mockImplementation(() => {});

      const { result } = renderHook(() => useFaceDetection());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const videoEl = createVideoElement(0);
      mockLandmarker.detectForVideo.mockImplementation(() => {
        throw new Error('GPU context lost');
      });

      act(() => {
        result.current.startDetection(videoEl);
      });

      // detectLoop runs synchronously inside startDetection, catches error
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Face detection error:',
        expect.any(Error),
      );
      expect(result.current.result).toBeNull();
      expect(result.current.isFaceDetected).toBe(false);
      expect(mockLandmarker.detectForVideo).toHaveBeenCalledTimes(1);

      consoleWarnSpy.mockRestore();
    });

    it('should handle multiple faces when configured', async () => {
      const { result } = renderHook(() =>
        useFaceDetection({ numFaces: 2 }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const videoEl = createVideoElement(0);
      mockLandmarker.detectForVideo.mockReturnValue(
        createFaceDetectionResult({ numFaces: 2 }),
      );

      act(() => {
        result.current.startDetection(videoEl);
      });

      act(() => {
        rafCallback?.(Date.now());
      });

      // createFromOptions should have been called with numFaces: 2
      const [, opts] = mockCreateFromOptions.mock.calls[0]!;
      expect(opts.numFaces).toBe(2);
    });
  });
});
