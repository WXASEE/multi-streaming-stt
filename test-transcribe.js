#!/usr/bin/env node

// Simple test script to verify AWS Transcribe permissions
const { SignatureV4 } = require('@aws-sdk/signature-v4');
const { Sha256 } = require('@aws-crypto/sha256-js');
const { HttpRequest } = require('@aws-sdk/protocol-http');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');

async function testTranscribePermissions() {
  try {
    console.log('Testing AWS Transcribe permissions...\n');
    
    const region = process.env.AWS_REGION || 'ap-northeast-1';
    const credentials = await defaultProvider()();
    
    console.log('Credentials loaded:');
    console.log('- Access Key ID:', credentials.accessKeyId?.substring(0, 10) + '...');
    console.log('- Region:', region);
    console.log('');
    
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
      },
      headers: {
        host: `transcribestreaming.${region}.amazonaws.com:8443`,
      },
    });

    console.log('Creating presigned URL...');
    const presigned = await signer.presign(request, { expiresIn: 300 });
    
    const host = presigned.port ? `${presigned.hostname}:${presigned.port}` : presigned.hostname;
    const qs = new URLSearchParams(
      Object.entries(presigned.query || {}).flatMap(([k, v]) =>
        Array.isArray(v) ? v.map((vv) => [k, vv]) : [[k, String(v)]]
      )
    ).toString();
    
    const wssUrl = `wss://${host}${presigned.path}?${qs}`;
    
    console.log('\n✅ SUCCESS: Presigned URL created!');
    console.log('URL (first 100 chars):', wssUrl.substring(0, 100) + '...');
    console.log('\nThis means your IAM credentials have the necessary permissions to create presigned URLs.');
    
    // Try to connect to WebSocket
    console.log('\nNow testing WebSocket connection...');
    const WebSocket = require('ws');
    
    const ws = new WebSocket(wssUrl);
    
    ws.on('open', () => {
      console.log('✅ WebSocket opened successfully!');
      console.log('Your credentials CAN connect to AWS Transcribe.');
      ws.close();
      process.exit(0);
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      if (error.message.includes('403')) {
        console.error('This is a permission issue - your IAM user lacks transcribe:StartStreamTranscription');
      }
      process.exit(1);
    });
    
    ws.on('close', (code, reason) => {
      console.log('WebSocket closed:', code, reason.toString());
      if (code === 1000 && reason.toString().includes('exception')) {
        console.error('❌ AWS Transcribe rejected the connection');
        console.error('This usually means a permission or configuration issue');
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

testTranscribePermissions();