import { EventStreamMarshaller } from '@aws-sdk/eventstream-marshaller';
import { toUtf8, fromUtf8 } from '@aws-sdk/util-utf8-browser';

const marshaller = new EventStreamMarshaller(toUtf8, fromUtf8);

export function encodeAudioEvent(pcm16: Int16Array) {
  // Convert Int16Array byte data to Uint8Array correctly
  const uint8Array = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  
  return marshaller.marshall({
    headers: {
      ':message-type': { type: 'string', value: 'event' },
      ':event-type':   { type: 'string', value: 'AudioEvent' },
      ':content-type': { type: 'string', value: 'application/octet-stream' },
    },
    body: uint8Array,
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
        Speaker?: string | number; // Usually a number
      }>;
    }>;
  }>}
};

export function tryDecode(e: MessageEvent): TranscriptEvent | null {
  try {
    const msg = marshaller.unmarshall(new Uint8Array(e.data));
    const mtype = msg.headers[':message-type']?.value;
    const etype = msg.headers[':event-type']?.value;
    
    // Catch error events
    if (mtype === 'exception') {
      const exceptionType = msg.headers[':exception-type']?.value;
      let errorMessage = msg.headers[':message']?.value;
      
      // If message is not in headers, get from body
      if (!errorMessage && msg.body) {
        try {
          // If body is Uint8Array, convert to string
          const decoder = new TextDecoder('utf-8');
          errorMessage = decoder.decode(msg.body);
        } catch {
          // Try to parse as JSON
          try {
            const decoder = new TextDecoder('utf-8');
            const parsed = JSON.parse(decoder.decode(msg.body));
            errorMessage = parsed.message || parsed.Message || JSON.stringify(parsed);
          } catch {
            errorMessage = 'Unable to parse error message';
          }
        }
      }
      
      return null;
    }
    
    if (mtype === 'event' && etype === 'TranscriptEvent') {
      try {
        let payload;
        
        // If Uint8Array, decode to string and parse
        if (msg.body instanceof Uint8Array) {
          // Use TextDecoder to decode directly
          const decoder = new TextDecoder('utf-8');
          const bodyStr = decoder.decode(msg.body);
          
          // Return empty TranscriptEvent if empty
          if (!bodyStr || bodyStr.trim() === '') {
            return { Transcript: { Results: [] } };
          }
          
          payload = JSON.parse(bodyStr);
        }
        // If already an object
        else if (typeof msg.body === 'object') {
          payload = msg.body;
        }
        // If a string
        else if (typeof msg.body === 'string') {
          payload = JSON.parse(msg.body);
        }
        // Other types
        else {
          return null;
        }
        
        return payload as TranscriptEvent;
      } catch (parseErr) {
        return null;
      }
    }
  } catch (err) {
  }
  return null;
}