'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { TranscriptSegment } from '@/lib/types';

interface TranscriptDisplayProps {
  segments: TranscriptSegment[];
}

export function TranscriptDisplay({ segments }: TranscriptDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState<string | null>(null);

  const transcriptText = useMemo(() => {
    return segments.map((s) => `${s.speaker}: ${s.text}`.trim()).join('\n');
  }, [segments]);

  const onCopy = useCallback(async () => {
    setCopyErr(null);
    if (!transcriptText) return;
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      try {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = transcriptText;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        setCopyErr('Failed to copy');
      }
    }
  }, [transcriptText]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Transcript</Label>
        <div className="flex items-center gap-2">
          {copyErr && (
            <span className="text-xs text-red-600" role="alert">{copyErr}</span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={onCopy}
            disabled={!transcriptText}
            aria-label="Copy transcript to clipboard"
            className="rounded-2xl"
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>
      <div className="min-h-40 rounded-xl bg-white ring-1 ring-slate-200 p-4 space-y-2">
        {segments.length === 0 ? (
          <p className="text-slate-400">(Transcribed text will appear here)</p>
        ) : (
          segments.map((seg, i) => (
            <p key={i}>
              <span className="font-semibold text-slate-600 mr-2">
                {seg.speaker}:
              </span>
              {seg.text}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
