'use client';

import { useState } from 'react';
import { useFaceEmbedding } from '@/hooks/useFaceEmbedding';
import { useFaceStore } from '@/stores/face-store';
import { faceApi } from '@/services/api';

interface FaceRegistrationDialogProps {
  /** The face embedding from the detection pipeline */
  embedding: number[] | null;
  /** Called when registration is complete */
  onRegistered: (patientId: string, patientName: string) => void;
  /** Called when cancelled */
  onCancel: () => void;
  isOpen: boolean;
}

export function FaceRegistrationDialog({
  embedding,
  onRegistered,
  onCancel,
  isOpen,
}: FaceRegistrationDialogProps) {
  const { registerEmbedding, isSearching } = useFaceEmbedding();
  const livenessStatus = useFaceStore((s) => s.livenessStatus);

  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [mobile, setMobile] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  if (!isOpen) return null;

  async function handleRegister() {
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Patient name is required');
      return;
    }
    if (!dob) {
      setError('Date of birth is required');
      return;
    }
    if (!/^\+?[1-9]\d{9,14}$/.test(mobile)) {
      setError('Valid mobile number is required (e.g., +919876543210)');
      return;
    }
    if (!consent) {
      setError('Patient consent is required to store facial data');
      return;
    }
    if (!embedding) {
      setError('No face data captured. Please try again.');
      return;
    }
    if (livenessStatus !== 'verified') {
      setError('Liveness check not passed. Please complete the blink challenge.');
      return;
    }

    setIsRegistering(true);
    try {
      // Register patient via API client
      const result = await faceApi.registerPatient({
        name: name.trim(),
        dob,
        mobile,
        consent,
        embedding,
      });

      onRegistered(result.id, result.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ayutalk-100">
            <svg
              className="h-5 w-5 text-ayutalk-600"
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
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              New Patient Registration
            </h2>
            <p className="text-xs text-slate-500">
              No matching patient found. Register a new patient.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Priya Sharma"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-ayutalk-500 focus:outline-none focus:ring-1 focus:ring-ayutalk-500"
              disabled={isRegistering}
              autoFocus
            />
          </div>

          {/* DOB */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              Date of Birth
            </label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-ayutalk-500 focus:outline-none focus:ring-1 focus:ring-ayutalk-500"
              disabled={isRegistering}
            />
          </div>

          {/* Mobile */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              Mobile Number
            </label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="+919876543210"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-ayutalk-500 focus:outline-none focus:ring-1 focus:ring-ayutalk-500"
              disabled={isRegistering}
            />
          </div>

          {/* Consent */}
          <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-ayutalk-500 focus:ring-ayutalk-500"
              disabled={isRegistering}
            />
            <span className="text-xs leading-relaxed text-slate-600">
              I consent to the capture and storage of my facial data for
              identification purposes during clinic visits. This data will be
              encrypted and stored securely in accordance with applicable
              privacy regulations.
            </span>
          </label>

          {/* Liveness warning */}
          {livenessStatus !== 'verified' && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 ring-1 ring-amber-200">
              ⚠ Liveness check required. Please look at the camera and blink
              naturally when prompted.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 ring-1 ring-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex flex-1 items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            disabled={isRegistering}
          >
            Cancel
          </button>
          <button
            onClick={handleRegister}
            disabled={isRegistering || !consent || livenessStatus !== 'verified'}
            className="flex flex-1 items-center justify-center rounded-lg bg-ayutalk-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-ayutalk-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRegistering ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Registering...
              </span>
            ) : (
              'Register Patient'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
