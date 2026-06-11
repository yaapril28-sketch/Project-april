import React, { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, Sparkles, Wand2 } from 'lucide-react';
import { Pattern } from '../types';

interface PolaLampuProps {
  patterns: Pattern[];
  onTogglePattern: (id: number) => void;
  onAllPatternsOn: () => void;
  onAllPatternsOff: () => void;
}

export default function PolaLampu({
  patterns,
  onTogglePattern,
  onAllPatternsOn,
  onAllPatternsOff
}: PolaLampuProps) {
  const isPola1Active = patterns[0]?.active || false;
  const isPola2Active = patterns[1]?.active || false;

  // State to drive alternate blinking for Pola 2 Visuals
  const [blinkState, setBlinkState] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPola2Active) {
      interval = setInterval(() => {
        setBlinkState(prev => !prev);
      }, 500); // toggle every 500ms
    } else {
      setBlinkState(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPola2Active]);

  return (
    <div className="bg-[#1a0a2e] p-4 rounded-xl purple-glow relative overflow-hidden transition-all duration-300">
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#A855F7]/10 blur-2xl rounded-full"></div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold font-orbitron text-white tracking-wider flex items-center gap-2">
            POLA AUTOMATA LAMPU
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5 uppercase">
            Siklus Animasi Otomatis untuk Rangkaian Lampu ESP32
          </p>
        </div>

        {/* Action Toggles */}
        <div className="flex items-center space-x-2">
          <button
            id="all-patterns-on-btn"
            onClick={onAllPatternsOn}
            className="cursor-pointer border border-[#A855F7]/40 bg-[#A855F7]/15 hover:bg-[#A855F7]/35 text-[#C084FC] font-semibold text-[10px] py-1 px-3 rounded flex items-center gap-1 transition-all duration-300 active:scale-95"
          >
            <Sparkles className="w-3 h-3" />
            <span>SEMUA POLA ON</span>
          </button>
          <button
            id="all-patterns-off-btn"
            onClick={onAllPatternsOff}
            className="cursor-pointer border border-gray-600 bg-gray-800/20 hover:bg-gray-700 text-gray-300 font-semibold text-[10px] py-1 px-3 rounded flex items-center gap-1 transition-all duration-300 active:scale-95"
          >
            <Wand2 className="w-3 h-3" />
            <span>SEMUA POLA OFF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Pattern 1 controller */}
        <div className={`border rounded-lg p-3.5 flex flex-col justify-between transition-all duration-300 ${
          isPola1Active ? 'bg-[#1a0a2e] border-[#A855F7] shadow-[0_0_12px_rgba(168,85,247,0.4)]' : 'bg-[#0d0618]/65 border-purple-900/30'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-gray-200 uppercase tracking-widest">
                POLA 1: KIRI KE KANAN
              </span>
              <button
                id="pola-1-toggle"
                onClick={() => onTogglePattern(1)}
                className="focus:outline-none transition-transform duration-200 active:scale-90"
              >
                {isPola1Active ? (
                  <ToggleRight className="w-8 h-8 text-[#A855F7] cursor-pointer" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-gray-500 cursor-pointer" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mb-4 font-medium leading-relaxed">
              Lampu akan menyala berurutan satu per satu dari arah paling kiri menuju ke paling kanan secara bergantian.
            </p>
          </div>

          {/* Pola 1 Visualizer Box */}
          <div className="bg-[#0d0618]/90 h-8 rounded-lg relative overflow-hidden border border-purple-900/20 flex items-center px-4">
            <div className="w-full h-1 bg-gray-800 rounded relative">
              {isPola1Active ? (
                <div className="absolute w-3 h-3 bg-[#A855F7] rounded-full top-1/2 -translate-y-1/2 shadow-[0_0_8px_#A855F7] animate-dot-move"></div>
              ) : (
                <div className="absolute w-3 h-3 bg-gray-600 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
              )}
            </div>
          </div>
        </div>

        {/* Pattern 2 controller */}
        <div className={`border rounded-lg p-3.5 flex flex-col justify-between transition-all duration-300 ${
          isPola2Active ? 'bg-[#1a0a2e] border-[#A855F7] shadow-[0_0_12px_rgba(168,85,247,0.4)]' : 'bg-[#0d0618]/65 border-purple-900/30'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-gray-200 uppercase tracking-widest">
                POLA 2: BLINK BERGANTIAN
              </span>
              <button
                id="pola-2-toggle"
                onClick={() => onTogglePattern(2)}
                className="focus:outline-none transition-transform duration-200 active:scale-90"
              >
                {isPola2Active ? (
                  <ToggleRight className="w-8 h-8 text-[#A855F7] cursor-pointer" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-gray-500 cursor-pointer" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mb-4 font-medium leading-relaxed">
              Kelompok ganjil (1 & 3) dan kelompok genap (2 & 4) akan berkedip flip-flop secara bergantian 0.5s.
            </p>
          </div>

          {/* Pola 2 Visualizer Box */}
          <div className="bg-[#0d0618]/90 h-8 rounded-lg border border-purple-900/20 flex items-center justify-around px-2">
            {[1, 2, 3, 4].map((num) => {
              const isOdd = num % 2 !== 0;
              const isLit = isPola2Active ? (isOdd ? !blinkState : blinkState) : false;

              return (
                <div key={num} className="flex flex-col items-center">
                  <div
                    id={`pola-box-${num}`}
                    className={`w-5 h-5 rounded border transition-all duration-300 ${
                      isLit
                        ? 'bg-[#A855F7] border-[#C084FC] shadow-[0_0_8px_#A855F7] scale-110'
                        : 'bg-gray-800/10 border-purple-950/20'
                    }`}
                  />
                  <span id={`pola-label-${num}`} className="text-[8px] font-orbitron mt-0.5 text-gray-500">{num}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
