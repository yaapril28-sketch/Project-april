import React, { useState, useEffect, useRef, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { 
  Cpu, 
  Wifi, 
  Settings, 
  Mic, 
  MicOff, 
  Clock, 
  Calendar, 
  Volume2, 
  Database,
  RefreshCw,
  Server
} from 'lucide-react';

import { LogEntry, BrokerStatus, BrokerId, Relay, Pattern, SensorPoint } from './types';
import SensorPanel from './components/SensorPanel';
import RelayControl from './components/RelayControl';
import PolaLampu from './components/PolaLampu';
import BrokerStatusView from './components/BrokerStatus';
import ActivityLogs from './components/ActivityLogs';
import VoiceController from './components/VoiceController';

// Utility helper to play alert beep via Web Audio API
let audioCtx: AudioContext | null = null;
const playThresholdBeep = () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime); // 800Hz
    
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3); // 300ms durasi
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (err) {
    console.warn('AudioContext alert beep failed to play:', err);
  }
};

// Text-to-Speech (TTS) response in Indonesian
const speakResponse = (text: string) => {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // stop current speech
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    
    // Select Indonesian voice if possible
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find(v => v.lang.startsWith('id') || v.lang.includes('id-ID'));
    if (idVoice) utterance.voice = idVoice;
    
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Text-to-Speech failed to execute:', err);
  }
};

