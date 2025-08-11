import { EventStreamMarshaller } from '@aws-sdk/eventstream-marshaller';
import { toUtf8, fromUtf8 } from '@aws-sdk/util-utf8-browser';

const marshaller = new EventStreamMarshaller(toUtf8, fromUtf8);

export function encodeAudioEvent(pcm16: Int16Array) {
  // Int16ArrayのバイトデータをUint8Arrayに正しく変換
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
    
    // エラーイベントをキャッチ
    if (mtype === 'exception') {
      const exceptionType = msg.headers[':exception-type']?.value;
      let errorMessage = msg.headers[':message']?.value;
      
      // メッセージがヘッダーにない場合、bodyから取得
      if (!errorMessage && msg.body) {
        try {
          // bodyがUint8Arrayの場合、文字列に変換
          errorMessage = fromUtf8(msg.body);
        } catch {
          // JSONとしてパースを試みる
          try {
            const parsed = JSON.parse(fromUtf8(msg.body));
            errorMessage = parsed.message || parsed.Message || JSON.stringify(parsed);
          } catch {
            errorMessage = 'Unable to parse error message';
          }
        }
      }
      
      console.error('AWS Transcribe Exception:', exceptionType);
      console.error('Error Message:', errorMessage);
      return null;
    }
    
    if (mtype === 'event' && etype === 'TranscriptEvent') {
      try {
        let payload;
        
        // Uint8Arrayの場合は文字列にデコードしてパース
        if (msg.body instanceof Uint8Array) {
          // TextDecoderを使って直接デコード
          const decoder = new TextDecoder('utf-8');
          const bodyStr = decoder.decode(msg.body);
          // console.log('Decoded TranscriptEvent:', bodyStr);  // デバッグ用
          
          // 空の場合は空のTranscriptEventを返す
          if (!bodyStr || bodyStr.trim() === '') {
            return { Transcript: { Results: [] } };
          }
          
          payload = JSON.parse(bodyStr);
        }
        // 既にオブジェクトの場合
        else if (typeof msg.body === 'object') {
          payload = msg.body;
        }
        // 文字列の場合
        else if (typeof msg.body === 'string') {
          payload = JSON.parse(msg.body);
        }
        // その他の型の場合
        else {
          console.warn('Unexpected body type:', typeof msg.body);
          return null;
        }
        
        return payload as TranscriptEvent;
      } catch (parseErr) {
        console.error('Failed to parse TranscriptEvent:', parseErr);
        console.error('Body content:', msg.body);
        return null;
      }
    }
  } catch (err) {
    console.error('Failed to decode message:', err);
  }
  return null;
}