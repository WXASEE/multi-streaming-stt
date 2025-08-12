'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TranscriptionControls } from '@/components/TranscriptionControls';
import { TranscriptDisplay } from '@/components/TranscriptDisplay';
import { DebugPanel } from '@/components/DebugPanel';
import { useWebSocketTranscription } from '@/hooks/useWebSocketTranscription';
import type { TranscriptionSettings } from '@/lib/types';

export default function Page() {
  const [settings, setSettings] = useState<TranscriptionSettings>({
    language: 'ja-JP',
    diarization: true,
    stabilize: true,
    showPartial: false,
    expectedSpeakers: 'auto',
    recordLocally: true,
  });

  const {
    segments,
    isStreaming,
    wsState,
    debugInfo,
    start,
    stop,
    hasRecording,
    downloadRecording,
  } = useWebSocketTranscription(settings);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-white to-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl p-6 grid gap-6 md:grid-cols-[1fr_360px]">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">
              Real-time Multi-Speaker Transcription (AWS Transcribe / Presigned WebSocket)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <TranscriptionControls
              settings={settings}
              onSettingsChange={setSettings}
              isStreaming={isStreaming}
              onStart={start}
              onStop={stop}
              canDownload={hasRecording && !isStreaming}
              onDownload={downloadRecording}
            />
            
            <Separator />
            
            <TranscriptDisplay segments={segments} />
          </CardContent>
        </Card>

        <DebugPanel debugInfo={debugInfo} wsState={wsState} />
      </div>
    </main>
  );
}
