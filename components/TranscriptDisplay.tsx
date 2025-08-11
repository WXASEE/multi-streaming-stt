'use client';

import { Label } from '@/components/ui/label';
import type { TranscriptSegment } from '@/lib/types';

interface TranscriptDisplayProps {
  segments: TranscriptSegment[];
}

export function TranscriptDisplay({ segments }: TranscriptDisplayProps) {
  return (
    <div className="space-y-2">
      <Label>Transcript</Label>
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