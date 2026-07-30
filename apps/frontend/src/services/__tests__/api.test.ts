import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  intakeApi,
  faceApi,
  dashboardApi,
  aiApi,
  ApiError,
} from '../api';

// ─── Mock fetch globally ──────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = mockFetch;
});

// ─── Helpers ──────────────────────────────────────────────────

function mockSuccessResponse(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data }),
  });
}

function mockErrorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () =>
      Promise.resolve({
        error: { code, message, details },
      }),
  });
}

function verifyFetchCall(
  expectedMethod: string,
  expectedUrl: string,
  expectedBody?: unknown,
) {
  expect(mockFetch).toHaveBeenCalledWith(
    expectedUrl,
    expect.objectContaining({
      method: expectedMethod,
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
      }),
      body: expectedBody ? JSON.stringify(expectedBody) : undefined,
    }),
  );
}

// ─── ApiError ─────────────────────────────────────────────────

describe('ApiError', () => {
  it('should create an error with status, code, message, and details', () => {
    const error = new ApiError(404, 'NOT_FOUND', 'Patient not found', {
      patientId: '123',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Patient not found');
    expect(error.details).toEqual({ patientId: '123' });
  });

  it('should create an error without details', () => {
    const error = new ApiError(500, 'SERVER_ERROR', 'Internal server error');

    expect(error.status).toBe(500);
    expect(error.code).toBe('SERVER_ERROR');
    expect(error.details).toBeUndefined();
  });
});

// ─── request (tested via login email) ───────────────────────────

describe('request internals', () => {
  it('should build URL with base path', async () => {
    mockSuccessResponse({ id: 'test' });

    await intakeApi.getSession('session-123');

    verifyFetchCall('GET', 'http://localhost:4000/intake/session/session-123');
  });

  it('should append query parameters to URL', async () => {
    mockSuccessResponse({ data: [], pagination: {} });

    await dashboardApi.getActiveSessions(2, 10);

    verifyFetchCall(
      'GET',
      'http://localhost:4000/dashboard/active-sessions?page=2&limit=10',
    );
  });

  it('should skip undefined parameters', async () => {
    mockSuccessResponse({ data: [], pagination: {} });

    await dashboardApi.getActiveSessions(1, 20);

    verifyFetchCall(
      'GET',
      'http://localhost:4000/dashboard/active-sessions?page=1&limit=20',
    );
  });

  it('should send POST with JSON body', async () => {
    mockSuccessResponse({ id: 'new-session', status: 'initiated' });

    await intakeApi.startSession({
      patientId: 'patient-1',
      deviceId: 'device-abc',
    });

    verifyFetchCall('POST', 'http://localhost:4000/intake/session', {
      patientId: 'patient-1',
      deviceId: 'device-abc',
    });
  });

  it('should throw ApiError on non-ok response', async () => {
    mockErrorResponse(404, 'NOT_FOUND', 'Session not found');

    await expect(intakeApi.getSession('bad-id')).rejects.toThrow(ApiError);
  });

  it('should throw ApiError with correct fields on error', async () => {
    mockErrorResponse(400, 'VALIDATION_ERROR', 'Invalid input', {
      field: 'name',
    });

    try {
      await intakeApi.startSession({
        patientId: null as unknown as string,
        deviceId: '',
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
      expect((error as ApiError).code).toBe('VALIDATION_ERROR');
      expect((error as ApiError).details).toEqual({ field: 'name' });
    }
  });

  it('should fallback to defaults when error response has no code/message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    try {
      await intakeApi.getSession('fail');
    } catch (error) {
      expect((error as ApiError).code).toBe('UNKNOWN_ERROR');
      expect((error as ApiError).message).toBe('An error occurred');
    }
  });
});

// ─── intakeApi ────────────────────────────────────────────────

describe('intakeApi', () => {
  it('startSession should POST to /intake/session', async () => {
    mockSuccessResponse({ id: 's1', status: 'initiated' });

    const result = await intakeApi.startSession({
      patientId: 'p1',
      deviceId: 'd1',
    });

    expect(result).toEqual({ id: 's1', status: 'initiated' });
    verifyFetchCall('POST', 'http://localhost:4000/intake/session', {
      patientId: 'p1',
      deviceId: 'd1',
    });
  });

  it('startSession should work without patientId', async () => {
    mockSuccessResponse({ id: 's2', status: 'initiated' });

    const result = await intakeApi.startSession({ deviceId: 'd2' });

    expect(result.id).toBe('s2');
  });

  it('getSession should GET session by id', async () => {
    mockSuccessResponse({ id: 's1', status: 'active', patient: {} });

    const result = await intakeApi.getSession('s1');

    expect(result).toHaveProperty('id', 's1');
    verifyFetchCall('GET', 'http://localhost:4000/intake/session/s1');
  });

  it('completeSession should POST to session complete endpoint', async () => {
    mockSuccessResponse({ brief: { summary: 'Done' } });

    const result = await intakeApi.completeSession('s1', {
      chiefComplaint: 'Headache',
    });

    expect(result).toHaveProperty('brief');
    verifyFetchCall(
      'POST',
      'http://localhost:4000/intake/session/s1/complete',
      { chiefComplaint: 'Headache' },
    );
  });

  it('getSessionStatus should GET status endpoint', async () => {
    mockSuccessResponse({ id: 's1', status: 'brief_generated' });

    const result = await intakeApi.getSessionStatus('s1');

    expect(result).toEqual({ id: 's1', status: 'brief_generated' });
    verifyFetchCall(
      'GET',
      'http://localhost:4000/intake/session/s1/status',
    );
  });
});

// ─── faceApi ──────────────────────────────────────────────────

describe('faceApi', () => {
  const mockVector = Array.from({ length: 512 }, (_, i) => i * 0.001);

  it('upsertEmbedding should POST to /face/embedding', async () => {
    mockSuccessResponse(undefined);

    await faceApi.upsertEmbedding({
      patientId: 'p1',
      vector: mockVector,
    });

    verifyFetchCall('POST', 'http://localhost:4000/face/embedding', {
      patientId: 'p1',
      vector: mockVector,
    });
  });

  it('searchByFace should POST to /face/search with defaults', async () => {
    mockSuccessResponse([{ patientId: 'p1', score: 0.95 }]);

    const result = await faceApi.searchByFace({
      vector: mockVector,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.score).toBe(0.95);
    verifyFetchCall('POST', 'http://localhost:4000/face/search', {
      vector: mockVector,
    });
  });

  it('searchByFace should pass optional threshold and limit', async () => {
    mockSuccessResponse([]);

    await faceApi.searchByFace({
      vector: mockVector,
      threshold: 0.8,
      limit: 5,
    });

    verifyFetchCall('POST', 'http://localhost:4000/face/search', {
      vector: mockVector,
      threshold: 0.8,
      limit: 5,
    });
  });

  it('searchWithDetails should return patient details', async () => {
    mockSuccessResponse({
      matches: [
        {
          patientId: 'p1',
          score: 0.92,
          patientName: 'Priya',
          dob: '1990-01-15',
          mobile: '+91-9876543210',
        },
      ],
      total: 1,
    });

    const result = await faceApi.searchWithDetails({
      vector: mockVector,
      threshold: 0.82,
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]!.patientName).toBe('Priya');
    expect(result.total).toBe(1);
  });

  it('registerPatient should POST to /face/register-patient', async () => {
    mockSuccessResponse({
      id: 'new-patient-1',
      name: 'Raj',
      message: 'Patient registered successfully',
    });

    const result = await faceApi.registerPatient({
      name: 'Raj',
      dob: '1992-05-15',
      mobile: '+91-9999999999',
      consent: true,
      embedding: mockVector,
    });

    expect(result.id).toBe('new-patient-1');
    expect(result.message).toContain('registered');
  });
});

// ─── dashboardApi ─────────────────────────────────────────────

describe('dashboardApi', () => {
  it('getLatestBrief should GET brief for patient', async () => {
    mockSuccessResponse({ id: 'brief-1', chiefComplaint: 'Fever' });

    const result = await dashboardApi.getLatestBrief('patient-1');

    expect(result).toHaveProperty('chiefComplaint', 'Fever');
    verifyFetchCall(
      'GET',
      'http://localhost:4000/dashboard/patient/patient-1/latest-brief',
    );
  });

  it('getActiveSessions should use default pagination', async () => {
    mockSuccessResponse({ data: [], pagination: { page: 1, limit: 20 } });

    const result = await dashboardApi.getActiveSessions();

    expect(result.pagination).toHaveProperty('page', 1);
    verifyFetchCall(
      'GET',
      'http://localhost:4000/dashboard/active-sessions?page=1&limit=20',
    );
  });

  it('getActiveSessions should use custom page and limit', async () => {
    mockSuccessResponse({ data: [], pagination: { page: 3, limit: 10 } });

    const result = await dashboardApi.getActiveSessions(3, 10);

    expect(result.pagination).toHaveProperty('page', 3);
    verifyFetchCall(
      'GET',
      'http://localhost:4000/dashboard/active-sessions?page=3&limit=10',
    );
  });

  it('getRecentBriefs should return paginated briefs', async () => {
    mockSuccessResponse({ data: [{}], pagination: { page: 1, limit: 20 } });

    const result = await dashboardApi.getRecentBriefs();

    expect(result.data).toHaveLength(1);
    verifyFetchCall(
      'GET',
      'http://localhost:4000/dashboard/recent-briefs?page=1&limit=20',
    );
  });

  it('markBriefReviewed should PATCH to brief review endpoint', async () => {
    mockSuccessResponse({ success: true, message: 'Marked as reviewed' });

    const result = await dashboardApi.markBriefReviewed('brief-1');

    expect(result.success).toBe(true);
    verifyFetchCall(
      'PATCH',
      'http://localhost:4000/brief/brief-1/review',
    );
  });

  it('getPatientHistory should GET history with pagination', async () => {
    mockSuccessResponse({ data: [], pagination: { page: 1, limit: 10 } });

    await dashboardApi.getPatientHistory('patient-1', 1, 10);

    verifyFetchCall(
      'GET',
      'http://localhost:4000/dashboard/patient/patient-1/history?page=1&limit=10',
    );
  });
});

// ─── aiApi ─────────────────────────────────────────────────────

describe('aiApi', () => {
  it('processIntake should POST to /ai/intake-agent', async () => {
    mockSuccessResponse({
      response: 'How long have you had the pain?',
      intakeComplete: false,
    });

    const result = await aiApi.processIntake({
      sessionId: 's1',
      patientContext: 'Patient has headache',
      conversationHistory: [
        { role: 'patient', content: 'I have a headache' },
      ],
      currentInput: 'For 3 days',
    });

    expect(result.response).toContain('How long');
    expect(result.intakeComplete).toBe(false);
    verifyFetchCall('POST', 'http://localhost:4000/ai/intake-agent', {
      sessionId: 's1',
      patientContext: 'Patient has headache',
      conversationHistory: [{ role: 'patient', content: 'I have a headache' }],
      currentInput: 'For 3 days',
    });
  });

  it('processIntake should detect when intake is complete', async () => {
    mockSuccessResponse({
      response: 'Thank you. I will now generate your clinical brief.',
      intakeComplete: true,
    });

    const result = await aiApi.processIntake({
      sessionId: 's1',
      patientContext: 'Patient has headache',
      conversationHistory: [],
      currentInput: 'No other symptoms',
    });

    expect(result.intakeComplete).toBe(true);
  });

  it('generateBrief should POST to /ai/brief', async () => {
    mockSuccessResponse({
      summary: 'Patient presents with headache',
      chiefComplaint: 'Headache',
      riskFlags: [],
    });

    const result = await aiApi.generateBrief({
      sessionId: 's1',
      patientId: 'p1',
      intakeData: { chiefComplaint: 'Headache' },
      transcript: 'Patient said...',
      patientHistory: 'No prior issues',
    });

    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('chiefComplaint');
    verifyFetchCall('POST', 'http://localhost:4000/ai/brief', {
      sessionId: 's1',
      patientId: 'p1',
      intakeData: { chiefComplaint: 'Headache' },
      transcript: 'Patient said...',
      patientHistory: 'No prior issues',
    });
  });
});
