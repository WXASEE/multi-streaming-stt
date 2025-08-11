#!/usr/bin/env node

const { SignatureV4 } = require('@aws-sdk/signature-v4');
const { Sha256 } = require('@aws-crypto/sha256-js');
const { HttpRequest } = require('@aws-sdk/protocol-http');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');
const { EventStreamMarshaller } = require('@aws-sdk/eventstream-marshaller');
const { toUtf8, fromUtf8 } = require('@aws-sdk/util-utf8-browser');
const WebSocket = require('ws');

const marshaller = new EventStreamMarshaller(toUtf8, fromUtf8);

function encodeAudioEvent(pcm16) {
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

async function testWithAudio() {
  try {
    console.log('Testing AWS Transcribe with audio data...\n');
    
    const region = process.env.AWS_REGION || 'ap-northeast-1';
    const credentials = await defaultProvider()();
    
    console.log('Creating presigned URL...');
    const signer = new SignatureV4({
      service: 'transcribe',
      region,
      credentials,
      sha256: Sha256,
    });

    const request = new HttpRequest({
      protocol: 'https:',
      method: 'GET',
      hostname: `transcribestreaming.${region}.amazonaws.com`,
      port: 8443,
      path: '/stream-transcription-websocket',
      query: {
        'language-code': 'ja-JP',
        'media-encoding': 'pcm',
        'sample-rate': '16000',
        'show-speaker-label': 'true',
      },
      headers: {
        host: `transcribestreaming.${region}.amazonaws.com:8443`,
      },
    });

    const presigned = await signer.presign(request, { expiresIn: 300 });
    
    const host = presigned.port ? `${presigned.hostname}:${presigned.port}` : presigned.hostname;
    const qs = new URLSearchParams(
      Object.entries(presigned.query || {}).flatMap(([k, v]) =>
        Array.isArray(v) ? v.map((vv) => [k, vv]) : [[k, String(v)]]
      )
    ).toString();
    
    const wssUrl = `wss://${host}${presigned.path}?${qs}`;
    
    console.log('Connecting to WebSocket...');
    const ws = new WebSocket(wssUrl);
    ws.binaryType = 'arraybuffer';
    
    ws.on('open', () => {
      console.log('✅ WebSocket opened!');
      
      // Send some test audio data (silence)
      console.log('Sending test audio data...');
      const silentAudio = new Int16Array(1600); // 100ms of silence at 16kHz
      const audioEvent = encodeAudioEvent(silentAudio);
      ws.send(audioEvent);
      console.log('Audio data sent (', audioEvent.byteLength, 'bytes)');
      
      // Send end signal after 1 second
      setTimeout(() => {
        console.log('Sending end signal...');
        ws.send(encodeAudioEvent(new Int16Array(0)));
        ws.close();
      }, 1000);
    });
    
    ws.on('message', (data) => {
      console.log('Message received:', data.byteLength, 'bytes');
      
      try {
        const msg = marshaller.unmarshall(new Uint8Array(data));
        const mtype = msg.headers[':message-type']?.value;
        
        if (mtype === 'exception') {
          const exceptionType = msg.headers[':exception-type']?.value;
          // Decode the error message properly
          let errorMessage;
          try {
            // If msg.body is already a Uint8Array, decode it directly
            if (msg.body instanceof Uint8Array) {
              // Convert Uint8Array to string
              const decoded = String.fromCharCode(...msg.body);
              try {
                const parsed = JSON.parse(decoded);
                errorMessage = parsed.Message || parsed.message || decoded;
              } catch {
                errorMessage = decoded;
              }
            } else {
              // Try UTF-8 decode
              const directDecode = fromUtf8(msg.body);
              
              // Check if it looks like a stringified array
              if (directDecode.match(/^\d+(,\d+)*$/)) {
                // It's a comma-separated list of numbers
                const bytes = directDecode.split(',').map(Number);
                const decoded = String.fromCharCode(...bytes);
                try {
                  const parsed = JSON.parse(decoded);
                  errorMessage = parsed.Message || parsed.message || decoded;
                } catch {
                  errorMessage = decoded;
                }
              } else {
                // Try to parse as JSON directly
                try {
                  const parsed = JSON.parse(directDecode);
                  errorMessage = parsed.Message || parsed.message || directDecode;
                } catch {
                  errorMessage = directDecode;
                }
              }
            }
          } catch (err) {
            // Fallback: show first part of msg.body for debugging
            errorMessage = `Decode error: ${err.message}. Raw data: ${msg.body.slice(0, 100)}...`;
          }
          console.error('❌ AWS Exception:', exceptionType);
          console.error('Error Message:', errorMessage);
        } else if (mtype === 'event') {
          const etype = msg.headers[':event-type']?.value;
          console.log('✅ Event received:', etype);
          if (etype === 'TranscriptEvent') {
            const payload = JSON.parse(fromUtf8(msg.body));
            console.log('Transcript:', JSON.stringify(payload, null, 2));
          }
        }
      } catch (e) {
        console.error('Failed to decode message:', e.message);
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });
    
    ws.on('close', (code, reason) => {
      console.log('WebSocket closed:', code, reason.toString());
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

testWithAudio();