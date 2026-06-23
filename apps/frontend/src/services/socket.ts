import { io, type Socket } from 'socket.io-client';
import { WS_BASE_URL } from '@/lib/utils';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(`${WS_BASE_URL}/ws`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
    });

    // Re-attach all registered listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((cb) => {
        this.socket?.on(event, cb);
      });
    });

    return this.socket;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  joinSession(sessionId: string): void {
    this.socket?.emit('join:session', sessionId);
  }

  leaveSession(sessionId: string): void {
    this.socket?.emit('leave:session', sessionId);
  }

  onSessionStatus(callback: (data: { status: string }) => void): () => void {
    return this.on('session:status', callback);
  }

  onTranscriptChunk(
    callback: (data: { text: string; isFinal: boolean }) => void,
  ): () => void {
    return this.on('transcript:chunk', callback);
  }

  onBriefReady(callback: (data: { briefId: string }) => void): () => void {
    return this.on('brief:ready', callback);
  }

  onFaceMatched(
    callback: (data: { patientId: string; patientName: string }) => void,
  ): () => void {
    return this.on('face:matched', callback);
  }

  /** Send a conversation turn (patient or AI message) via WebSocket */
  sendConversationTurn(
    sessionId: string,
    speaker: 'patient' | 'ai',
    text: string,
  ): void {
    this.socket?.emit('conversation:turn', {
      sessionId,
      speaker,
      text,
      timestamp: new Date().toISOString(),
    });
  }

  /** Send an audio chunk for Whisper transcription */
  sendAudioChunk(
    sessionId: string,
    data: ArrayBuffer,
    chunkIndex: number,
    isFinal: boolean,
  ): void {
    this.socket?.emit('audio:chunk', {
      sessionId,
      data,
      chunkIndex,
      isFinal,
      timestamp: Date.now(),
    });
  }

  onConversationTurn(
    callback: (data: { sessionId: string; speaker: string; text: string }) => void,
  ): () => void {
    return this.on('conversation:turn', callback);
  }

  onError(callback: (data: { code: string; message: string }) => void): () => void {
    return this.on('error', callback);
  }

  private on(event: string, callback: (...args: unknown[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    this.socket?.on(event, callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
      this.socket?.off(event, callback);
    };
  }
}

export const socketService = new SocketService();
