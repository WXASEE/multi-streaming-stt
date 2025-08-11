'use client';

import { useEffect, useRef, useState } from 'react';
import MicrophoneStream from 'microphone-stream';
import { v4 as uuidv4 } from 'uuid';
import { micPcm16Stream, rmsLevel } from '@/lib/audio';
import { encodeAudioEvent, tryDecode, TranscriptEvent } from '@/lib/eventstream';
import { SpeakerMapper } from '@/lib/speaker-map';

// --- shadcn/ui ---
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

type Segment = { speaker: string; text: string; start?: number; end?: number; };

export default function Page() {
  const [language, setLanguage] = useState<'ja-JP'|'en-US'>('ja-JP');
  const [diar, setDiar] = useState(true);
  const [stabilize, setStabilize] = useState(true);
  const [showPartial, setShowPartial] = useState(false);  // 部分結果を表示するかどうか
  const [expected, setExpected] = useState<'auto'|'2'|'3'>('auto');

  const [segments, setSegments] = useState<Segment[]>([]);
  const [isStreaming, setStreaming] = useState(false);
  const [wsState, setWsState] = useState<WebSocket['readyState']>(WebSocket.CLOSED);

  // Debug
  const [debug, setDebug] = useState({
    region: '',
    sessionId: '',
    expiresAt: 0,
    inRate: 48000,
    outRate: 16000,
    chunksSent: 0,
    eventsRecv: 0,
    lastError: '' as string | null,
    avgLatencyMs: 0,
    currentRms: 0,
    rawToMapped: {} as Record<string,string>,
  });

  const micRef = useRef<MicrophoneStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mapperRef = useRef(new SpeakerMapper('auto'));
  const lastSendTimeRef = useRef<number[]>([]); // 各チャンク送信時刻（移動平均に使用）

  useEffect(() => {
    mapperRef.current.setMaxSlots(expected === 'auto' ? 'auto' : Number(expected));
  }, [expected]);

  function pushLatency(ts: number) {
    const arr = lastSendTimeRef.current;
    arr.push(ts);
    if (arr.length > 50) arr.shift();
  }
  function calcAvgLatency(arrivalTs: number) {
    const arr = lastSendTimeRef.current;
    if (!arr.length) return;
    const last = arr[arr.length - 1];
    const ms = Math.max(0, arrivalTs - last);
    setDebug(d => ({ ...d, avgLatencyMs: Math.round((d.avgLatencyMs * 0.8) + (ms * 0.2)) }));
  }

  async function start() {
    try {
      setSegments([]); setStreaming(true);
      mapperRef.current.reset();

      // presign 取得
      const sessionId = uuidv4();
      const p = new URLSearchParams({
        language, diarization: String(diar), stabilize: String(stabilize), sampleRate: '16000', sessionId
      });
      const r = await fetch(`/api/transcribe/presign?${p.toString()}`);
      const data = await r.json();
      console.log('Presign API response:', data);
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const { url, region, expiresAt } = data;
      if (!url) {
        throw new Error('No URL received from presign API');
      }

      setDebug(d => ({ ...d, region, sessionId, expiresAt, lastError: null }));

      // マイク開始
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, noiseSuppression: true, echoCancellation: true } });
      const mic = new MicrophoneStream();
      mic.setStream(stream);
      micRef.current = mic;
      setDebug(d => ({ ...d, inRate: (mic as any).context?.sampleRate ?? 48000 }));

      // WS 接続
      console.log('Connecting to WebSocket URL:', url.substring(0, 100) + '...');
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;
      setWsState(ws.readyState);

      let isClosing = false;

      ws.onopen = () => {
        console.log('WebSocket opened');
        setWsState(ws.readyState);
        
        // マイクストリームを開始
        (async () => {
          try {
            let firstChunk = true;
            for await (const pcm16 of micPcm16Stream(mic)) {
              if (isClosing || ws.readyState !== WebSocket.OPEN) break;
              
              if (firstChunk) {
                console.log('Sending first audio chunk, length:', pcm16.length, 'bytes:', pcm16.byteLength);
                console.log('First 10 samples:', Array.from(pcm16.slice(0, 10)));
                firstChunk = false;
              }
              
              const audioEvent = encodeAudioEvent(pcm16);
              ws.send(audioEvent);
              
              const rms = rmsLevel(pcm16);
              pushLatency(performance.now());
              setDebug(d => ({ ...d, chunksSent: d.chunksSent + 1, currentRms: rms }));
              
              // 音声レベルが高い時だけログ
              if (rms > 0.01) {
                console.log('Audio sent with RMS:', rms, 'chunk size:', pcm16.length);
              }
            }
            
            // 終了シグナル（空AudioEvent）
            if (ws.readyState === WebSocket.OPEN) {
              console.log('Sending end signal');
              ws.send(encodeAudioEvent(new Int16Array(0)));
              ws.close();
            }
          } catch (err) {
            console.error('Audio streaming error:', err);
            setDebug(d => ({ ...d, lastError: String(err) }));
          }
        })();
      };

      ws.onmessage = (e) => {
        console.log('WebSocket message received, data size:', e.data.byteLength || e.data.length);
        setWsState(ws.readyState);
        const payload = tryDecode(e) as TranscriptEvent | null;
        if (!payload) {
          console.log('No payload decoded from message');
          return;
        }
        console.log('Transcript event received:', payload);
        setDebug(d => ({ ...d, eventsRecv: d.eventsRecv + 1 }));
        calcAvgLatency(performance.now());

        const results = payload.Transcript?.Results ?? [];
        console.log('Results count:', results.length);
        
        for (const r of results) {
          console.log('Result IsPartial:', r.IsPartial, 'Alternatives:', r.Alternatives?.length);
          
          const alt = r.Alternatives?.[0]; 
          if (!alt) {
            console.log('No alternatives found');
            continue;
          }
          
          // 部分結果でも最終結果でも処理
          console.log(r.IsPartial ? 'Partial' : 'Final', 'transcript:', alt.Transcript);
          console.log('Items count:', alt.Items?.length);
          
          // 最初のアイテムのSpeaker情報を確認
          if (alt.Items?.length) {
            console.log('First item Speaker field:', alt.Items[0].Speaker);
            console.log('All Speaker values:', alt.Items.map(it => it.Speaker));
          }
          
          // 部分結果の処理
          if (r.IsPartial) {
            if (!showPartial) {
              continue;  // showPartialがfalseの場合はスキップ
            }
            // 部分結果を表示する場合、[partial]マーカーを付ける
            if (alt.Transcript && alt.Transcript.trim()) {
              const mapped = mapperRef.current.mapLabel('S0');
              setSegments(s => {
                // 最後のセグメントが同じ話者の部分結果なら置き換え
                const lastIdx = s.length - 1;
                if (lastIdx >= 0 && s[lastIdx].text.startsWith('[partial]')) {
                  return [...s.slice(0, lastIdx), { speaker: mapped, text: `[partial] ${alt.Transcript}` }];
                }
                return [...s, { speaker: mapped, text: `[partial] ${alt.Transcript}` }];
              });
            }
            continue;
          }

          // Transcriptが空の場合はスキップ
          if (!alt.Transcript || alt.Transcript.trim() === '') {
            console.log('Empty transcript, skipping');
            continue;
          }

          // 話者分離がない場合は、テキスト全体をデフォルト話者で追加
          if (!alt.Items || alt.Items.length === 0) {
            console.log('No items, using full transcript');
            const mapped = mapperRef.current.mapLabel('S0');
            setSegments(s => [...s, { speaker: mapped, text: alt.Transcript }]);
            continue;
          }

          // 確定文: Items からスピーカーごとに段落化
          let currentRaw = 'S0';  // デフォルトを'S0'に
          let buf: string[] = [];
          const flush = () => {
            if (!buf.length) return;
            const mapped = mapperRef.current.mapLabel(currentRaw);
            setDebug(d => ({
              ...d,
              rawToMapped: { ...d.rawToMapped, [currentRaw]: mapped }
            }));
            setSegments(s => [...s, { speaker: mapped, text: buf.join(' ') }]);
            buf = [];
          };

          for (const it of alt.Items ?? []) {
            if (it.Type === 'speaker-change') {
              flush();
            } else {
              // Speakerフィールドが存在する場合のみ話者を更新
              if (typeof it.Speaker !== 'undefined' && it.Speaker !== null) {
                const raw = String(it.Speaker).startsWith('spk_') ? String(it.Speaker).replace(/^spk_/, 'S') : `S${it.Speaker}`;
                if (raw !== currentRaw) { 
                  flush(); 
                  currentRaw = raw; 
                }
              }
              if (it.Content) buf.push(it.Content);
            }
          }
          flush();
        }
      };

      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
        setWsState(ws.readyState);
        setDebug(d => ({ ...d, lastError: 'WebSocket error' }));
      };
      ws.onclose = (e) => {
        console.log('WebSocket closed:', { code: e.code, reason: e.reason, wasClean: e.wasClean });
        isClosing = true;
        setWsState(ws.readyState);
        
        // エラーコードに基づいてメッセージを設定
        if (e.code === 1000 && e.reason.includes('exception')) {
          setDebug(d => ({ ...d, lastError: `AWS Transcribe error: ${e.reason}` }));
        } else if (e.code !== 1000) {
          setDebug(d => ({ ...d, lastError: `WebSocket closed with code ${e.code}: ${e.reason}` }));
        }
        
        stop(); // 資源解放
      };
    } catch (e: any) {
      setDebug(d => ({ ...d, lastError: e?.message ?? String(e) }));
      setStreaming(false);
      stop();
    }
  }

  function stop() {
    try {
      micRef.current?.stop(); micRef.current = null;
      wsRef.current?.close(); wsRef.current = null;
    } finally {
      setStreaming(false);
    }
  }

  return (
    <main className="min-h-dvh bg-gradient-to-b from-white to-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl p-6 grid gap-6 md:grid-cols-[1fr_360px]">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader><CardTitle className="text-xl">リアルタイム多話者字幕（AWS Transcribe / presign方式）</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3 items-end">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={(v:any)=>setLanguage(v)}>
                  <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ja-JP">ja-JP（日本語）</SelectItem>
                    <SelectItem value="en-US">en-US（英語）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>期待人数</Label>
                <Select value={expected} onValueChange={(v:any)=>setExpected(v)}>
                  <SelectTrigger><SelectValue placeholder="Auto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">auto（自動）</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">* Transcribe側では人数指定不可。UIで最大人数に整形。</p>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="diar" checked={diar} onCheckedChange={setDiar}/>
                <Label htmlFor="diar">話者分離（speaker labels）</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="stab" checked={stabilize} onCheckedChange={setStabilize}/>
                <Label htmlFor="stab">部分結果の安定化</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="partial" checked={showPartial} onCheckedChange={setShowPartial}/>
                <Label htmlFor="partial">部分結果を表示</Label>
              </div>
              <div className="md:col-span-3 flex gap-3">
                {!isStreaming
                  ? <Button onClick={start} className="rounded-2xl">開始</Button>
                  : <Button variant="destructive" onClick={stop} className="rounded-2xl">停止</Button>}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Transcript</Label>
              <div className="min-h-40 rounded-xl bg-white ring-1 ring-slate-200 p-4 space-y-2">
                {segments.length === 0
                  ? <p className="text-slate-400">（ここに確定行が順次追加されます）</p>
                  : segments.map((seg,i)=>(
                      <p key={i}><span className="font-semibold text-slate-600 mr-2">{seg.speaker}:</span>{seg.text}</p>
                    ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader><CardTitle className="text-lg">Debug</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <div className="text-slate-500">Region</div><div>{debug.region || '-'}</div>
              <div className="text-slate-500">Session</div><div className="truncate" title={debug.sessionId}>{debug.sessionId || '-'}</div>
              <div className="text-slate-500">Presign Exp.</div><div>{debug.expiresAt ? new Date(debug.expiresAt).toLocaleTimeString() : '-'}</div>
              <div className="text-slate-500">WS State</div><div>{['CONNECTING','OPEN','CLOSING','CLOSED'][wsState] || wsState}</div>
              <div className="text-slate-500">Mic Rate</div><div>{debug.inRate} Hz</div>
              <div className="text-slate-500">Out Rate</div><div>{debug.outRate} Hz</div>
              <div className="text-slate-500">Chunks Sent</div><div>{debug.chunksSent}</div>
              <div className="text-slate-500">Events Recv</div><div>{debug.eventsRecv}</div>
              <div className="text-slate-500">Avg Latency</div><div>{debug.avgLatencyMs} ms</div>
              <div className="text-slate-500">Last Error</div><div className="text-red-600">{debug.lastError || '-'}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Input Level (RMS)</div>
              <div className="h-2 w-full bg-slate-200 rounded">
                <div className="h-2 bg-slate-600 rounded" style={{ width: `${Math.min(100, Math.round(debug.currentRms*100))}%`}} />
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Speaker map (raw → UI)</div>
              <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 p-2">
                {Object.keys(debug.rawToMapped).length === 0
                  ? <div className="text-slate-400">（まだありません）</div>
                  : <ul className="list-disc list-inside">
                      {Object.entries(debug.rawToMapped).map(([raw, ui]) => (
                        <li key={raw}><span className="font-mono">{raw}</span> → <span className="font-semibold">{ui}</span></li>
                      ))}
                    </ul>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}