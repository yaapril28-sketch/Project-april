import React from 'react';
import { Mic, MicOff, Info, HelpCircle } from 'lucide-react';

interface VoiceControllerProps {
  isListening: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'requesting';
  lastRecognizedText: string;
  onToggleMic: () => void;
}

export default function VoiceController({
  isListening,
  permissionStatus,
  lastRecognizedText,
  onToggleMic
}: VoiceControllerProps) {

  // Map status labels & styles
  let statusText = 'Belum Diizinkan';
  let statusColor = 'text-red-400 border-red-500/20 bg-red-500/10';

  if (permissionStatus === 'requesting') {
    statusText = 'Meminta Izin...';
    statusColor = 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10';
  } else if (permissionStatus === 'granted') {
    if (isListening) {
      statusText = 'Aktif (Mendengarkan)';
      statusColor = 'text-green-400 border-green-500/20 bg-green-500/10';
    } else {
      statusText = 'Siap (Mikrofon Diizinkan)';
      statusColor = 'text-[#C084FC] border-[#A855F7]/20 bg-[#A855F7]/10';
    }
  } else if (permissionStatus === 'denied') {
    statusText = 'Mikrofon Diblokir';
    statusColor = 'text-red-500 border-red-500/40 bg-red-500/20';
  }

  return (
    <div className="bg-[#1a0a2e] p-4 rounded-xl purple-glow relative overflow-hidden transition-all duration-300">
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#A855F7]/10 blur-2xl rounded-full"></div>

      {/* Permission Block Banner warning if denied */}
      {permissionStatus === 'denied' && (
        <div id="mic-denied-banner" className="mb-3 bg-red-500/10 border border-red-500 text-red-200 text-xs p-2.5 rounded-lg flex items-center gap-2">
          <Info className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span>
            <strong>Mikrofon diblokir.</strong> Klik ikon kunci di address bar → izinkan Mikrofon → Reload halaman.
          </span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Toggle panel with mic button */}
        <div className="flex flex-col items-center justify-center p-3.5 border border-[#A855F7]/10 rounded-xl bg-[#0d0618]/30 lg:w-[220px] flex-shrink-0">
          <div className="relative mb-3">
            {/* Pulsing Ripple circles for glowing voice state */}
            {isListening && (
              <div className="absolute inset-0 bg-[#A855F7]/30 rounded-full animate-mic-ripple"></div>
            )}
            
            <button
              id="mic-toggle-btn"
              onClick={onToggleMic}
              className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-90 ${
                isListening
                  ? 'bg-[#A855F7] text-white shadow-[0_0_20px_rgba(168,85,247,0.8)]'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {isListening ? (
                <Mic id="mic-icon-on" className="w-7 h-7" />
              ) : (
                <MicOff id="mic-icon-off" className="w-7 h-7" />
              )}
            </button>
          </div>

          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">KONTROL SUARA MIKROFON</span>
          
          <div className={`mt-2 text-center text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${statusColor}`}>
            {statusText}
          </div>
        </div>

        {/* Console showing translation output */}
        <div className="flex-grow flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-1.5 mb-1.5">
              <span className="font-bold text-xs tracking-wider uppercase text-gray-300">KONSOL REKOGNISI REALTIME</span>
              {isListening && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span>}
            </div>
            
            <div 
              id="voice-recognizer"
              className="bg-[#0d0618]/80 border border-purple-900/10 p-3 h-20 rounded-xl flex items-center justify-center text-center font-mono relative"
            >
              {isListening ? (
                lastRecognizedText ? (
                  <p id="mic-recognized-text" className="text-yellow-400 font-bold text-xs tracking-wide">
                    "{lastRecognizedText}"
                  </p>
                ) : (
                  <p className="text-gray-500 text-[11px] italic">
                    Silakan berbicara... (Menunggu perintah suara Anda)
                  </p>
                )
              ) : (
                <p className="text-gray-500 text-[10px] uppercase font-orbitron tracking-widest leading-relaxed">
                  KLIK MIKROFON DIKIRI UNTUK AKTIFKAN KONTROL SUARA MANDIRI
                </p>
              )}
            </div>
          </div>

          {/* Quick instructions / commands info */}
          <div className="mt-3 p-2.5 bg-purple-950/15 border border-purple-900/30 rounded-lg">
            <h5 className="font-bold text-[11px] text-[#A855F7] mb-1 flex items-center gap-1">
              <HelpCircle className="w-3 h-3" /> DAFTAR PERINTAH INDIVIDU & POLA (BAHASA INDONESIA)
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-0.5 font-mono text-[9px] text-gray-400">
              <div>• Suhu/Sensor: <span className="text-[#A855F7]">"berapa suhu"</span> / <span className="text-[#A855F7]">"cek sensor"</span></div>
              <div>• Relay ON: <span className="text-[#A855F7]">"nyalakan semua"</span> / <span className="text-[#A855F7]">"relay 1 on"</span></div>
              <div>• Relay OFF: <span className="text-[#A855F7]">"matikan semua"</span> / <span className="text-[#A855F7]">"relay 2 off"</span></div>
              <div>• Pola ON: <span className="text-[#A855F7]">"aktifkan semua pola"</span> / <span className="text-[#A855F7]">"pola 1 on"</span></div>
              <div>• Pola OFF: <span className="text-[#A855F7]">"matikan semua pola"</span> / <span className="text-[#A855F7]">"pola 2 off"</span></div>
              <div>• Lainnya: <span className="text-[#A855F7]">"bersihkan log"</span> / <span className="text-[#A855F7]">"semua mati"</span></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
