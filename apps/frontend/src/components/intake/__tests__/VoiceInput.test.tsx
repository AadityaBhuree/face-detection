import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceInput } from '../VoiceInput';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

vi.mock('@/hooks/useVoiceRecorder', () => ({
  useVoiceRecorder: vi.fn(() => ({
    isRecording: false,
    isSupported: true,
    isRequestingPermission: false,
    permissionError: null,
    recordingDurationSec: 0,
    audioLevel: 0,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    toggleRecording: vi.fn(),
  })),
}));

vi.mock('@/hooks/useTranscription', () => ({
  useTranscription: vi.fn(() => ({})),
}));

const defaultProps = {
  value: '',
  onChange: vi.fn(),
  onSend: vi.fn(),
  disabled: false,
  isComplete: false,
  sessionId: 'session-1',
};

describe('VoiceInput — accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('labels the text input for screen readers', () => {
    render(<VoiceInput {...defaultProps} />);
    expect(screen.getByRole('textbox', { name: /type your response/i })).toBeDefined();
  });

  it('exposes the mic button with an accessible name and pressed state', () => {
    render(<VoiceInput {...defaultProps} />);
    const mic = screen.getByRole('button', { name: /start voice input/i });
    expect(mic).toHaveAttribute('aria-pressed', 'false');
  });

  it('updates the mic label and pressed state while recording', () => {
    vi.mocked(useVoiceRecorder).mockReturnValueOnce({
      isRecording: true,
      isSupported: true,
      isRequestingPermission: false,
      permissionError: null,
      recordingDurationSec: 3,
      audioLevel: 0.5,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      toggleRecording: vi.fn(),
    });
    render(<VoiceInput {...defaultProps} />);
    expect(screen.getByRole('button', { name: /stop recording/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('announces recording status through a polite live region', () => {
    vi.mocked(useVoiceRecorder).mockReturnValueOnce({
      isRecording: true,
      isSupported: true,
      isRequestingPermission: false,
      permissionError: null,
      recordingDurationSec: 2,
      audioLevel: 0.5,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      toggleRecording: vi.fn(),
    });
    render(<VoiceInput {...defaultProps} />);
    expect(screen.getByRole('status')).toHaveTextContent(/recording started/i);
  });

  it('announces AI thinking through the live region', () => {
    render(<VoiceInput {...defaultProps} disabled />);
    expect(screen.getByRole('status')).toHaveTextContent(/ai is thinking/i);
  });

  it('labels the send button', async () => {
    const user = userEvent.setup();
    render(<VoiceInput {...defaultProps} />);
    await user.type(screen.getByRole('textbox'), 'Hello');
    expect(screen.getByRole('button', { name: /send message/i })).toBeDefined();
  });

  it('shows microphone permission errors as alerts', () => {
    vi.mocked(useVoiceRecorder).mockReturnValueOnce({
      isRecording: false,
      isSupported: true,
      isRequestingPermission: false,
      permissionError: 'Microphone permission denied',
      recordingDurationSec: 0,
      audioLevel: 0,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      toggleRecording: vi.fn(),
    });
    render(<VoiceInput {...defaultProps} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/microphone permission denied/i);
  });
});
