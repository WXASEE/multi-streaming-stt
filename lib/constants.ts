// Audio configuration
export const AUDIO_CONFIG = {
  INPUT_SAMPLE_RATE: 48000,
  OUTPUT_SAMPLE_RATE: 16000,
  CHUNK_DURATION_MS: 100,
  CHANNEL_COUNT: 1,
  ENCODING: 'pcm' as const,
} as const;

// WebSocket configuration
export const WEBSOCKET_CONFIG = {
  BINARY_TYPE: 'arraybuffer' as const,
  PRESIGN_EXPIRES_IN: 300, // 5 minutes
  CONNECTION_TIMEOUT: 30000, // 30 seconds
} as const;

// UI configuration
export const UI_CONFIG = {
  DEFAULT_LANGUAGE: 'th-TH' as const,
  LANGUAGES: [
    { value: 'th-TH', label: 'th-TH (Thai)' },
    { value: 'en-US', label: 'en-US (English)' },
  ] as const,
  SPEAKER_COUNTS: [
    { value: 'auto', label: 'auto (automatic)' },
    { value: '2', label: '2' },
    { value: '3', label: '3' },
  ] as const,
  RMS_THRESHOLD: 0.01,
  LATENCY_SAMPLES: 50,
} as const;

// AWS Transcribe configuration
export const TRANSCRIBE_CONFIG = {
  SERVICE_NAME: 'transcribe',
  ENDPOINT_PATH: '/stream-transcription-websocket',
  DEFAULT_PORT: 8443,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NO_MICROPHONE: 'Microphone access denied or not available',
  WEBSOCKET_ERROR: 'WebSocket connection error',
  PRESIGN_ERROR: 'Failed to get presigned URL',
  AUDIO_STREAM_ERROR: 'Audio streaming error',
  TRANSCRIBE_ERROR: 'AWS Transcribe error',
} as const;