export default function App() {
  // ---- STATE INITIALIZATIONS ----
  // Time and Date widget
  const [now, setNow] = useState<Date>(new Date());

  // Sensors
  const [currentTemp, setCurrentTemp] = useState<number>(27.4);
  const [currentHum, setCurrentHum] = useState<number>(55.2);
  const [sensorHistory, setSensorHistory] = useState<SensorPoint[]>([]);
  const [pulseTemp, setPulseTemp] = useState<boolean>(false);
  const [pulseHum, setPulseHum] = useState<boolean>(false);

  // Temperature Threshold alert
  const [tempThreshold, _setTempThreshold] = useState<number>(() => {
    const cached = localStorage.getItem('tempThreshold');
    return cached ? Number(cached) : 35;
  });
  const [isTempAlertActive, setIsTempAlertActive] = useState<boolean>(false);

  // Relay lists
  const [relays, setRelays] = useState<Relay[]>(() => {
    const cached = localStorage.getItem('relayLabels');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return [
          { id: 1, label: parsed[1] || 'Lampu Utama Teras', active: false },
          { id: 2, label: parsed[2] || 'Pompa Air Kebun', active: false },
          { id: 3, label: parsed[3] || 'Lampu Taman Belakang', active: false },
          { id: 4, label: parsed[4] || 'Kipas Exhaust Ruang', active: false },
        ];
      } catch (e) {
        // Fallback
      }
    }
    return [
      { id: 1, label: 'Lampu Utama Teras', active: false },
      { id: 2, label: 'Pompa Air Kebun', active: false },
      { id: 3, label: 'Lampu Taman Belakang', active: false },
      { id: 4, label: 'Kipas Exhaust Ruang', active: false },
    ];
  });

  // Patterns state
  const [patterns, setPatterns] = useState<Pattern[]>([
    { id: 1, name: 'Pola 1: Kiri ke Kanan', active: false, description: 'Lampu bergerak kiri ke kanan' },
    { id: 2, name: 'Pola 2: Blink Bergantian', active: false, description: 'Lampu 1-3 vs 2-4 blink flip-flop' }
  ]);

  // Logs terminal stream
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Broker states
  const [brokers, setBrokers] = useState<BrokerStatus[]>([
    { id: 'mosquitto', name: 'Broker 1 - Mosquitto', connected: false, latency: null, host: 'test.mosquitto.org:8080' },
    { id: 'flespi', name: 'Broker 2 - Flespi', connected: false, latency: null, host: 'mqtt.flespi.io:80' },
    { id: 'mosquittoAuth', name: 'Broker 3 - Mosquitto Auth', connected: false, latency: null, host: 'test.mosquitto.org:8094' }
  ]);

  // Speech Recognition control states
  const [isMicListening, setIsMicListening] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'requesting'>('prompt');
  const [lastRecognizedText, setLastRecognizedText] = useState<string>('');

  // Local storage setters
  const setTempThreshold = (val: number) => {
    _setTempThreshold(val);
    localStorage.setItem('tempThreshold', String(val));
    addLog(`Ambang batas suhu diperbarui menjadi: ${val}°C`, 'system');
  };

  const handleRenameRelay = (id: number, newName: string) => {
    const updated = relays.map(r => r.id === id ? { ...r, label: newName } : r);
    setRelays(updated);
    
    // Save map representation to local storage
    const mapObj: { [key: number]: string } = {};
    updated.forEach(r => { mapObj[r.id] = r.label; });
    localStorage.setItem('relayLabels', JSON.stringify(mapObj));

    addLog(`Relay ${id} berganti nama menjadi: "${newName}"`, 'system');
  };

  // Logging engine
  const addLog = useCallback((text: string, type: LogEntry['type']) => {
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const logId = Math.random().toString(36).substr(2, 9);
    setLogs(prev => {
      const draft = [...prev, { id: logId, timestamp, text, type }];
      // Limit to 150 items for memory stability
      if (draft.length > 150) draft.shift();
      return draft;
    });
  }, []);

  const handleClearLogs = () => {
    setLogs([]);
    speakResponse('Log dibersihkan');
    addLog('Log UI dibersihkan.', 'system');
  };

  // ---- MQTT CLIENTS REFERENCES ----
  const clientMosquittoRef = useRef<MqttClient | null>(null);
  const clientFlespiRef = useRef<MqttClient | null>(null);
  const clientMosquittoAuthRef = useRef<MqttClient | null>(null);

  // Ping tracking store: keys represent timestamp when ping was sent out to respective broker
  const pingTimestampsRef = useRef<{ [key in BrokerId]: number }>({
    mosquitto: 0,
    flespi: 0,
    mosquittoAuth: 0
  });

  // Keep latest sensor values on ref to resolve voice queries cleanly without stale outer states
  const currentTempRef = useRef<number>(27.4);
  const currentHumRef = useRef<number>(55.2);
  useEffect(() => { currentTempRef.current = currentTemp; }, [currentTemp]);
  useEffect(() => { currentHumRef.current = currentHum; }, [currentHum]);

  // Keep references of handlers for Speech recognition callbacks to execute without stale states
  const speechHandlersRef = useRef<{
    relays: Relay[];
    patterns: Pattern[];
    publishToAll: (topic: string, msg: string) => void;
    addLog: (txt: string, ty: LogEntry['type']) => void;
  }>({
    relays: [],
    patterns: [],
    publishToAll: () => {},
    addLog: () => {}
  });

  // Micro clock ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  // Set alert state checks
  useEffect(() => {
    if (currentTemp > tempThreshold) {
      if (!isTempAlertActive) {
        setIsTempAlertActive(true);
        playThresholdBeep();
        addLog(`BAHAYA! Suhu (${currentTemp.toFixed(1)}°C) melebihi batas threshold (${tempThreshold}°C)!`, 'error');
      }
    } else {
      setIsTempAlertActive(false);
    }
  }, [currentTemp, tempThreshold, isTempAlertActive, addLog]);

  // Publish to all connected brokers
  const publishToAll = useCallback((topic: string, payload: string) => {
    let sentCount = 0;
    const clients = [
      { client: clientMosquittoRef.current, name: 'Mosquitto' },
      { client: clientFlespiRef.current, name: 'Flespi' },
      { client: clientMosquittoAuthRef.current, name: 'Mosquitto Auth' }
    ];

    clients.forEach(({ client, name }) => {
      if (client && client.connected) {
        client.publish(topic, payload, { qos: 0 });
        sentCount++;
      }
    });

    addLog(`Publish "${payload}" ke topic "${topic}" (${sentCount}/3 broker aktif terkirim)`, 'publish');
  }, [addLog]);

  // Register refs for speech handlers
  useEffect(() => {
    speechHandlersRef.current = {
      relays,
      patterns,
      publishToAll,
      addLog
    };
  }, [relays, patterns, publishToAll, addLog]);

  // Master switches for relays and patterns
  const handleToggleRelay = (id: number) => {
    const isAnyPolaActive = patterns.some(p => p.active);
    if (isAnyPolaActive) return; // disabled

    const updated = relays.map(r => {
      if (r.id === id) {
        const nextState = !r.active;
        const payload = nextState ? 'ON' : 'OFF';
        publishToAll(`iot/relay/${id}`, payload);
        return { ...r, active: nextState };
      }
      return r;
    });
    setRelays(updated);
  };

  const handleAllRelaysOn = () => {
    if (patterns.some(p => p.active)) return;
    setRelays(prev => prev.map(r => ({ ...r, active: true })));
    publishToAll('iot/relay/1', 'ON');
    publishToAll('iot/relay/2', 'ON');
    publishToAll('iot/relay/3', 'ON');
    publishToAll('iot/relay/4', 'ON');
    speakResponse('Semua relay dinyalakan');
  };

  const handleAllRelaysOff = () => {
    if (patterns.some(p => p.active)) return;
    setRelays(prev => prev.map(r => ({ ...r, active: false })));
    publishToAll('iot/relay/1', 'OFF');
    publishToAll('iot/relay/2', 'OFF');
    publishToAll('iot/relay/3', 'OFF');
    publishToAll('iot/relay/4', 'OFF');
    speakResponse('Semua relay dimatikan');
  };

  const handleTogglePattern = (id: number) => {
    const updated = patterns.map(p => {
      if (p.id === id) {
        const nextState = !p.active;
        const payload = nextState ? 'ON' : 'OFF';
        publishToAll(`iot/pola/${id}`, payload);
        return { ...p, active: nextState };
      }
      return p;
    });
    setPatterns(updated);

    // If a pattern becomes active, we disable relays. (We handle disable in UI automatically)
    if (id === 1 && !patterns[0].active) {
      speakResponse('Pola satu dinyalakan, pola kiri ke kanan aktif');
    } else if (id === 1 && patterns[0].active) {
      speakResponse('Pola satu dimatikan');
    }
    
    if (id === 2 && !patterns[1].active) {
      speakResponse('Pola dua dinyalakan, pola blink bergantian aktif');
    } else if (id === 2 && patterns[1].active) {
      speakResponse('Pola dua dimatikan');
    }
  };

  const handleAllPatternsOn = () => {
    setPatterns(prev => prev.map(p => ({ ...p, active: true })));
    publishToAll('iot/pola/1', 'ON');
    publishToAll('iot/pola/2', 'ON');
    speakResponse('Semua pola dinyalakan');
  };

  const handleAllPatternsOff = () => {
    setPatterns(prev => prev.map(p => ({ ...p, active: false })));
    publishToAll('iot/pola/1', 'OFF');
    publishToAll('iot/pola/2', 'OFF');
    speakResponse('Semua pola dimatikan');
  };

  // ---- MQTT HEARTBEAT PINGS GENERATOR ----
  useEffect(() => {
    // Generate periodic heartbeat/ping checks to measure exact roundtrip latency over public brokers
    const pingTask = setInterval(() => {
      const nowMs = Date.now();
      
      const pingBroker = (clientRef: React.MutableRefObject<MqttClient | null>, brokerId: BrokerId) => {
        const client = clientRef.current;
        if (client && client.connected) {
          pingTimestampsRef.current[brokerId] = nowMs;
          // QoS 0 publish heartbeat
          client.publish(`iot/ping/${brokerId}`, String(nowMs), { qos: 0 });
        }
      };

      pingBroker(clientMosquittoRef, 'mosquitto');
      pingBroker(clientFlespiRef, 'flespi');
      pingBroker(clientMosquittoAuthRef, 'mosquittoAuth');
    }, 5000); // check latency roundtrip every 5s

    return () => clearInterval(pingTask);
  }, []);

  // ---- ESTABLISH CONNECTION WITH BROKERS ----
  useEffect(() => {
    const cidSuffix = Math.floor(Math.random() * 1000000) + '_' + Date.now();
    const isPageSecure = window.location.protocol === 'https:';

    addLog('Menginisialisasi koneksi dengan 3 MQTT broker simultan...', 'system');

    // Setup exponential reconnect backoff callbacks
    const trackBackoff = (brokerId: BrokerId): { getNext: () => number; reset: () => void } => {
      let currentBackoff = 1000; // start 1s
      return {
        getNext: () => {
          const out = currentBackoff;
          currentBackoff = Math.min(currentBackoff * 2, 16000); // 1s, 2s, 4s, up to 16s
          return out;
        },
        reset: () => { currentBackoff = 1000; }
      };
    };

    const backoff1 = trackBackoff('mosquitto');
    const backoff2 = trackBackoff('flespi');
    const backoff3 = trackBackoff('mosquittoAuth');

    // 1. Mosquitto Broker Connection
    const mUrl = isPageSecure 
      ? 'wss://test.mosquitto.org:8081/mqtt'
      : 'ws://test.mosquitto.org:8080/mqtt';
    
    addLog(`Broker 1 Menghubungkan ke ${mUrl}`, 'system');
    const client1 = mqtt.connect(mUrl, {
      clientId: `iot_dash_mosquitto_${cidSuffix}`,
      clean: true,
      reconnectPeriod: backoff1.getNext(),
      connectTimeout: 5000
    });
    clientMosquittoRef.current = client1;

    // 2. Flespi Broker Connection
    const fUrl = isPageSecure
      ? 'wss://mqtt.flespi.io:443'
      : 'ws://mqtt.flespi.io:80';

    addLog(`Broker 2 Menghubungkan ke ${fUrl}`, 'system');
    const client2 = mqtt.connect(fUrl, {
      clientId: `iot_dash_flespi_${cidSuffix}`,
      clean: true,
      username: 'TTCwYVcxvJpmmWMkUSzYz4g4gOXmEcatxSiwYg7DMigyvrfAcjxb9SIrJpejBrVW',
      password: '',
      reconnectPeriod: backoff2.getNext(),
      connectTimeout: 5000
    });
    clientFlespiRef.current = client2;

    // 3. Mosquitto Auth Broker Connection
    const mAuthUrl = isPageSecure
      ? 'wss://test.mosquitto.org:8094/mqtt' // test.mosquitto.org supports SSL over 8094
      : 'ws://test.mosquitto.org:8094/mqtt';

    addLog(`Broker 3 Menghubungkan ke ${mAuthUrl}`, 'system');
    const client3 = mqtt.connect(mAuthUrl, {
      clientId: `iot_dash_mosqauth_${cidSuffix}`,
      clean: true,
      username: 'rw',
      password: 'readwrite',
      reconnectPeriod: backoff3.getNext(),
      connectTimeout: 5000
    });
    clientMosquittoAuthRef.current = client3;

    // Message processing routing engine
    const bindMessageEvents = (client: MqttClient, id: BrokerId) => {
      client.on('connect', () => {
        addLog(`Koneksi sukses dengan ${id === 'mosquitto' ? 'Mosquitto' : id === 'flespi' ? 'Flespi' : 'Mosquitto Auth'}!`, 'system');
        
        // Reset exponential reconnect
        if (id === 'mosquitto') { backoff1.reset(); client1.options.reconnectPeriod = 1000; }
        if (id === 'flespi') { backoff2.reset(); client2.options.reconnectPeriod = 1000; }
        if (id === 'mosquittoAuth') { backoff3.reset(); client3.options.reconnectPeriod = 1000; }

        setBrokers(prev => prev.map(b => b.id === id ? { ...b, connected: true } : b));
        
        // Subscriptions QoS 0
        client.subscribe('iot/sensor/suhu', { qos: 0 });
        client.subscribe('iot/sensor/kelembapan', { qos: 0 });
        client.subscribe(`iot/ping/${id}`, { qos: 0 });
      });

      client.on('message', (topic, payload) => {
        const payloadStr = payload.toString().trim();

        // 1. Temperature Sensor parsing
        if (topic === 'iot/sensor/suhu') {
          const val = parseFloat(payloadStr);
          if (!isNaN(val)) {
            setCurrentTemp(val);
            setPulseTemp(true);
            setTimeout(() => setPulseTemp(false), 800);
            
            // Append history up to 20
            setSensorHistory(prev => {
              const draft = [...prev, { temperature: val, humidity: prev[prev.length - 1]?.humidity || 55.2, timestamp: new Date() }];
              if (draft.length > 20) draft.shift();
              return draft;
            });

            // Trigger warnings in app if exceeds
            if (val > tempThreshold) {
              playThresholdBeep();
            }

            addLog(`[Broker ${id.toUpperCase()}] Data Masuk - Suhu: ${val}°C`, 'mqtt');
          }
        }

        // 2. Humidity Sensor parsing
        if (topic === 'iot/sensor/kelembapan') {
          const val = parseFloat(payloadStr);
          if (!isNaN(val)) {
            setCurrentHum(val);
            setPulseHum(true);
            setTimeout(() => setPulseHum(false), 800);

            // Append history up to 20
            setSensorHistory(prev => {
              const draft = [...prev, { temperature: prev[prev.length - 1]?.temperature || 27.4, humidity: val, timestamp: new Date() }];
              if (draft.length > 20) draft.shift();
              return draft;
            });

            addLog(`[Broker ${id.toUpperCase()}] Data Masuk - Kelembapan: ${val}%`, 'mqtt');
          }
        }

        // 3. Roundtrip Latency Heartbeat parsing
        if (topic === `iot/ping/${id}`) {
          const sentStamp = parseInt(payloadStr, 10);
          if (!isNaN(sentStamp)) {
            const calculatedLatency = Date.now() - sentStamp;
            setBrokers(prev => prev.map(b => b.id === id ? { ...b, latency: Math.max(0, calculatedLatency) } : b));
          }
        }
      });

      client.on('offline', () => {
        // Double reconnection schedule on offline event for compliance with Exponential backoff
        let nextInterval = 2000;
        if (id === 'mosquitto') { nextInterval = backoff1.getNext(); client1.options.reconnectPeriod = nextInterval; }
        if (id === 'flespi') { nextInterval = backoff2.getNext(); client2.options.reconnectPeriod = nextInterval; }
        if (id === 'mosquittoAuth') { nextInterval = backoff3.getNext(); client3.options.reconnectPeriod = nextInterval; }

        setBrokers(prev => prev.map(b => b.id === id ? { ...b, connected: false, latency: null } : b));
        addLog(`Koneksi disconnect dari broker ${id === 'mosquitto' ? 'Mosquitto' : id === 'flespi' ? 'Flespi' : 'Mosquitto Auth'}. Reconnect dalam ${nextInterval / 1000}s...`, 'error');
      });

      client.on('error', (err) => {
        setBrokers(prev => prev.map(b => b.id === id ? { ...b, connected: false, latency: null } : b));
        addLog(`MQTT Hubungi Error [${id}]: ${err.message}`, 'error');
      });
    };

    bindMessageEvents(client1, 'mosquitto');
    bindMessageEvents(client2, 'flespi');
    bindMessageEvents(client3, 'mosquittoAuth');

    // Tear down connections on unmount cleanup
    return () => {
      addLog('Menutup koneksi MQTT broker...', 'system');
      client1.end(true);
      client2.end(true);
      client3.end(true);
    };
  }, [tempThreshold, addLog]);

  // ---- ACTIVE PATTERNS AUTOMATED EXECUTION EFFECT ----
  // Automatically drives physical relays and broadcasts MQTT updates when Pola is enabled
  useEffect(() => {
    const isPola1 = patterns[0]?.active || false;
    const isPola2 = patterns[1]?.active || false;

    if (!isPola1 && !isPola2) return;

    let step = 0;
    const interval = setInterval(() => {
      if (isPola1) {
        // Pola 1: Kiri ke Kanan (sequentially turn on Relay 1 -> 2 -> 3 -> 4)
        const activeId = (step % 4) + 1;
        setRelays(prev => {
          return prev.map(r => {
            const nextActive = r.id === activeId;
            if (r.active !== nextActive) {
              publishToAll(`iot/relay/${r.id}`, nextActive ? 'ON' : 'OFF');
            }
            return { ...r, active: nextActive };
          });
        });
      } else if (isPola2) {
        // Pola 2: Blink Bergantian (1 & 3 ON vs 2 & 4 ON, flip-flop cycle)
        const oddActive = step % 2 === 0;
        setRelays(prev => {
          return prev.map(r => {
            const isOdd = r.id % 2 !== 0;
            const nextActive = isOdd ? oddActive : !oddActive;
            if (r.active !== nextActive) {
              publishToAll(`iot/relay/${r.id}`, nextActive ? 'ON' : 'OFF');
            }
            return { ...r, active: nextActive };
          });
        });
      }
      step++;
    }, 1000);

    return () => {
      clearInterval(interval);
      // Turn off all active simulated devices safely when pattern stops
      setRelays(prev => {
        return prev.map(r => {
          if (r.active) {
            publishToAll(`iot/relay/${r.id}`, 'OFF');
          }
          return { ...r, active: false };
        });
      });
    };
  }, [patterns, publishToAll]);

  // ---- SPEECH RECOGNITION (Web Speech API) ----
  const isListeningRef = useRef<boolean>(false);
  const permissionGrantedRef = useRef<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Check microphone permissions on loader
  useEffect(() => {
    const examineMicrophoneStatus = async () => {
      try {
        if (!navigator.permissions || !navigator.permissions.query) {
          // Fallback if unsupported
          setPermissionStatus('prompt');
          return;
        }
        const stateResult = await navigator.permissions.query({ name: 'microphone' as any });
        if (stateResult.state === 'granted') {
          permissionGrantedRef.current = true;
          setPermissionStatus('granted');
        } else if (stateResult.state === 'denied') {
          permissionGrantedRef.current = false;
          setPermissionStatus('denied');
        } else {
          permissionGrantedRef.current = false;
          setPermissionStatus('prompt');
        }

        // Bind update triggers
        stateResult.onchange = () => {
          if (stateResult.state === 'granted') {
            permissionGrantedRef.current = true;
            setPermissionStatus('granted');
          } else if (stateResult.state === 'denied') {
            permissionGrantedRef.current = false;
            setPermissionStatus('denied');
            setIsMicListening(false);
            isListeningRef.current = false;
          } else {
            permissionGrantedRef.current = false;
            setPermissionStatus('prompt');
          }
        };
      } catch (err) {
        // Permissions query error fallback
        setPermissionStatus('prompt');
      }
    };
    examineMicrophoneStatus();
  }, []);

  // Set-up Speech SpeechRecognition
  const startSpeechEngine = useCallback(() => {
    const SpeechObj = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechObj) {
      addLog('Speech Recognition tidak didukung di browser ini. Gunakan Chrome/Edge.', 'error');
      return;
    }

    const rec = new SpeechObj();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'id-ID';

    rec.onstart = () => {
      setIsMicListening(true);
      isListeningRef.current = true;
      addLog('Mikrofon aktif. Mendengarkan perintah suara...', 'system');
    };

    rec.onresult = (evt: any) => {
      const idx = evt.resultIndex;
      const transcriptStr = evt.results[idx][0].transcript;
      setLastRecognizedText(transcriptStr);

      const rawText = transcriptStr.toLowerCase().trim();
      addLog(`Mengenali suara: "${transcriptStr}"`, 'voice');

      // UTILITIES FOR SPEECH MATCHING
      const matches = (keywords: string[]) => keywords.some(key => rawText.includes(key));

      const ctx = speechHandlersRef.current;
      const relaysList = ctx.relays || [];

      // 1. SEMUA RELAY ON (MANUAL SWITCHES - DEACTIVATES PATTERNS FIRST)
      const keysAllRelayOn = [
        "semua relay nyala", "hidupkan semua relay", "nyalakan semua relay",
        "semua relay on", "aktifkan semua relay", "relay semua nyala", "semua relay hidup",
        "hidupkan seluruh relay", "nyalakan seluruh relay", "aktifkan seluruh relay",
        "seluruh relay nyala", "semua relay aktif", "relay on semua", "on semua relay",
        "semua on", "nyalain semua relay", "on kan semua relay", "nyalakan semua",
        "hidupkan semua", "semua hidup", "semua nyala", "nyalakan lampu", "nyalakan semua lampu",
        "hidupkan semua lampu", "semua lampu hidup", "semua lampu nyala"
      ];
      if (matches(keysAllRelayOn)) {
        // Automatically deactivate active patterns when manual state is triggered
        setPatterns(prev => prev.map(p => ({ ...p, active: false })));
        ctx.publishToAll('iot/pola/1', 'OFF');
        ctx.publishToAll('iot/pola/2', 'OFF');

        setRelays(prev => prev.map(r => ({ ...r, active: true })));
        ctx.publishToAll('iot/relay/1', 'ON');
        ctx.publishToAll('iot/relay/2', 'ON');
        ctx.publishToAll('iot/relay/3', 'ON');
        ctx.publishToAll('iot/relay/4', 'ON');
        speakResponse('Semua relay dinyalakan');
        return;
      }

      // 2. SEMUA RELAY OFF
      const keysAllRelayOff = [
        "semua relay mati", "matikan semua relay", "semua relay off",
        "nonaktifkan semua relay", "relay semua mati", "semua relay padam",
        "matikan seluruh relay", "nonaktifkan seluruh relay", "seluruh relay mati",
        "semua relay nonaktif", "padamkan semua relay", "relay off semua", "off semua relay",
        "semua off", "matiin semua relay", "off kan semua relay", "matikan semua",
        "matikan semua lampu", "matikan lampu", "semua mati", "semua padam"
      ];
      if (matches(keysAllRelayOff)) {
        // Automatically deactivate active patterns when manual state is triggered
        setPatterns(prev => prev.map(p => ({ ...p, active: false })));
        ctx.publishToAll('iot/pola/1', 'OFF');
        ctx.publishToAll('iot/pola/2', 'OFF');

        setRelays(prev => prev.map(r => ({ ...r, active: false })));
        ctx.publishToAll('iot/relay/1', 'OFF');
        ctx.publishToAll('iot/relay/2', 'OFF');
        ctx.publishToAll('iot/relay/3', 'OFF');
        ctx.publishToAll('iot/relay/4', 'OFF');
        speakResponse('Semua relay dimatikan');
        return;
      }

      // 3. RELAY INDIVIDUAL ON (DEACTIVATES PATTERNS FIRST TO ALLOW DIRECT MANUAL STATE)
      const relay1On = [
        "relay satu nyala", "hidupkan relay satu", "relay satu on", "relay 1 nyala", "relay 1 on", 
        "aktifkan relay satu", "nyalakan relay satu", "relay pertama nyala", "nyalakan relay 1", 
        "hidupkan relay 1", "aktifkan relay 1", "nyalakan lampu satu", "nyalakan lampu 1", 
        "hidupkan lampu 1", "lampu 1 on", "lampu satu on", "lampu 1 nyala", "lampu satu nyala",
        "nyalakan teras", "hidupkan teras", "teras on", "teras nyala", "nyala teras", "lampu teras nyala",
        "lampu teras on", "hidupkan lampu teras", "nyalakan lampu teras", "hidupkan lampu utama", "nyalakan lampu utama"
      ];
      const relay2On = [
        "relay dua nyala", "hidupkan relay dua", "relay dua on", "relay 2 nyala", "relay 2 on", 
        "aktifkan relay dua", "nyalakan relay dua", "relay kedua nyala", "nyalakan relay 2", 
        "hidupkan relay 2", "aktifkan relay 2", "nyalakan lampu dua", "nyalakan lampu 2", 
        "hidupkan lampu 2", "lampu 2 on", "lampu dua on", "lampu 2 nyala", "lampu dua nyala",
        "nyalakan pompa", "hidupkan pompa", "pompa on", "pompa nyala", "jalankan pompa", "nyalakan pompa air",
        "hidupkan pompa air", "pompa air on", "pompa air nyala", "kebun nyala", "nyalakan kebun", "hidupkan kebun"
      ];
      const relay3On = [
        "relay tiga nyala", "hidupkan relay tiga", "relay tiga on", "relay 3 nyala", "relay 3 on", 
        "aktifkan relay tiga", "nyalakan relay tiga", "relay ketiga nyala", "nyalakan relay 3", 
        "hidupkan relay 3", "aktifkan relay 3", "nyalakan lampu tiga", "nyalakan lampu 3", 
        "hidupkan lampu 3", "lampu 3 on", "lampu tiga on", "lampu 3 nyala", "lampu tiga nyala",
        "nyalakan taman", "hidupkan taman", "taman on", "taman nyala", "nyalakan lampu taman", "hidupkan lampu taman",
        "lampu taman on", "lampu taman nyala", "taman belakang nyala", "nyalakan taman belakang", "hidupkan taman belakang"
      ];
      const relay4On = [
        "relay empat nyala", "hidupkan relay empat", "relay empat on", "relay 4 nyala", "relay 4 on", 
        "aktifkan relay empat", "nyalakan relay empat", "relay keempat nyala", "nyalakan relay 4", 
        "hidupkan relay 4", "aktifkan relay 4", "nyalakan lampu empat", "nyalakan lampu 4", 
        "hidupkan lampu 4", "lampu 4 on", "lampu empat on", "lampu 4 nyala", "lampu empat nyala",
        "nyalakan kipas", "hidupkan kipas", "kipas on", "kipas nyala", "nyalakan exhaust", "hidupkan exhaust",
        "exhaust on", "exhaust nyala", "kipas angin nyala", "nyalakan kipas angin", "hidupkan kipas angin"
      ];

      if (matches(relay1On)) {
        setPatterns(prev => prev.map(p => ({ ...p, active: false })));
        ctx.publishToAll('iot/pola/1', 'OFF');
        ctx.publishToAll('iot/pola/2', 'OFF');

        setRelays(prev => prev.map(r => r.id === 1 ? { ...r, active: true } : r));
        ctx.publishToAll('iot/relay/1', 'ON');
        const label = relaysList[0]?.label || 'Relay satu';
        speakResponse(`${label} dinyalakan`);
        return;
      }
      if (matches(relay2On)) {
        setPatterns(prev => prev.map(p => ({ ...p, active: false })));
        ctx.publishToAll('iot/pola/1', 'OFF');
        ctx.publishToAll('iot/pola/2', 'OFF');

        setRelays(prev => prev.map(r => r.id === 2 ? { ...r, active: true } : r));
        ctx.publishToAll('iot/relay/2', 'ON');
        const label = relaysList[1]?.label || 'Relay dua';
        speakResponse(`${label} dinyalakan`);
        return;
      }
      if (matches(relay3On)) {
        setPatterns(prev => prev.map(p => ({ ...p, active: false })));
        ctx.publishToAll('iot/pola/1', 'OFF');
        ctx.publishToAll('iot/pola/2', 'OFF');

        setRelays(prev => prev.map(r => r.id === 3 ? { ...r, active: true } : r));
        ctx.publishToAll('iot/relay/3', 'ON');
        const label = relaysList[2]?.label || 'Relay tiga';
        speakResponse(`${label} dinyalakan`);
        return;
      }
      if (matches(relay4On)) {
        setPatterns(prev => prev.map(p => ({ ...p, active: false })));
        ctx.publishToAll('iot/pola/1', 'OFF');
        ctx.publishToAll('iot/pola/2', 'OFF');

        setRelays(prev => prev.map(r => r.id === 4 ? { ...r, active: true } : r));
        ctx.publishToAll('iot/relay/4', 'ON');
        const label = relaysList[3]?.label || 'Relay empat';
        speakResponse(`${label} dinyalakan`);
        return;
      }

      // 4. RELAY INDIVIDUAL OFF
      const relay1Off = [
        "relay satu mati", "matikan relay satu", "relay satu off", "relay 1 mati", "relay 1 off", 
        "nonaktifkan relay satu", "padamkan relay satu", "relay pertama mati", "matikan relay 1", 
        "nonaktifkan relay 1", "matikan lampu satu", "matikan lampu 1", "lampu 1 off", "lampu satu off", 
        "lampu 1 mati", "lampu satu mati",
        "matikan teras", "padamkan teras", "teras off", "teras mati", "mati teras", "lampu teras mati",
        "lampu teras off", "matikan lampu teras", "matikan lampu utama", "padamkan lampu utama"
      ];
      const relay2Off = [
        "relay dua mati", "matikan relay dua", "relay dua off", "relay 2 mati", "relay 2 off", 
        "nonaktifkan relay dua", "padamkan relay dua", "relay kedua mati", "matikan relay 2", 
        "nonaktifkan relay 2", "matikan lampu dua", "matikan lampu 2", "lampu 2 off", "lampu dua off", 
        "lampu 2 mati", "lampu dua mati",
        "matikan pompa", "stop pompa", "pompa off", "pompa mati", "matikan pompa air", "stop pompa air",
        "pompa air off", "pompa air mati", "kebun mati", "matikan kebun", "hentikan pompa"
      ];
      const relay3Off = [
        "relay tiga mati", "matikan relay tiga", "relay tiga off", "relay 3 mati", "relay 3 off", 
        "nonaktifkan relay tiga", "padamkan relay tiga", "relay ketiga mati", "matikan relay 3", 
        "nonaktifkan relay 3", "matikan lampu tiga", "matikan lampu 3", "lampu 3 off", "lampu tiga off", 
        "lampu 3 mati", "lampu tiga mati",
        "matikan taman", "padamkan taman", "taman off", "taman mati", "matikan lampu taman", "padamkan lampu taman",
        "lampu taman off", "lampu taman mati", "matikan taman belakang", "padamkan taman belakang"
      ];
      const relay4Off = [
        "relay empat mati", "matikan relay empat", "relay empat off", "relay 4 mati", "relay 4 off", 
        "nonaktifkan relay empat", "padamkan relay empat", "relay keempat mati", "matikan relay 4", 
        "nonaktifkan relay 4", "matikan lampu empat", "matikan lampu 4", "lampu 4 off", "lampu empat off", 
        "lampu 4 mati", "lampu empat mati",
        "matikan kipas", "stop kipas", "kipas off", "kipas mati", "matikan exhaust", "stop exhaust",
        "exhaust off", "exhaust mati", "matikan kipas angin", "stop kipas angin"
      ];

      if (matches(relay1Off)) {
        setPatterns(prev => prev.map(p => ({ ...p, active: false })));
        ctx.publishToAll('iot/pola/1', 'OFF');
        ctx.publishToAll('iot/pola/2', 'OFF');

        setRelays(prev => prev.map(r => r.id === 1 ? { ...r, active: false } : r));
        ctx.publishToAll('iot/relay/1', 'OFF');
        const label = relaysList[0]?.label || 'Relay satu';
        speakResponse(`${label} dimatikan`);
        return;
      }
      if (matches(relay2Off)) {
        setPatterns(prev => prev.map(p => ({ ...p, active: false })));
        ctx.publishToAll('iot/pola/1', 'OFF');
        ctx.publishToAll('iot/pola/2', 'OFF');

        setRelays(prev => prev.map(r => r.id === 2 ? { ...r, active: false } : r));
        ctx.publishToAll('iot/relay/2', 'OFF');
        const label = relaysList[1]?.label || 'Relay dua';
        speakResponse(`${label} dimatikan`);
        return;
      }
      if (matches(relay3Off)) {
        setPatterns(prev => prev.map(p => ({ ...p, active: false })));
        ctx.publishToAll('iot/pola/1', 'OFF');
        ctx.publishToAll('iot/pola/2', 'OFF');

        setRelays(prev => prev.map(r => r.id === 3 ? { ...r, active: false } : r));
        ctx.publishToAll('iot/relay/3', 'OFF');
        const label = relaysList[2]?.label || 'Relay tiga';
        speakResponse(`${label} dimatikan`);
        return;
      }
      if (matches(relay4Off)) {
        setPatterns(prev => prev.map(p => ({ ...p, active: false })));
        ctx.publishToAll('iot/pola/1', 'OFF');
        ctx.publishToAll('iot/pola/2', 'OFF');

        setRelays(prev => prev.map(r => r.id === 4 ? { ...r, active: false } : r));
        ctx.publishToAll('iot/relay/4', 'OFF');
        const label = relaysList[3]?.label || 'Relay empat';
        speakResponse(`${label} dimatikan`);
        return;
      }

      // 4b. SMART DYNAMIC DEVICE voice matching for custom names/labels as fallback
      const onTriggers = ["nyalakan", "hidupkan", "aktifkan", "onkan", "nyalain", "on", "nyala", "hidup"];
      const offTriggers = ["matikan", "nonaktifkan", "offkan", "matiin", "off", "mati", "padam", "tutup", "stop"];

      const hasOnTrigger = onTriggers.some(t => rawText.includes(t));
      const hasOffTrigger = offTriggers.some(t => rawText.includes(t));

      if (hasOnTrigger || hasOffTrigger) {
        for (const r of relaysList) {
          const labelLower = r.label.toLowerCase();
          if (rawText.includes(labelLower)) {
            const nextState = hasOnTrigger;
            setPatterns(prev => prev.map(p => ({ ...p, active: false })));
            ctx.publishToAll('iot/pola/1', 'OFF');
            ctx.publishToAll('iot/pola/2', 'OFF');

            setRelays(prev => prev.map(item => item.id === r.id ? { ...item, active: nextState } : item));
            ctx.publishToAll(`iot/relay/${r.id}`, nextState ? 'ON' : 'OFF');
            speakResponse(`${r.label} di${nextState ? 'nyalakan' : 'matikan'}`);
            return;
          }
        }
      }

      // 5. SEMUA POLA ON
      const keysAllPolaOn = [
        "semua pola nyala", "hidupkan semua pola", "aktifkan semua pola", "nyalakan semua pola", 
        "semua pola on", "semua pola aktif", "aktifkan seluruh pola", "hidupkan seluruh pola", 
        "seluruh pola nyala", "pola on semua", "on semua pola", "nyalain semua pola", 
        "hidupkan pola semua", "pola semua on", "on kan semua pola", "aktifkan semua pola otomatis"
      ];
      if (matches(keysAllPolaOn)) {
        setPatterns(prev => prev.map(p => ({ ...p, active: true })));
        ctx.publishToAll('iot/pola/1', 'ON');
        ctx.publishToAll('iot/pola/2', 'ON');
        speakResponse('Semua pola dinyalakan');
        return;
      }

      // 6. SEMUA POLA OFF
      const keysAllPolaOff = [
        "matikan semua pola", "stop pola", "semua pola mati", "nonaktifkan semua pola", 
        "semua pola off", "matikan seluruh pola", "stop semua pola", "nonaktifkan seluruh pola", 
        "seluruh pola mati", "padamkan semua pola", "pola off semua", "off semua pola", 
        "matiin semua pola", "matikan pola semua", "hentikan semua pola"
      ];
      if (matches(keysAllPolaOff)) {
        setPatterns(prev => prev.map(p => ({ ...p, active: false })));
        ctx.publishToAll('iot/pola/1', 'OFF');
        ctx.publishToAll('iot/pola/2', 'OFF');
        speakResponse('Semua pola dimatikan');
        return;
      }

      // 7. POLA 1 ON
      const keysPola1On = [
        "hidupkan pola satu", "pola satu nyala", "aktifkan pola satu", "pola 1 nyala", 
        "nyalakan pola satu", "pola satu on", "pola 1 on", "jalankan pola satu", 
        "nyalakan pola 1", "hidupkan pola 1", "aktifkan pola 1", "jalankan pola 1", 
        "pola satu hidup", "pola 1 hidup", "aktifkan pola kiri ke kanan", "pola kiri ke kanan"
      ];
      if (matches(keysPola1On)) {
        // Enforce mutual exclusivity to prevent overlapping pattern loops
        setPatterns(prev => prev.map(p => p.id === 1 ? { ...p, active: true } : { ...p, active: false }));
        ctx.publishToAll('iot/pola/1', 'ON');
        ctx.publishToAll('iot/pola/2', 'OFF');
        speakResponse('Pola satu dinyalakan, pola kiri ke kanan aktif');
        return;
      }

      // 8. POLA 1 OFF
      const keysPola1Off = [
        "matikan pola satu", "stop pola satu", "pola satu mati", "pola 1 mati", 
        "pola 1 off", "nonaktifkan pola satu", "hentikan pola satu", "matikan pola 1", 
        "stop pola 1", "nonaktifkan pola 1", "hentikan pola 1"
      ];
      if (matches(keysPola1Off)) {
        setPatterns(prev => prev.map(p => p.id === 1 ? { ...p, active: false } : p));
        ctx.publishToAll('iot/pola/1', 'OFF');
        speakResponse('Pola satu dimatikan');
        return;
      }

      // 9. POLA 2 ON
      const keysPola2On = [
        "hidupkan pola dua", "pola dua nyala", "aktifkan pola dua", "pola 2 nyala", 
        "nyalakan pola dua", "pola dua on", "pola 2 on", "jalankan pola dua", 
        "nyalakan pola 2", "hidupkan pola 2", "aktifkan pola 2", "jalankan pola 2", 
        "pola dua hidup", "pola 2 hidup", "aktifkan pola blink", "pola blink", "pola ganjil genap"
      ];
      if (matches(keysPola2On)) {
        // Enforce mutual exclusivity to prevent overlapping pattern loops
        setPatterns(prev => prev.map(p => p.id === 2 ? { ...p, active: true } : { ...p, active: false }));
        ctx.publishToAll('iot/pola/2', 'ON');
        ctx.publishToAll('iot/pola/1', 'OFF');
        speakResponse('Pola dua dinyalakan, pola blink bergantian aktif');
        return;
      }

      // 10. POLA 2 OFF
      const keysPola2Off = [
        "matikan pola dua", "stop pola dua", "pola dua mati", "pola 2 mati", 
        "pola 2 off", "nonaktifkan pola dua", "hentikan pola dua", "matikan pola 2", 
        "stop pola 2", "nonaktifkan pola 2", "hentikan pola 2"
      ];
      if (matches(keysPola2Off)) {
        setPatterns(prev => prev.map(p => p.id === 2 ? { ...p, active: false } : p));
        ctx.publishToAll('iot/pola/2', 'OFF');
        speakResponse('Pola dua dimatikan');
        return;
      }

      // 11. QUERY SENSOR
      const keysQueryTemp = ["tampilkan suhu", "berapa suhu", "cek suhu", "baca suhu", "suhu sekarang", "suhu saat ini"];
      const keysQueryHum = ["tampilkan kelembapan", "berapa kelembapan", "cek kelembapan", "kelembapan sekarang"];
      const keysQueryAll = ["tampilkan sensor", "cek sensor", "baca sensor", "status sensor", "info sensor"];

      if (matches(keysQueryTemp)) {
        const val = currentTempRef.current;
        speakResponse(`Suhu saat ini ${val.toFixed(1)} derajat celsius`);
        return;
      }
      if (matches(keysQueryHum)) {
        const val = currentHumRef.current;
        speakResponse(`Kelembapan saat ini ${val.toFixed(0)} persen`);
        return;
      }
      if (matches(keysQueryAll)) {
        const tVal = currentTempRef.current;
        const hVal = currentHumRef.current;
        speakResponse(`Suhu ${tVal.toFixed(1)} derajat, kelembapan ${hVal.toFixed(0)} persen`);
        return;
      }

      // 12. UTILITIES
      const keysClearLog = ["bersihkan log", "hapus log", "clear log"];
      if (matches(keysClearLog)) {
        setLogs([]);
        speakResponse('Log dibersihkan');
        return;
      }

      const keysShutdown = ["semua mati", "matikan semua", "shutdown"];
      if (matches(keysShutdown)) {
        setRelays(prev => prev.map(r => ({ ...r, active: false })));
        setPatterns(prev => prev.map(p => ({ ...p, active: false })));
        ctx.publishToAll('iot/relay/1', 'OFF');
        ctx.publishToAll('iot/relay/2', 'OFF');
        ctx.publishToAll('iot/relay/3', 'OFF');
        ctx.publishToAll('iot/relay/4', 'OFF');
        ctx.publishToAll('iot/pola/1', 'OFF');
        ctx.publishToAll('iot/pola/2', 'OFF');
        speakResponse('Semua perangkat dimatikan');
        return;
      }

    };

    rec.onerror = (evt: any) => {
      const err = evt.error;
      if (err === 'not-allowed' || err === 'audio-capture') {
        permissionGrantedRef.current = false;
        setPermissionStatus('denied');
        setIsMicListening(false);
        isListeningRef.current = false;
        addLog('Akses mikrofon ditolak oleh browser. Tidak dapat mengaktifkan voice command.', 'error');
      } else if (err === 'aborted') {
        // do nothing, expected abort in some scenarios
      } else {
        addLog(`Speech error: ${err}`, 'error');
        setIsMicListening(false);
        isListeningRef.current = false;
      }
    };

    rec.onend = () => {
      // Auto-restart continuously ONLY if the control is active & permissions are ok
      if (isListeningRef.current && permissionGrantedRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // ignore double starts
        }
      } else {
        setIsMicListening(false);
        isListeningRef.current = false;
      }
    };

    recognitionRef.current = rec;
    return rec;
  }, [addLog]);

  // Click microphone action
  const handleToggleMic = async () => {
    // If browser doesn't have mediaDevices or getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      addLog('Akses mikrofon tidak didukung oleh browser Anda.', 'error');
      setPermissionStatus('denied');
      return;
    }

    if (isMicListening) {
      // Turn off
      isListeningRef.current = false;
      setIsMicListening(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      speakResponse('Kontrol suara dinonaktifkan');
      addLog('Kontrol suara dinonaktifkan.', 'system');
      return;
    }

    // Request permissions
    try {
      setPermissionStatus('requesting');
      addLog('Meminta izin akses mikrofon...', 'system');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop stream immediately since we only used it for trigger permission
      stream.getTracks().forEach(track => track.stop());

      permissionGrantedRef.current = true;
      setPermissionStatus('granted');

      // Initialize speech recognition if empty
      const engine = recognitionRef.current || startSpeechEngine();
      if (engine) {
        isListeningRef.current = true;
        engine.start();
        speakResponse('Kontrol suara aktif, siap menerima perintah');
      }
    } catch (err) {
      permissionGrantedRef.current = false;
      setPermissionStatus('denied');
      addLog('Gagal mengaktifkan mikrofon: Izin ditolak atau diblokir browser.', 'error');
    }
  };

  const isAnyPatternActive = patterns.some(p => p.active);

  return (
    <div className="min-h-screen bg-[#0d0618] text-[#f3f4f6] pb-8">
      
      {/* Background Subtle Stars Animation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden h-[300px] z-0">
        <div className="star-bg w-full h-[300px] opacity-20"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 relative z-10 pt-4">
        
        {/* HEADER SECTION */}
        <header className="mb-4 bg-[#1a0a2e] p-4 rounded-xl purple-glow relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="absolute inset-0 star-bg opacity-10 pointer-events-none"></div>
          <div className="flex items-center space-x-3 z-10">
            <div className="p-2 bg-[#A855F7]/20 border border-[#A855F7]/40 rounded-lg text-[#C084FC] animate-pulse">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black font-orbitron tracking-wider text-[#A855F7]">
                IoT DASHBOARD
              </h1>
              <span className="text-[10px] text-gray-400 block font-mono uppercase tracking-widest">
                BROKER WEB-GATEWAY SECURE EDITION V1.2
              </span>
            </div>
          </div>

          {/* Clock Widget */}
          <div className="flex items-center space-x-4 z-10">
            
            {/* Realtime Date widget */}
            <div className="hidden sm:flex items-center space-x-2 text-right border-r border-[#A855F7]/20 pr-4">
              <div className="text-[10px] text-gray-300 font-mono">
                <div className="font-bold text-gray-200 capitalize leading-tight">
                  {now.toLocaleDateString('id-ID', { weekday: 'long' })}
                </div>
                <div className="leading-tight">
                  {now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <Calendar className="w-3.5 h-3.5 text-[#A855F7]" />
            </div>

            {/* Orbitron Digital Clock widget */}
            <div className="flex items-center space-x-2 bg-[#0d0618]/65 px-3 py-1.5 border border-purple-900/30 rounded-lg">
              <Clock className="w-4 h-4 text-[#A855F7]" />
              <span 
                id="digital-clock"
                className="font-orbitron font-extrabold text-[#C084FC] text-xl tracking-wider min-w-[110px]"
              >
                {now.toLocaleTimeString('id-ID', { hour12: false })}
              </span>
            </div>

          </div>
        </header>

        {/* MAIN MODULES GRID LAYOUT */}
        <main className="space-y-4">
          
          {/* Section 1: Sensors view with embedded canvas */}
          <section id="sensor-panel-section">
            <SensorPanel 
              currentTemp={currentTemp}
              currentHum={currentHum}
              sensorHistory={sensorHistory}
              tempThreshold={tempThreshold}
              setTempThreshold={setTempThreshold}
              isTempAlertActive={isTempAlertActive}
              onAlertTriggered={playThresholdBeep}
              pulseTemp={pulseTemp}
              pulseHum={pulseHum}
            />
          </section>

          {/* Section 2: Relay Controls and Automation pattern */}
          <section id="relay-control-section" className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <RelayControl
              relays={relays}
              onToggleRelay={handleToggleRelay}
              onAllRelaysOn={handleAllRelaysOn}
              onAllRelaysOff={handleAllRelaysOff}
              onRenameRelay={handleRenameRelay}
              isPatternActive={isAnyPatternActive}
            />
            <PolaLampu
              patterns={patterns}
              onTogglePattern={handleTogglePattern}
              onAllPatternsOn={handleAllPatternsOn}
              onAllPatternsOff={handleAllPatternsOff}
            />
          </section>

          {/* Section 3: MQTT connection indicators and active input Voice Commands */}
          <section id="network-voice-section" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VoiceController
              isListening={isMicListening}
              permissionStatus={permissionStatus}
              lastRecognizedText={lastRecognizedText}
              onToggleMic={handleToggleMic}
            />
            <BrokerStatusView brokers={brokers} />
          </section>

          {/* Section 4: Full broad console logs panel */}
          <section id="terminal-logs-section">
            <ActivityLogs 
              logs={logs}
              onClearLogs={handleClearLogs}
            />
          </section>

        </main>

        {/* Subtle Copyright Footer */}
        <footer className="mt-8 pt-4 border-t border-purple-900/35 flex flex-col sm:flex-row items-center justify-between text-[10px] text-gray-500 font-mono gap-2">
          <span>KONTROL SISTEM INTEGRASI ESP32 - PURPLE WORKSPACE</span>
          <span>© 2026 REALTIME MQTT BROKER INTERACTIVE SYSTEMS</span>
        </footer>

      </div>
    </div>
  );
}
