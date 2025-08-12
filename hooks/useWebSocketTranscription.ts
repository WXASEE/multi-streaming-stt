'use client';

import { useCallback, useRef, useState } from 'react';
import MicrophoneStream from 'microphone-stream';
import { v4 as uuidv4 } from 'uuid';
import { micPcm16Stream, rmsLevel } from '@/lib/audio';
import { encodeAudioEvent, tryDecode, TranscriptEvent } from '@/lib/eventstream';
import { SpeakerMapper } from '@/lib/speaker-map';
import { 
  AUDIO_CONFIG, 
  WEBSOCKET_CONFIG, 
  UI_CONFIG, 
  ERROR_MESSAGES 
} from '@/lib/constants';
import type {
  TranscriptSegment,
  DebugInfo,
  TranscriptionSettings,
  UseWebSocketTranscription,
  WebSocketState,
  PresignResponse,
} from '@/lib/types';

export function useWebSocketTranscription(
  settings: TranscriptionSettings
): UseWebSocketTranscription {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [isStreaming, setStreaming] = useState(false);
  const [wsState, setWsState] = useState<WebSocketState>(WebSocket.CLOSED);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    region: '',
    sessionId: '',
    expiresAt: 0,
    inRate: AUDIO_CONFIG.INPUT_SAMPLE_RATE,
    outRate: AUDIO_CONFIG.OUTPUT_SAMPLE_RATE,
    chunksSent: 0,
    eventsRecv: 0,
    lastError: null,
    avgLatencyMs: 0,
    currentRms: 0,
    rawToMapped: {},
  });

  const micRef = useRef<MicrophoneStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mapperRef = useRef(new SpeakerMapper(settings.expectedSpeakers));
  const lastSendTimeRef = useRef<number[]>([]);
  // Recording refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingFileName, setRecordingFileName] = useState<string>('');
  const objectUrlRef = useRef<string | null>(null);
  const lastSessionIdRef = useRef<string>('');


  const pushLatency = useCallback((ts: number) => {
    const arr = lastSendTimeRef.current;
    arr.push(ts);
    if (arr.length > UI_CONFIG.LATENCY_SAMPLES) arr.shift();
  }, []);

  const calcAvgLatency = useCallback((arrivalTs: number) => {
    const arr = lastSendTimeRef.current;
    if (!arr.length) return;
    const last = arr[arr.length - 1];
    const ms = Math.max(0, arrivalTs - last);
    setDebugInfo(prev => ({ 
      ...prev,
      avgLatencyMs: Math.round((prev.avgLatencyMs * 0.8) + (ms * 0.2)) 
    }));
  }, []);

  const processTranscriptEvent = useCallback((payload: TranscriptEvent) => {
    const results = payload.Transcript?.Results ?? [];
    
    for (const result of results) {
      const alt = result.Alternatives?.[0];
      if (!alt) continue;

      // Process partial results
      if (result.IsPartial) {
        if (!settings.showPartial) continue;
        
        const transcript = alt.Transcript;
        if (transcript && transcript.trim()) {
          const mapped = mapperRef.current.mapLabel('S0');
          setSegments(s => {
            const lastIdx = s.length - 1;
            if (lastIdx >= 0 && s[lastIdx].text.startsWith('[partial]')) {
              return [...s.slice(0, lastIdx), { 
                speaker: mapped, 
                text: `[partial] ${transcript}` 
              }];
            }
            return [...s, { speaker: mapped, text: `[partial] ${transcript}` }];
          });
        }
        continue;
      }

      // Skip empty transcripts
      if (!alt.Transcript || alt.Transcript.trim() === '') continue;

      // Handle no speaker diarization
      if (!alt.Items || alt.Items.length === 0) {
        const mapped = mapperRef.current.mapLabel('S0');
        const transcript = alt.Transcript || '';
        setSegments(s => [...s, { speaker: mapped, text: transcript }]);
        continue;
      }

      // Process items with speaker diarization
      let currentRaw = 'S0';
      let buffer: string[] = [];
      
      const flush = () => {
        if (!buffer.length) return;
        const mapped = mapperRef.current.mapLabel(currentRaw);
        const text = buffer.join('');
        setDebugInfo(prev => ({
          ...prev,
          rawToMapped: { ...prev.rawToMapped, [currentRaw]: mapped }
        }));
        setSegments(s => [...s, { speaker: mapped, text }]);
        buffer = [];
      };

      for (const item of alt.Items ?? []) {
        if (item.Type === 'speaker-change') {
          flush();
        } else if (item.Type === 'pronunciation') {
          if (typeof item.Speaker !== 'undefined' && item.Speaker !== null) {
            const raw = String(item.Speaker).startsWith('spk_') 
              ? String(item.Speaker).replace(/^spk_/, 'S') 
              : `S${item.Speaker}`;
            if (raw !== currentRaw) {
              flush();
              currentRaw = raw;
            }
          }
          if (item.Content) buffer.push(item.Content);
        } else if (item.Type === 'punctuation') {
          if (item.Content) buffer.push(item.Content);
        }
      }
      flush();
    }
  }, [settings.showPartial]);

  const stop = useCallback(() => {
    try {
      micRef.current?.stop();
      micRef.current = null;
      wsRef.current?.close();
      wsRef.current = null;

      // Stop MediaRecorder and underlying MediaStream tracks
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {}

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => {
          try { t.stop(); } catch {}
        });
        mediaStreamRef.current = null;
      }
    } finally {
      setStreaming(false);
    }
  }, []);

  const downloadRecording = useCallback(() => {
    if (!recordingBlob) return;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    const url = URL.createObjectURL(recordingBlob);
    objectUrlRef.current = url;
    const a = document.createElement('a');
    a.href = url;
    a.download = recordingFileName || `recording-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    }, 10000);
  }, [recordingBlob, recordingFileName]);

  const start = useCallback(async () => {
    try {
      setSegments([]);
      setStreaming(true);
      mapperRef.current.reset();
      mapperRef.current.setMaxSlots(settings.expectedSpeakers);
      // reset previous recording
      setRecordingBlob(null);
      setRecordingFileName('');
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }

      // Get presigned URL
      const sessionId = uuidv4();
      lastSessionIdRef.current = sessionId;
      const params = new URLSearchParams({
        language: settings.language,
        diarization: String(settings.diarization),
        stabilize: String(settings.stabilize),
        sampleRate: String(AUDIO_CONFIG.OUTPUT_SAMPLE_RATE),
        sessionId
      });

      const response = await fetch(`/api/transcribe/presign?${params}`);
      const data: PresignResponse = await response.json();
      
      if (data.error) throw new Error(data.error);
      if (!data.url) throw new Error(ERROR_MESSAGES.PRESIGN_ERROR);

      const { url, region, expiresAt } = data;
      setDebugInfo(prev => ({ ...prev, region: region || '', sessionId, expiresAt: expiresAt || 0, lastError: null }));

      // Start microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: AUDIO_CONFIG.CHANNEL_COUNT, 
          noiseSuppression: true, 
          echoCancellation: true 
        } 
      });
      
      const mic = new MicrophoneStream();
      mic.setStream(stream);
      micRef.current = mic;
      mediaStreamRef.current = stream;
      setDebugInfo(prev => ({ ...prev, inRate: (mic as any).context?.sampleRate ?? AUDIO_CONFIG.INPUT_SAMPLE_RATE }));

      // Begin local recording using MediaRecorder (optional)
      if (settings.recordLocally) {
        try {
          const supportedTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
          ];
          let mimeType = '';
          for (const t of supportedTypes) {
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
          }
          const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
          recordedChunksRef.current = [];
          recorder.ondataavailable = (e: BlobEvent) => {
            if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
          };
          recorder.onstop = () => {
            try {
              const mt = recorder.mimeType || 'audio/webm';
              const blob = new Blob(recordedChunksRef.current, { type: mt });
              recordedChunksRef.current = [];
              const ext = mt.includes('mp4') ? 'm4a' : (mt.includes('ogg') ? 'ogg' : 'webm');
              const fname = `recording-${lastSessionIdRef.current}-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
              setRecordingBlob(blob);
              setRecordingFileName(fname);
            } catch {}
          };
          recorder.start(1000); // collect data every 1s
          mediaRecorderRef.current = recorder;
        } catch {
          // Ignore recording errors; transcription continues
        }
      }

      // WebSocket connection
      const ws = new WebSocket(url);
      ws.binaryType = WEBSOCKET_CONFIG.BINARY_TYPE;
      wsRef.current = ws;
      setWsState(ws.readyState as WebSocketState);

      let isClosing = false;

      ws.onopen = () => {
        setWsState(ws.readyState as WebSocketState);
        
        // Start microphone stream
        (async () => {
          try {
            for await (const pcm16 of micPcm16Stream(mic)) {
              if (isClosing || ws.readyState !== WebSocket.OPEN) break;
              
              const audioEvent = encodeAudioEvent(pcm16);
              ws.send(audioEvent);
              
              const rms = rmsLevel(pcm16);
              pushLatency(performance.now());
              setDebugInfo(prev => ({ 
                ...prev,
                chunksSent: prev.chunksSent + 1, 
                currentRms: rms 
              }));
            }
            
            // Send end signal
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(encodeAudioEvent(new Int16Array(0)));
              ws.close();
            }
          } catch (err) {
            setDebugInfo(prev => ({ ...prev, lastError: String(err) }));
          }
        })();
      };

      ws.onmessage = (e) => {
        setWsState(ws.readyState as WebSocketState);
        const payload = tryDecode(e) as TranscriptEvent | null;
        if (!payload) return;
        
        setDebugInfo(prev => ({ ...prev, eventsRecv: prev.eventsRecv + 1 }));
        calcAvgLatency(performance.now());
        processTranscriptEvent(payload);
      };

      ws.onerror = () => {
        setWsState(ws.readyState as WebSocketState);
        setDebugInfo(prev => ({ ...prev, lastError: ERROR_MESSAGES.WEBSOCKET_ERROR }));
      };

      ws.onclose = (e) => {
        isClosing = true;
        setWsState(ws.readyState as WebSocketState);
        
        if (e.code === 1000 && e.reason.includes('exception')) {
          setDebugInfo(prev => ({ ...prev, lastError: `${ERROR_MESSAGES.TRANSCRIBE_ERROR}: ${e.reason}` }));
        } else if (e.code !== 1000) {
          setDebugInfo(prev => ({ ...prev, lastError: `WebSocket closed with code ${e.code}: ${e.reason}` }));
        }
        
        stop();
      };
    } catch (e: any) {
      setDebugInfo(prev => ({ ...prev, lastError: e?.message ?? String(e) }));
      setStreaming(false);
      stop();
    }
  }, [settings, pushLatency, calcAvgLatency, processTranscriptEvent, stop]);

  return {
    segments,
    isStreaming,
    wsState,
    debugInfo,
    start,
    stop,
    hasRecording: !!recordingBlob,
    downloadRecording,
  };
}
