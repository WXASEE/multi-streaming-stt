import { EventStreamMarshaller } from '@aws-sdk/eventstream-marshaller';
import { toUtf8, fromUtf8 } from '@aws-sdk/util-utf8-browser';

const marshaller = new EventStreamMarshaller(toUtf8, fromUtf8);

export function encodeAudioEvent(pcm16: Int16Array) {
  return marshaller.marshall({
    headers: {
      ':message-type': { type: 'string', value: 'event' },
      ':event-type':   { type: 'string', value: 'AudioEvent' },
      ':content-type': { type: 'string', value: 'application/octet-stream' },
    },
    body: new Uint8Array(pcm16.buffer),
  });
}

export type TranscriptEvent = {
  Transcript?: { Results?: Array<{
    IsPartial?: boolean;
    Alternatives?: Array<{
      Transcript?: string;
      Items?: Array<{
        Type?: 'pronunciation' | 'punctuation' | 'speaker-change';
        Content?: string;
        StartTime?: number;
        EndTime?: number;
        Speaker?: string | number; // 実際は number が多い
      }>;
    }>;
  }>}
};

export function tryDecode(e: MessageEvent): TranscriptEvent | null {
  try {
    const msg = marshaller.unmarshall(new Uint8Array(e.data));
    const mtype = msg.headers[':message-type']?.value;
    const etype = msg.headers[':event-type']?.value;
    if (mtype === 'event' && etype === 'TranscriptEvent') {
      const payload = JSON.parse(fromUtf8(msg.body));
      return payload as TranscriptEvent;
    }
  } catch {}
  return null;
}