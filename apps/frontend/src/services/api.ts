import { API_BASE_URL } from '@/lib/utils';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | undefined>;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, params } = options;

  let url = `${API_BASE_URL}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) url += `?${queryString}`;
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      json?.error?.code ?? 'UNKNOWN_ERROR',
      json?.error?.message ?? 'An error occurred',
      json?.error?.details,
    );
  }

  return json.data as T;
}

// ─── Intake API ────────────────────────────────────────────────

export const intakeApi = {
  startSession: (data: { patientId?: string | null; deviceId: string }) =>
    request<{ id: string; status: string }>('/intake/session', {
      method: 'POST',
      body: data,
    }),

  getSession: (id: string) =>
    request<Record<string, unknown>>(`/intake/session/${id}`),

  completeSession: (id: string, intakeData: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/intake/session/${id}/complete`, {
      method: 'POST',
      body: intakeData,
    }),

  getSessionStatus: (id: string) =>
    request<{ id: string; status: string }>(`/intake/session/${id}/status`),
};

// ─── Face API ──────────────────────────────────────────────────

export const faceApi = {
  upsertEmbedding: (data: { patientId: string; vector: number[] }) =>
    request<void>('/face/embedding', {
      method: 'POST',
      body: data,
    }),

  searchByFace: (data: { vector: number[]; threshold?: number; limit?: number }) =>
    request<Array<{ patientId: string; score: number }>>('/face/search', {
      method: 'POST',
      body: data,
    }),

  searchWithDetails: (data: {
    vector: number[];
    threshold?: number;
    limit?: number;
  }) =>
    request<{
      matches: Array<{
        patientId: string;
        score: number;
        patientName: string;
        dob: string;
        mobile: string;
      }>;
      total: number;
    }>('/face/search-with-details', {
      method: 'POST',
      body: data,
    }),

  registerPatient: (data: {
    name: string;
    dob: string;
    mobile: string;
    consent: boolean;
    embedding: number[];
  }) =>
    request<{ id: string; name: string; message: string }>(
      '/face/register-patient',
      {
        method: 'POST',
        body: data,
      },
    ),
};

// ─── Dashboard API ─────────────────────────────────────────────

export const dashboardApi = {
  getLatestBrief: (patientId: string) =>
    request<Record<string, unknown>>(`/dashboard/patient/${patientId}/latest-brief`),

  getActiveSessions: (page = 1, limit = 20) =>
    request<{ data: unknown[]; pagination: Record<string, unknown> }>(
      '/dashboard/active-sessions',
      { params: { page, limit } },
    ),

  getRecentBriefs: (page = 1, limit = 20) =>
    request<{ data: unknown[]; pagination: Record<string, unknown> }>(
      '/dashboard/recent-briefs',
      { params: { page, limit } },
    ),

  markBriefReviewed: (briefId: string) =>
    request<{ success: boolean; message: string }>(`/brief/${briefId}/review`, {
      method: 'PATCH',
    }),

  getPatientHistory: (patientId: string, page = 1, limit = 10) =>
    request<{ data: unknown[]; pagination: Record<string, unknown> }>(
      `/dashboard/patient/${patientId}/history`,
      { params: { page, limit } },
    ),
};

// ─── AI API ────────────────────────────────────────────────────

export const aiApi = {
  processIntake: (data: {
    sessionId: string;
    patientContext: string;
    conversationHistory: Array<{ role: string; content: string }>;
    currentInput: string;
  }) =>
    request<{ response: string; intakeComplete: boolean }>('/ai/intake-agent', {
      method: 'POST',
      body: data,
    }),

  generateBrief: (data: {
    sessionId: string;
    patientId: string;
    intakeData: Record<string, unknown>;
    transcript: string;
    patientHistory: string;
  }) =>
    request<Record<string, unknown>>('/ai/brief', {
      method: 'POST',
      body: data,
    }),
};

export { ApiError };
