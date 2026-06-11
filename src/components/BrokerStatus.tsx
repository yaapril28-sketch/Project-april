import React from 'react';
import { Wifi, WifiOff, Activity } from 'lucide-react';
import { BrokerStatus as BrokerStatusType } from '../types';

interface BrokerStatusProps {
  brokers: BrokerStatusType[];
}

export default function BrokerStatus({ brokers }: BrokerStatusProps) {
  return (
    <div className="bg-[#1a0a2e] p-4 rounded-xl purple-glow relative overflow-hidden transition-all duration-300">
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#A855F7]/10 blur-2xl rounded-full"></div>

      <div className="mb-4">
        <h3 className="text-lg font-bold font-orbitron text-white tracking-wider flex items-center gap-2">
          STATUS UTAMA BROKER MQTT
        </h3>
        <p className="text-[10px] text-gray-400 mt-0.5 uppercase">
          Tiga WebSocket Connection Terpantau Secara Simultan
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {brokers.map((broker) => {
          const isConnected = broker.connected;
          return (
            <div
              id={`broker-card-${broker.id}`}
              key={broker.id}
              className={`border rounded-lg p-3.5 flex flex-col justify-between transition-all duration-300 bg-[#0d0618]/50 ${
                isConnected ? 'border-purple-900/40 hover:border-[#A855F7]/40' : 'border-red-500/20 hover:border-red-500/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span id={`broker-name-${broker.id}`} className="font-bold text-xs text-gray-200 uppercase tracking-widest leading-none">
                    {broker.name.replace('Broker ', 'B').replace(' - ', ' ')}
                  </span>
                  
                  {/* Status Indicator Dot */}
                  <div className="flex items-center space-x-1.5">
                    <span 
                      id={`broker-dot-${broker.id}`}
                      className={`w-2 h-2 rounded-full ${
                        isConnected 
                          ? 'bg-green-500 shadow-[0_0_8px_#22c55e]'
                          : 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                      }`}
                    />
                    <span className="text-[8px] font-orbitron text-gray-400 font-bold uppercase">
                      {isConnected ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-gray-500 font-mono break-all mb-3">
                  {broker.host}
                </p>
              </div>

              <div className="pt-2 border-t border-purple-900/20 flex items-center justify-between">
                <span className="text-[9px] text-gray-400 tracking-wider flex items-center gap-1 font-medium font-mono">
                  <Activity className="w-3 h-3 text-[#A855F7]" />
                  LATENCY
                </span>
                <span 
                  id={`broker-latency-${broker.id}`}
                  className={`font-orbitron font-bold text-xs ${
                    isConnected ? 'text-[#C084FC]' : 'text-gray-600'
                  }`}
                >
                  {isConnected && broker.latency !== null ? `${broker.latency} ms` : '--'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
