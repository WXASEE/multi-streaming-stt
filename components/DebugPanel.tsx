'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DebugInfo, WebSocketState } from '@/lib/types';

interface DebugPanelProps {
  debugInfo: DebugInfo;
  wsState: WebSocketState;
}

const WS_STATE_NAMES = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'] as const;

export function DebugPanel({ debugInfo, wsState }: DebugPanelProps) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <div className="text-slate-500">Region</div>
          <div>{debugInfo.region || '-'}</div>
          
          <div className="text-slate-500">Session</div>
          <div className="truncate" title={debugInfo.sessionId}>
            {debugInfo.sessionId || '-'}
          </div>
          
          <div className="text-slate-500">Presign Exp.</div>
          <div>
            {debugInfo.expiresAt 
              ? new Date(debugInfo.expiresAt).toLocaleTimeString() 
              : '-'}
          </div>
          
          <div className="text-slate-500">WS State</div>
          <div>{WS_STATE_NAMES[wsState] || wsState}</div>
          
          <div className="text-slate-500">Mic Rate</div>
          <div>{debugInfo.inRate} Hz</div>
          
          <div className="text-slate-500">Out Rate</div>
          <div>{debugInfo.outRate} Hz</div>
          
          <div className="text-slate-500">Chunks Sent</div>
          <div>{debugInfo.chunksSent}</div>
          
          <div className="text-slate-500">Events Recv</div>
          <div>{debugInfo.eventsRecv}</div>
          
          <div className="text-slate-500">Avg Latency</div>
          <div>{debugInfo.avgLatencyMs} ms</div>
          
          <div className="text-slate-500">Last Error</div>
          <div className="text-red-600">{debugInfo.lastError || '-'}</div>
        </div>
        
        <div>
          <div className="text-slate-500 mb-1">Input Level (RMS)</div>
          <div className="h-2 w-full bg-slate-200 rounded">
            <div 
              className="h-2 bg-slate-600 rounded" 
              style={{ 
                width: `${Math.min(100, Math.round(debugInfo.currentRms * 100))}%` 
              }} 
            />
          </div>
        </div>
        
        <div>
          <div className="text-slate-500 mb-1">Speaker map (raw → UI)</div>
          <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 p-2">
            {Object.keys(debugInfo.rawToMapped).length === 0 ? (
              <div className="text-slate-400">(Not yet mapped)</div>
            ) : (
              <ul className="list-disc list-inside">
                {Object.entries(debugInfo.rawToMapped).map(([raw, ui]) => (
                  <li key={raw}>
                    <span className="font-mono">{raw}</span> → 
                    <span className="font-semibold"> {ui}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}