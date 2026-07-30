import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from '../session-store';

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  // ─── Initial State ─────────────────────────────────────────

  it('should have correct initial state', () => {
    const state = useSessionStore.getState();

    expect(state.sessionId).toBeNull();
    expect(state.status).toBe('idle');
    expect(state.patient).toBeNull();
    expect(state.isFaceMatched).toBe(false);
    expect(state.isRecording).toBe(false);
    expect(state.isAiThinking).toBe(false);
    expect(state.transcripts).toEqual([]);
    expect(state.brief).toBeNull();
    expect(state.error).toBeNull();
  });

  // ─── setSessionId ─────────────────────────────────────────

  it('should set session id', () => {
    useSessionStore.getState().setSessionId('session-456');
    expect(useSessionStore.getState().sessionId).toBe('session-456');
  });

  // ─── setStatus ─────────────────────────────────────────────

  it('should set status to idle', () => {
    useSessionStore.getState().setStatus('idle');
    expect(useSessionStore.getState().status).toBe('idle');
  });

  it('should set status to face_matched', () => {
    useSessionStore.getState().setStatus('face_matched');
    expect(useSessionStore.getState().status).toBe('face_matched');
  });

  it('should set status to intake_in_progress', () => {
    useSessionStore.getState().setStatus('intake_in_progress');
    expect(useSessionStore.getState().status).toBe('intake_in_progress');
  });

  it('should set status to brief_generated', () => {
    useSessionStore.getState().setStatus('brief_generated');
    expect(useSessionStore.getState().status).toBe('brief_generated');
  });

  // ─── setPatient ────────────────────────────────────────────

  it('should set patient info', () => {
    const patient = {
      id: 'patient-789',
      name: 'Raj Kumar',
      dob: '1992-05-15',
      mobile: '+91-9876543210',
    };

    useSessionStore.getState().setPatient(patient);
    expect(useSessionStore.getState().patient).toEqual(patient);
  });

  // ─── setFaceMatched ────────────────────────────────────────

  it('should set isFaceMatched to true', () => {
    useSessionStore.getState().setFaceMatched(true);
    expect(useSessionStore.getState().isFaceMatched).toBe(true);
  });

  it('should set isFaceMatched to false', () => {
    useSessionStore.getState().setFaceMatched(false);
    expect(useSessionStore.getState().isFaceMatched).toBe(false);
  });

  // ─── setRecording ──────────────────────────────────────────

  it('should set isRecording to true', () => {
    useSessionStore.getState().setRecording(true);
    expect(useSessionStore.getState().isRecording).toBe(true);
  });

  it('should toggle isRecording', () => {
    useSessionStore.getState().setRecording(true);
    expect(useSessionStore.getState().isRecording).toBe(true);

    useSessionStore.getState().setRecording(false);
    expect(useSessionStore.getState().isRecording).toBe(false);
  });

  // ─── setIsAiThinking ───────────────────────────────────────

  it('should set isAiThinking to true', () => {
    useSessionStore.getState().setIsAiThinking(true);
    expect(useSessionStore.getState().isAiThinking).toBe(true);
  });

  // ─── addTranscript ─────────────────────────────────────────

  it('should add a transcript entry to the array', () => {
    const entry = {
      id: 'trans-1',
      speaker: 'patient' as const,
      text: 'I have a headache',
      timestamp: 1700000000000,
    };

    useSessionStore.getState().addTranscript(entry);
    expect(useSessionStore.getState().transcripts).toHaveLength(1);
    expect(useSessionStore.getState().transcripts[0]).toEqual(entry);
  });

  it('should append multiple transcript entries', () => {
    const entry1 = {
      id: 'trans-1',
      speaker: 'patient' as const,
      text: 'I have a headache',
      timestamp: 1700000000000,
    };

    const entry2 = {
      id: 'trans-2',
      speaker: 'ai' as const,
      text: 'How long have you had this headache?',
      timestamp: 1700000001000,
    };

    useSessionStore.getState().addTranscript(entry1);
    useSessionStore.getState().addTranscript(entry2);

    expect(useSessionStore.getState().transcripts).toHaveLength(2);
    expect(useSessionStore.getState().transcripts[0]).toEqual(entry1);
    expect(useSessionStore.getState().transcripts[1]).toEqual(entry2);
  });

  it('should preserve existing transcripts when adding', () => {
    const entry1 = {
      id: 'trans-1',
      speaker: 'patient' as const,
      text: 'First message',
      timestamp: 1700000000000,
    };

    const entry2 = {
      id: 'trans-2',
      speaker: 'system' as const,
      text: 'System message',
      timestamp: 1700000000500,
    };

    useSessionStore.getState().addTranscript(entry1);
    useSessionStore.getState().addTranscript(entry2);

    const transcripts = useSessionStore.getState().transcripts;
    expect(transcripts).toHaveLength(2);
    expect(transcripts[0]!.text).toBe('First message');
    expect(transcripts[1]!.text).toBe('System message');
  });

  // ─── setBrief ──────────────────────────────────────────────

  it('should set brief data', () => {
    const brief = {
      summary: 'Patient has headache',
      chiefComplaint: 'Headache',
      riskFlags: [],
    };

    useSessionStore.getState().setBrief(brief);
    expect(useSessionStore.getState().brief).toEqual(brief);
  });

  it('should update status to ready when brief is set', () => {
    useSessionStore.getState().setStatus('brief_generated');
    useSessionStore.getState().setBrief({ summary: 'test' });

    expect(useSessionStore.getState().status).toBe('ready');
  });

  // ─── setError ──────────────────────────────────────────────

  it('should set error message', () => {
    useSessionStore.getState().setError('Session timeout');
    expect(useSessionStore.getState().error).toBe('Session timeout');
  });

  it('should update status to error when error is set', () => {
    useSessionStore.getState().setError('Connection lost');
    expect(useSessionStore.getState().status).toBe('error');
  });

  // ─── reset ─────────────────────────────────────────────────

  it('should reset all state to initial values', () => {
    // Mutate several fields
    useSessionStore.getState().setSessionId('session-123');
    useSessionStore.getState().setStatus('intake_in_progress');
    useSessionStore.getState().setPatient({
      id: 'patient-1',
      name: 'Test',
      dob: '2000-01-01',
      mobile: '+91-9999999999',
    });
    useSessionStore.getState().setRecording(true);
    useSessionStore.getState().addTranscript({
      id: 't1',
      speaker: 'patient',
      text: 'Hello',
      timestamp: Date.now(),
    });

    // Reset
    useSessionStore.getState().reset();

    // Verify all fields are back to defaults
    const state = useSessionStore.getState();
    expect(state.sessionId).toBeNull();
    expect(state.status).toBe('idle');
    expect(state.patient).toBeNull();
    expect(state.isFaceMatched).toBe(false);
    expect(state.isRecording).toBe(false);
    expect(state.isAiThinking).toBe(false);
    expect(state.transcripts).toEqual([]);
    expect(state.brief).toBeNull();
    expect(state.error).toBeNull();
  });
});
