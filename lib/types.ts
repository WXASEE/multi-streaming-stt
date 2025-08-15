// WebSocket state types
export type WebSocketState = 0 | 1 | 2 | 3; // CONNECTING | OPEN | CLOSING | CLOSED

// Transcript segment type
export interface TranscriptSegment {
  speaker: string;
  text: string;
  start?: number;
  end?: number;
}

// Debug information type
export interface DebugInfo {
  region: string;
  sessionId: string;
  expiresAt: number;
  inRate: number;
  outRate: number;
  chunksSent: number;
  eventsRecv: number;
  lastError: string | null;
  avgLatencyMs: number;
  currentRms: number;
  rawToMapped: Record<string, string>;
}

// Presign API response type
export interface PresignResponse {
  url?: string;
  sessionId?: string;
  region?: string;
  expiresAt?: number;
  error?: string;
}

// Language options
export type LanguageCode = 'th-TH' | 'en-US';

// Speaker count options
export type SpeakerCount = 'auto' | '2' | '3';

// Transcription settings
export interface TranscriptionSettings {
  language: LanguageCode;
  diarization: boolean;
  stabilize: boolean;
  showPartial: boolean;
  expectedSpeakers: SpeakerCount;
  recordLocally: boolean;
}

// WebSocket hook return type
export interface UseWebSocketTranscription {
  segments: TranscriptSegment[];
  isStreaming: boolean;
  wsState: WebSocketState;
  debugInfo: DebugInfo;
  start: () => Promise<void>;
  stop: () => void;
  hasRecording: boolean;
  downloadRecording: () => void;
}

// AWS Transcribe Item type (extended from eventstream.ts)
export interface TranscribeItem {
  Type?: 'pronunciation' | 'punctuation' | 'speaker-change';
  Content?: string;
  StartTime?: number;
  EndTime?: number;
  Speaker?: string | number;
}

// AWS Transcribe Result type
export interface TranscribeResult {
  IsPartial?: boolean;
  Alternatives?: Array<{
    Transcript?: string;
    Items?: TranscribeItem[];
  }>;
}
