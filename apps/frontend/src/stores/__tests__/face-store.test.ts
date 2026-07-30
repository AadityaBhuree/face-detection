import { describe, it, expect, beforeEach } from 'vitest';
import { useFaceStore } from '../face-store';

describe('useFaceStore', () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useFaceStore.getState().reset();
  });

  // ─── Initial State ─────────────────────────────────────────

  it('should have correct initial state', () => {
    const state = useFaceStore.getState();

    expect(state.status).toBe('idle');
    expect(state.isCameraActive).toBe(false);
    expect(state.faces).toEqual([]);
    expect(state.confidence).toBe(0);
    expect(state.fps).toBe(0);
    expect(state.embedding).toBeNull();
    expect(state.matchResult).toBeNull();
    expect(state.livenessStatus).toBe('idle');
    expect(state.livenessEar).toBe(0);
    expect(state.livenessBlinkCount).toBe(0);
    expect(state.isAlive).toBe(false);
    expect(state.error).toBeNull();
  });

  // ─── setStatus ─────────────────────────────────────────────

  it('should set status to detecting', () => {
    useFaceStore.getState().setStatus('detecting');
    expect(useFaceStore.getState().status).toBe('detecting');
  });

  it('should set status to matched', () => {
    useFaceStore.getState().setStatus('matched');
    expect(useFaceStore.getState().status).toBe('matched');
  });

  it('should set status to liveness_check', () => {
    useFaceStore.getState().setStatus('liveness_check');
    expect(useFaceStore.getState().status).toBe('liveness_check');
  });

  // ─── setCameraActive ───────────────────────────────────────

  it('should set camera to active', () => {
    useFaceStore.getState().setCameraActive(true);
    expect(useFaceStore.getState().isCameraActive).toBe(true);
  });

  it('should set camera to inactive', () => {
    useFaceStore.getState().setCameraActive(false);
    expect(useFaceStore.getState().isCameraActive).toBe(false);
  });

  // ─── setFaces ──────────────────────────────────────────────

  it('should set faces array', () => {
    const mockFaces = [
      {
        id: 'face-1',
        box: { x: 10, y: 20, width: 100, height: 150 },
        landmarks: [{ x: 0.1, y: 0.2, z: 0.3 }],
        confidence: 0.95,
      },
    ];

    useFaceStore.getState().setFaces(mockFaces);
    expect(useFaceStore.getState().faces).toEqual(mockFaces);
  });

  it('should auto-update confidence from first face', () => {
    const mockFaces = [
      {
        id: 'face-1',
        box: { x: 10, y: 20, width: 100, height: 150 },
        landmarks: [{ x: 0.1, y: 0.2, z: 0.3 }],
        confidence: 0.95,
      },
      {
        id: 'face-2',
        box: { x: 30, y: 40, width: 80, height: 120 },
        landmarks: [{ x: 0.3, y: 0.4, z: 0.5 }],
        confidence: 0.82,
      },
    ];

    useFaceStore.getState().setFaces(mockFaces);
    expect(useFaceStore.getState().confidence).toBe(0.95);
  });

  it('should set confidence to 0 when faces array is empty', () => {
    // First set some confidence
    useFaceStore.getState().setConfidence(0.88);
    expect(useFaceStore.getState().confidence).toBe(0.88);

    // Then clear faces — confidence should reset to 0
    useFaceStore.getState().setFaces([]);
    expect(useFaceStore.getState().confidence).toBe(0);
  });

  // ─── setConfidence ─────────────────────────────────────────

  it('should set confidence directly', () => {
    useFaceStore.getState().setConfidence(0.75);
    expect(useFaceStore.getState().confidence).toBe(0.75);
  });

  // ─── setFps ────────────────────────────────────────────────

  it('should set fps', () => {
    useFaceStore.getState().setFps(30);
    expect(useFaceStore.getState().fps).toBe(30);
  });

  it('should set fps to 0', () => {
    useFaceStore.getState().setFps(0);
    expect(useFaceStore.getState().fps).toBe(0);
  });

  // ─── setEmbedding ──────────────────────────────────────────

  it('should set embedding', () => {
    const embedding = [0.1, 0.2, 0.3, 0.4];
    useFaceStore.getState().setEmbedding(embedding);
    expect(useFaceStore.getState().embedding).toEqual(embedding);
  });

  it('should set embedding to null', () => {
    useFaceStore.getState().setEmbedding(null);
    expect(useFaceStore.getState().embedding).toBeNull();
  });

  // ─── setMatchResult ────────────────────────────────────────

  it('should set match result with patient info', () => {
    const match = {
      patientId: 'patient-123',
      score: 0.92,
      patientName: 'Priya Sharma',
      isNewPatient: false,
    };

    useFaceStore.getState().setMatchResult(match);
    expect(useFaceStore.getState().matchResult).toEqual(match);
  });

  it('should set match result for new patient', () => {
    const match = {
      patientId: 'new-patient',
      score: 0,
      isNewPatient: true,
    };

    useFaceStore.getState().setMatchResult(match);
    expect(useFaceStore.getState().matchResult).toEqual(match);
  });

  it('should clear match result to null', () => {
    useFaceStore.getState().setMatchResult(null);
    expect(useFaceStore.getState().matchResult).toBeNull();
  });

  // ─── setLivenessStatus ─────────────────────────────────────

  it('should set liveness status to waiting_for_blink', () => {
    useFaceStore.getState().setLivenessStatus('waiting_for_blink');
    expect(useFaceStore.getState().livenessStatus).toBe('waiting_for_blink');
  });

  it('should set liveness status to verified', () => {
    useFaceStore.getState().setLivenessStatus('verified');
    expect(useFaceStore.getState().livenessStatus).toBe('verified');
  });

  it('should set liveness status to failed', () => {
    useFaceStore.getState().setLivenessStatus('failed');
    expect(useFaceStore.getState().livenessStatus).toBe('failed');
  });

  // ─── setLivenessEar ────────────────────────────────────────

  it('should set liveness EAR value', () => {
    useFaceStore.getState().setLivenessEar(0.28);
    expect(useFaceStore.getState().livenessEar).toBe(0.28);
  });

  // ─── setLivenessBlinkCount ─────────────────────────────────

  it('should set blink count', () => {
    useFaceStore.getState().setLivenessBlinkCount(2);
    expect(useFaceStore.getState().livenessBlinkCount).toBe(2);
  });

  it('should increment blink count', () => {
    useFaceStore.getState().setLivenessBlinkCount(1);
    useFaceStore.getState().setLivenessBlinkCount(2);
    expect(useFaceStore.getState().livenessBlinkCount).toBe(2);
  });

  // ─── setIsAlive ────────────────────────────────────────────

  it('should set isAlive to true', () => {
    useFaceStore.getState().setIsAlive(true);
    expect(useFaceStore.getState().isAlive).toBe(true);
  });

  // ─── setError ──────────────────────────────────────────────

  it('should set error message', () => {
    useFaceStore.getState().setError('Camera access denied');
    expect(useFaceStore.getState().error).toBe('Camera access denied');
  });

  it('should set status to error when error is set', () => {
    useFaceStore.getState().setError('Something went wrong');
    expect(useFaceStore.getState().status).toBe('error');
  });

  it('should reset status to idle when error is cleared', () => {
    // First set error (status becomes 'error')
    useFaceStore.getState().setError('Some error');
    expect(useFaceStore.getState().status).toBe('error');

    // Clear error — status should go back to 'idle'
    useFaceStore.getState().setError(null);
    expect(useFaceStore.getState().error).toBeNull();
    expect(useFaceStore.getState().status).toBe('idle');
  });

  // ─── reset ─────────────────────────────────────────────────

  it('should reset all state to initial values', () => {
    // Mutate several fields
    useFaceStore.getState().setStatus('detecting');
    useFaceStore.getState().setCameraActive(true);
    useFaceStore.getState().setFps(30);
    useFaceStore.getState().setIsAlive(true);

    // Reset
    useFaceStore.getState().reset();

    // Verify all fields are back to defaults
    const state = useFaceStore.getState();
    expect(state.status).toBe('idle');
    expect(state.isCameraActive).toBe(false);
    expect(state.fps).toBe(0);
    expect(state.isAlive).toBe(false);
    expect(state.faces).toEqual([]);
    expect(state.embedding).toBeNull();
    expect(state.matchResult).toBeNull();
    expect(state.error).toBeNull();
  });
});
