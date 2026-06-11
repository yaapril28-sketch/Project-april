import React, { useState } from 'react';
import { Power, Edit2, Check, X } from 'lucide-react';
import { Relay } from '../types';

interface RelayControlProps {
  relays: Relay[];
  onToggleRelay: (id: number) => void;
  onAllRelaysOn: () => void;
  onAllRelaysOff: () => void;
  onRenameRelay: (id: number, newName: string) => void;
  isPatternActive: boolean;
}

export default function RelayControl({
  relays,
  onToggleRelay,
  onAllRelaysOn,
  onAllRelaysOff,
  onRenameRelay,
  isPatternActive
}: RelayControlProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState<string>('');

  const startEditing = (relay: Relay) => {
    if (isPatternActive) return;
    setEditingId(relay.id);
    setEditVal(relay.label);
  };

  const handleSaveName = (id: number) => {
    const trimmed = editVal.trim();
    if (trimmed) {
      onRenameRelay(id, trimmed);
    }
    setEditingId(null);
  };

  return (
    <div className="bg-[#1a0a2e] p-4 rounded-xl purple-glow relative overflow-hidden transition-all duration-300">
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#A855F7]/10 blur-2xl rounded-full"></div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold font-orbitron text-white tracking-wider flex items-center gap-2">
            KONTROL RELAY UTAMA
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5 uppercase">
            {isPatternActive ? (
              <span className="text-yellow-500 font-bold tracking-widest animate-pulse">
                POLA LAMPU AKTIF - MANUAL DINONAKTIFKAN
              </span>
            ) : (
              'SESUAIKAN DAN KONTROL DEV Relay ESP32'
            )}
          </p>
        </div>

        {/* Master Switches */}
        <div className="flex items-center space-x-2">
          <button
            id="all-relay-on-btn"
            onClick={onAllRelaysOn}
            disabled={isPatternActive}
            className={`cursor-pointer border border-[#A855F7]/40 bg-[#A855F7]/10 hover:bg-[#A855F7]/30 text-[#C084FC] font-bold text-[10px] py-1 px-3 rounded tracking-wider transition-all duration-300 ${
              isPatternActive ? 'opacity-30 cursor-not-allowed' : 'active:scale-95 hover:shadow-[0_0_12px_rgba(168,85,247,0.4)]'
            }`}
          >
            SEMUA ON
          </button>
          <button
            id="all-relay-off-btn"
            onClick={onAllRelaysOff}
            disabled={isPatternActive}
            className={`cursor-pointer border border-gray-600 bg-gray-800/20 hover:bg-gray-700 text-gray-300 font-bold text-[10px] py-1 px-3 rounded tracking-wider transition-all duration-300 ${
              isPatternActive ? 'opacity-30 cursor-not-allowed' : 'active:scale-95'
            }`}
          >
            SEMUA OFF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {relays.map((relay) => {
          const isSelected = relay.active;
          const isEditing = editingId === relay.id;

          return (
            <div
              id={`relay-card-${relay.id}`}
              key={relay.id}
              className={`border rounded-lg p-3.5 flex flex-col justify-between transition-all duration-300 ${
                isPatternActive ? 'opacity-40 select-none' : ''
              } ${
                isSelected
                  ? 'bg-[#1a0a2e] border-[#A855F7] shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                  : 'bg-[#0d0618]/65 border-purple-900/30 hover:border-purple-900/50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                {isEditing ? (
                  <div className="flex items-center space-x-1 w-full mr-1">
                    <input
                      id={`relay-edit-input-${relay.id}`}
                      type="text"
                      value={editVal}
                      maxLength={24}
                      onChange={(e) => setEditVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName(relay.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="bg-[#0d0618] border border-[#A855F7]/50 rounded px-1.5 py-0.5 text-xs text-white max-w-[95px] focus:outline-none"
                    />
                    <button
                      id={`relay-save-btn-${relay.id}`}
                      onClick={() => handleSaveName(relay.id)}
                      className="p-1 text-green-400 hover:bg-green-500/10 rounded"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      id={`relay-cancel-btn-${relay.id}`}
                      onClick={() => setEditingId(null)}
                      className="p-1 text-red-400 hover:bg-red-500/10 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 group">
                    <span
                      id={`relay-label-${relay.id}`}
                      onClick={() => startEditing(relay)}
                      className="font-bold text-xs tracking-wide text-gray-200 cursor-pointer hover:text-[#C084FC] transition-colors line-clamp-1"
                      title="Klik untuk ubah nama"
                    >
                      {relay.label}
                    </span>
                    {!isPatternActive && (
                      <button
                        id={`relay-edit-btn-${relay.id}`}
                        onClick={() => startEditing(relay)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#A855F7]/20 rounded text-[#A855F7] transition-all"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                )}

                <span className={`text-[9px] font-orbitron font-bold tracking-widest px-1.5 py-0.5 rounded ${
                  isSelected ? 'bg-[#A855F7]/20 text-[#C084FC]' : 'bg-gray-800/60 text-gray-400'
                }`}>
                  {isSelected ? 'ON' : 'OFF'}
                </span>
              </div>

              {/* Power Switch Action */}
              <button
                id={`relay-toggle-${relay.id}`}
                onClick={() => onToggleRelay(relay.id)}
                disabled={isPatternActive}
                className={`py-2 px-3 rounded-md flex items-center justify-center space-x-1.5 font-bold font-orbitron text-[10px] tracking-wider transition-all duration-300 ${
                  isPatternActive
                    ? 'bg-[#374151]/40 text-gray-500 cursor-not-allowed'
                    : isSelected
                    ? 'cursor-pointer bg-[#A855F7] hover:bg-[#C084FC] text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                    : 'cursor-pointer bg-[#374151] hover:bg-[#4b5563] text-gray-300'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{isSelected ? 'MATIKAN' : 'NYALAKAN'}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
