'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { UI_CONFIG } from '@/lib/constants';
import type { LanguageCode, SpeakerCount, TranscriptionSettings } from '@/lib/types';

interface TranscriptionControlsProps {
  settings: TranscriptionSettings;
  onSettingsChange: (settings: TranscriptionSettings) => void;
  isStreaming: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function TranscriptionControls({
  settings,
  onSettingsChange,
  isStreaming,
  onStart,
  onStop,
}: TranscriptionControlsProps) {
  const updateSettings = (updates: Partial<TranscriptionSettings>) => {
    onSettingsChange({ ...settings, ...updates });
  };

  return (
    <div className="grid gap-4 md:grid-cols-3 items-end">
      <div className="space-y-2">
        <Label>Language</Label>
        <Select 
          value={settings.language} 
          onValueChange={(v: LanguageCode) => updateSettings({ language: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            {UI_CONFIG.LANGUAGES.map(lang => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Expected Speakers</Label>
        <Select 
          value={settings.expectedSpeakers} 
          onValueChange={(v: SpeakerCount) => updateSettings({ expectedSpeakers: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Auto" />
          </SelectTrigger>
          <SelectContent>
            {UI_CONFIG.SPEAKER_COUNTS.map(count => (
              <SelectItem key={count.value} value={count.value}>
                {count.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">
          * Transcribe doesn't support speaker count limits. UI maps to max expected speakers.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Switch 
          id="diar" 
          checked={settings.diarization} 
          onCheckedChange={(v) => updateSettings({ diarization: v })}
        />
        <Label htmlFor="diar">Speaker Diarization (speaker labels)</Label>
      </div>

      <div className="flex items-center gap-3">
        <Switch 
          id="stab" 
          checked={settings.stabilize} 
          onCheckedChange={(v) => updateSettings({ stabilize: v })}
        />
        <Label htmlFor="stab">Stabilize Partial Results</Label>
      </div>

      <div className="flex items-center gap-3">
        <Switch 
          id="partial" 
          checked={settings.showPartial} 
          onCheckedChange={(v) => updateSettings({ showPartial: v })}
        />
        <Label htmlFor="partial">Show Partial Results</Label>
      </div>

      <div className="md:col-span-3 flex gap-3">
        {!isStreaming ? (
          <Button onClick={onStart} className="rounded-2xl">
            Start
          </Button>
        ) : (
          <Button variant="destructive" onClick={onStop} className="rounded-2xl">
            Stop
          </Button>
        )}
      </div>
    </div>
  );
}