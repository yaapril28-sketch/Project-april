import React, { useEffect, useRef } from 'react';
import { Thermometer, Droplets, AlertTriangle } from 'lucide-react';
import { SensorPoint } from '../types';

interface SensorPanelProps {
  currentTemp: number;
  currentHum: number;
  sensorHistory: SensorPoint[];
  tempThreshold: number;
  setTempThreshold: (val: number) => void;
  isTempAlertActive: boolean;
  onAlertTriggered: () => void;
  pulseTemp: boolean;
  pulseHum: boolean;
}

export default function SensorPanel({
  currentTemp,
  currentHum,
  sensorHistory,
  tempThreshold,
  setTempThreshold,
  isTempAlertActive,
  onAlertTriggered,
  pulseTemp,
  pulseHum
}: SensorPanelProps) {
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const humCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw Temperature Chart
  useEffect(() => {
    const canvas = tempCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and match high DPI settings
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (sensorHistory.length === 0) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px Rajdhani';
      ctx.textAlign = 'center';
      ctx.fillText('Menunggu data sensor...', width / 2, height / 2);
      return;
    }

    const maxPoints = 20;
    const points = sensorHistory;
    const maxVal = Math.max(...points.map(p => p.temperature), tempThreshold, 45);
    const minVal = Math.min(...points.map(p => p.temperature), 0);
    const range = maxVal - minVal || 1;

    // Grid lines
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(35, y);
      ctx.lineTo(width - 15, y);
      ctx.stroke();

      // Label
      const value = maxVal - (range * (i / 4));
      ctx.fillStyle = 'rgba(156, 163, 175, 0.5)';
      ctx.font = '10px Orbitron';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(value)}°`, 30, y + 4);
    }

    // Border Left and Bottom line
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.2)';
    ctx.beginPath();
    ctx.moveTo(35, 10);
    ctx.lineTo(35, height - 20);
    ctx.lineTo(width - 15, height - 20);
    ctx.stroke();

    // Chart path mapping
    const getX = (index: number) => {
      const step = (width - 50) / (maxPoints - 1);
      return 35 + index * step;
    };

    const getY = (val: number) => {
      const plotHeight = height - 30; // 30px offset
      const ratio = (val - minVal) / range;
      return height - 20 - ratio * plotHeight;
    };

    // Draw area gradient
    ctx.beginPath();
    ctx.moveTo(getX(0), height - 20);
    points.forEach((pt, index) => {
      ctx.lineTo(getX(index), getY(pt.temperature));
    });
    ctx.lineTo(getX(points.length - 1), height - 20);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
    gradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw active threshold line represent
    const threshY = getY(tempThreshold);
    ctx.strokeStyle = '#ef4444';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(35, threshY);
    ctx.lineTo(width - 15, threshY);
    ctx.stroke();
    ctx.setLineDash([]); // clear dash
    ctx.fillStyle = '#ef4444';
    ctx.font = '10px Rajdhani';
    ctx.textAlign = 'left';
    ctx.fillText(`BATAS: ${tempThreshold}°C`, 40, threshY <= 20 ? threshY + 12 : threshY - 4);

    // Draw connecting line
    ctx.strokeStyle = '#A855F7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((pt, index) => {
      if (index === 0) {
        ctx.moveTo(getX(index), getY(pt.temperature));
      } else {
        ctx.lineTo(getX(index), getY(pt.temperature));
      }
    });
    ctx.stroke();

    // Draw marker points
    points.forEach((pt, index) => {
      const isOver = pt.temperature > tempThreshold;
      ctx.beginPath();
      ctx.arc(getX(index), getY(pt.temperature), index === points.length - 1 ? 5 : 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = isOver ? '#ef4444' : '#C084FC';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#0d0618';
      ctx.stroke();
    });

  }, [sensorHistory, tempThreshold]);

  // Draw Humidity Chart
  useEffect(() => {
    const canvas = humCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (sensorHistory.length === 0) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px Rajdhani';
      ctx.textAlign = 'center';
      ctx.fillText('Menunggu data sensor...', width / 2, height / 2);
      return;
    }

    const maxPoints = 20;
    const points = sensorHistory;
    const maxVal = Math.max(...points.map(p => p.humidity), 100);
    const minVal = Math.min(...points.map(p => p.humidity), 0);
    const range = maxVal - minVal || 1;

    // Grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(35, y);
      ctx.lineTo(width - 15, y);
      ctx.stroke();

      // Label
      const value = maxVal - (range * (i / 4));
      ctx.fillStyle = 'rgba(156, 163, 175, 0.5)';
      ctx.font = '10px Orbitron';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(value)}%`, 30, y + 4);
    }

    // Border Left and Bottom line
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.beginPath();
    ctx.moveTo(35, 10);
    ctx.lineTo(35, height - 20);
    ctx.lineTo(width - 15, height - 20);
    ctx.stroke();

    // Chart path mapping
    const getX = (index: number) => {
      const step = (width - 50) / (maxPoints - 1);
      return 35 + index * step;
    };

    const getY = (val: number) => {
      const plotHeight = height - 30;
      const ratio = (val - minVal) / range;
      return height - 20 - ratio * plotHeight;
    };

    // Draw Area Gradient
    ctx.beginPath();
    ctx.moveTo(getX(0), height - 20);
    points.forEach((pt, index) => {
      ctx.lineTo(getX(index), getY(pt.humidity));
    });
    ctx.lineTo(getX(points.length - 1), height - 20);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw connecting line
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((pt, index) => {
      if (index === 0) {
        ctx.moveTo(getX(index), getY(pt.humidity));
      } else {
        ctx.lineTo(getX(index), getY(pt.humidity));
      }
    });
    ctx.stroke();

    // Marker points
    points.forEach((pt, index) => {
      ctx.beginPath();
      ctx.arc(getX(index), getY(pt.humidity), index === points.length - 1 ? 5 : 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#7dd3fc';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#0d0618';
      ctx.stroke();
    });

  }, [sensorHistory]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      
      {/* Visual Sensor Card: Temperature */}
      <div className="bg-[#1a0a2e] p-4 rounded-xl purple-glow relative overflow-hidden transition-all duration-300">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#A855F7]/10 blur-2xl rounded-full"></div>
        
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-gray-400 tracking-wider text-xs">SUHU</span>
          <div className={`p-1.5 rounded-lg bg-[#A855F7]/20 text-[#A855F7]`}>
            <Thermometer id="icon-temp" className="w-5 h-5" />
          </div>
        </div>

        <div className="flex items-baseline space-x-1">
          <span 
            id="temp-value"
            className={`text-4xl font-extrabold font-orbitron tracking-tight text-white transition-all duration-300 ${pulseTemp ? 'scale-110 text-[#C084FC] sensor-glow-active' : ''}`}
          >
            {currentTemp.toFixed(1)}
          </span>
          <span className="text-xl font-semibold text-[#A855F7]">°C</span>
        </div>

        <div className="mt-3 pt-3 border-t border-purple-900/30 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <span className="text-[10px] text-gray-400 block">Batas Peringatan Penuh</span>
            <div className="flex items-center space-x-2 mt-0.5">
              <input
                id="threshold-input"
                type="number"
                min="10"
                max="100"
                value={tempThreshold}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val)) setTempThreshold(val);
                }}
                className="w-16 bg-[#0d0618] border border-purple-900/30 rounded px-1.5 py-0.5 text-xs font-orbitron text-white focus:outline-none focus:border-[#A855F7] focus:ring-1 focus:ring-[#A855F7]"
              />
              <span className="text-xs text-gray-300">°C</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-gray-400 block">Status</span>
            <span className={`text-xs font-bold tracking-wider ${currentTemp > tempThreshold ? 'text-red-500 animate-pulse' : 'text-[#A855F7]'}`}>
              {currentTemp > tempThreshold ? 'OVERHEAT!' : 'NORMAL'}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Sensor Card: Humidity */}
      <div className="bg-[#1a0a2e] p-4 rounded-xl purple-glow relative overflow-hidden transition-all duration-300">
        <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 blur-2xl rounded-full"></div>
        
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-gray-400 tracking-wider text-xs">KELEMBAPAN</span>
          <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
            <Droplets id="icon-hum" className="w-5 h-5" />
          </div>
        </div>

        <div className="flex items-baseline space-x-1">
          <span 
            id="hum-value"
            className={`text-4xl font-extrabold font-orbitron tracking-tight text-white transition-all duration-300 ${pulseHum ? 'scale-110 text-sky-300 sensor-glow-active' : ''}`}
          >
            {currentHum.toFixed(1)}
          </span>
          <span className="text-xl font-semibold text-sky-400">%</span>
        </div>

        <div className="mt-3 pt-3 border-t border-purple-900/30 flex justify-between items-center">
          <div>
            <span className="text-[10px] text-gray-400 block">Kondisi Udara</span>
            <span className="text-xs text-gray-200 mt-0.5 block font-medium">
              {currentHum < 30 ? 'Kering' : currentHum <= 60 ? 'Optimal' : 'Sangat Lembap'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-gray-400 block">Saturasi</span>
            <span className="text-xs text-sky-400 font-semibold">
              {(currentHum * 1.2).toFixed(0)} g/m³
            </span>
          </div>
        </div>
      </div>

      {/* Alert Warning Card */}
      <div className="lg:col-span-1">
        {isTempAlertActive ? (
          <div id="temp-alert" className="bg-[#ef4444]/10 border-2 border-[#ef4444] animate-pulse rounded-xl p-4 h-full flex flex-col justify-between relative overflow-hidden alert-blink">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-orbitron font-bold text-red-500 text-sm flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> PERINGATAN SUHU!
                </h4>
                <p className="text-xs text-gray-300 mt-1.5 font-medium leading-relaxed">
                  Suhu melebihi ambang batas ({tempThreshold}°C) stabil pada <span className="text-red-400 font-bold">{currentTemp.toFixed(1)}°C</span>.
                </p>
              </div>
            </div>
            
            <div className="mt-2 pt-2 border-t border-[#ef4444]/20 flex justify-between items-center">
              <span className="text-[9px] text-red-500 uppercase tracking-wider font-bold animate-pulse">
                ALARM AKTIF
              </span>
              <button
                id="beep-test-btn"
                onClick={onAlertTriggered}
                className="bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] py-0.5 px-2 rounded border border-red-400 shadow-md transition-all cursor-pointer"
              >
                TES BEEP MANUAL
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#1a0a2e]/40 border border-purple-900/30 rounded-xl p-4 h-full flex flex-col justify-center items-center text-center text-gray-500">
            <AlertTriangle className="w-8 h-8 mb-2 text-gray-600" />
            <span className="text-xs font-bold tracking-wider font-orbitron text-gray-400">
              SISTEM PERINGATAN AMAN
            </span>
            <p className="text-[10px] text-gray-500 max-w-xs mt-1 leading-normal">
              Peringatan dan alarm audio akan berbunyi otomatis jika suhu melebihi target batas.
            </p>
          </div>
        )}
      </div>

      {/* Historical Canvas Chart Section */}
      <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
        {/* Temp Canvas Card */}
        <div className="bg-[#1a0a2e] p-4 rounded-xl purple-glow relative">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-gray-400 tracking-wider text-xs">TREN HISTORIKAL SUHU (20 DATA)</span>
            <span className="text-[10px] text-[#A855F7] font-orbitron font-bold">REALTIME CANVAS</span>
          </div>
          <div className="relative w-full h-[120px] bg-[#0d0618]/60 rounded-lg overflow-hidden border border-[#A855F7]/10 flex items-center justify-center">
            <canvas 
              id="temp-history-canvas"
              ref={tempCanvasRef}
              width={540}
              height={120}
              className="w-full h-full block"
            />
          </div>
        </div>

        {/* Hum Canvas Card */}
        <div className="bg-[#1a0a2e] p-4 rounded-xl purple-glow relative">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-gray-400 tracking-wider text-xs">TREN HISTORIKAL KELEMBAPAN (20 DATA)</span>
            <span className="text-[10px] text-sky-400 font-orbitron font-bold">REALTIME CANVAS</span>
          </div>
          <div className="relative w-full h-[120px] bg-[#0d0618]/60 rounded-lg overflow-hidden border border-sky-500/10 flex items-center justify-center">
            <canvas 
              id="hum-history-canvas"
              ref={humCanvasRef}
              width={540}
              height={120}
              className="w-full h-full block"
            />
          </div>
        </div>
      </div>

    </div>
  );
}
