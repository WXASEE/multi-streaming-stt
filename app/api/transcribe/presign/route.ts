export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const region = process.env.AWS_REGION;
    if (!region) return NextResponse.json({ error: 'AWS_REGION is required' }, { status: 500 });

    const url = new URL(req.url);
    const language = url.searchParams.get('language') ?? 'th-TH';
    const sampleRate = url.searchParams.get('sampleRate') ?? '16000';
    const diar = url.searchParams.get('diarization') === 'true';
    const stabilize = url.searchParams.get('stabilize') === 'true';
    const sessionId = url.searchParams.get('sessionId') ?? randomUUID();
    const expiresIn = Number(url.searchParams.get('expiresIn') ?? 300); // 秒

    const query: Record<string, string> = {
      'language-code': language,
      'media-encoding': 'pcm',
      'sample-rate': sampleRate,
      'session-id': sessionId,
    };
    if (diar) query['show-speaker-label'] = 'true';
    if (stabilize) {
      query['enable-partial-results-stabilization'] = 'true';
      query['partial-results-stability'] = 'medium';
    }

    const credentials = await defaultProvider()();
    const signer = new SignatureV4({
      service: 'transcribe',
      region,
      credentials,
      sha256: Sha256,
    });

    const toSign = new HttpRequest({
      protocol: 'https:',
      method: 'GET',
      hostname: `transcribestreaming.${region}.amazonaws.com`,
      port: 8443,
      path: '/stream-transcription-websocket',
      query,
      headers: { host: `transcribestreaming.${region}.amazonaws.com:8443` },
    });

    const signed = await signer.presign(toSign, { expiresIn });
    const host = signed.port ? `${signed.hostname}:${signed.port}` : signed.hostname;
    const qs = new URLSearchParams(
      Object.entries(signed.query ?? {}).flatMap(([k, v]) =>
        Array.isArray(v) ? v.map((vv) => [k, vv]) : [[k, String(v)]],
      ),
    ).toString();

    const wssUrl = `wss://${host}${signed.path}?${qs}`;
    const expiresAt = Date.now() + expiresIn * 1000;

    
    return NextResponse.json({ url: wssUrl, sessionId, region, expiresAt });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'presign failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}