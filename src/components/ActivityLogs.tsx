import React, { useRef, useEffect } from 'react';
import { Trash2, Download, Terminal } from 'lucide-react';
import { LogEntry } from '../types';

interface ActivityLogsProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export default function ActivityLogs({ logs, onClearLogs }: ActivityLogsProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of the list when new log is added
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs]);

  // Export functionality
  const handleExportLogs = () => {
    if (logs.length === 0) return;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const logText = logs
      .map(log => `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.text}`)
      .join('\r\n');

    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iot-log-${dateStr}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#1a0a2e] p-4 rounded-xl purple-glow relative overflow-hidden transition-all duration-300 flex flex-col h-[230px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2.5 gap-2">
        <div>
          <h3 className="text-sm font-bold font-orbitron text-[#C084FC] tracking-wider flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-[#A855F7]" /> PANEL LOGS AKTIVITAS
          </h3>
          <p className="text-[10px] text-gray-400 uppercase">
            Riwayat pesan MQTT, kontrol, sensor, dan instruksi suara realtime
          </p>
        </div>

        {/* Log controls */}
        <div className="flex items-center space-x-1.5">
          <button
            id="export-log-btn"
            onClick={handleExportLogs}
            disabled={logs.length === 0}
            className={`cursor-pointer border border-[#A855F7]/40 bg-[#A855F7]/10 hover:bg-[#A855F7]/30 text-[#C084FC] text-[10px] py-1 px-2.5 rounded flex items-center gap-1 transition-all ${
              logs.length === 0 ? 'opacity-30 cursor-not-allowed' : 'active:scale-95'
            }`}
            title="Download log sebagai .txt"
          >
            <Download className="w-3 h-3" />
            <span>EXPORT LOG</span>
          </button>
          
          <button
            id="clear-log-btn"
            onClick={onClearLogs}
            className="cursor-pointer border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] py-1 px-2.5 rounded flex items-center gap-1 transition-all active:scale-95"
            title="Bersihkan log di UI"
          >
            <Trash2 className="w-3 h-3" />
            <span>CLEAR LOG</span>
          </button>
        </div>
      </div>

      {/* Scrollable logger terminal */}
      <div
        id="logs-terminal"
        ref={listRef}
        className="bg-[#0d0618]/95 border border-purple-900/30 rounded-lg p-3 overflow-y-auto font-mono text-[11px] space-y-1.5 flex-grow scrollbar-hide"
      >
        {logs.length === 0 ? (
          <div className="text-gray-600 h-full flex items-center justify-center font-orbitron text-[9px] tracking-widest uppercase animate-pulse">
            TIDAK ADA DATA LOGS AKTIVITAS
          </div>
        ) : (
          logs.map((log) => {
            // Pick color based on log type
            let colorClass = 'text-gray-300'; // system
            if (log.type === 'mqtt') colorClass = 'text-[#22c55e]';
            if (log.type === 'publish') colorClass = 'text-[#A855F7]';
            if (log.type === 'error') colorClass = 'text-[#ef4444]';
            if (log.type === 'voice') colorClass = 'text-[#eab308]';

            return (
              <div id={`log-line-${log.id}`} key={log.id} className="flex items-start leading-relaxed border-b border-purple-950/25 pb-0.5">
                <span className="text-gray-500 font-bold mr-1.5 select-none">
                  [{log.timestamp}]
                </span>
                <span className={`${colorClass} font-semibold break-all`}>
                  {log.text}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[9px] text-gray-500 font-mono">
        <span>Tipe: <span className="text-[#22c55e] font-bold">● MQTT IN</span> | <span className="text-[#A855F7] font-bold">● MQTT OUT</span> | <span className="text-[#eab308] font-bold">● SUARA</span> | <span className="text-red-400 font-bold">● ERROR</span></span>
        <span>Maksimal 150 log baris</span>
      </div>
    </div>
  );
}
