import React, { useState, useRef, useEffect } from 'react';
import { Radio, Volume2, VolumeX, Mic, MicOff, Signal, Users } from 'lucide-react';

// WebSocket szerver URL - ezt cseréld ki a saját szervered címére
const WS_SERVER = 'ws://localhost:3001';

// WebRTC konfiguráció - STUN szerverek a NAT átjáráshoz
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export default function CBRadioApp() {
  const [channel, setChannel] = useState(19);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState([]);
  const [activePeers, setActivePeers] = useState(new Set());
  const [volume, setVolume] = useState(0);
  
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const userIdRef = useRef(null);
  
  // WebSocket kapcsolat létrehozása
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  function connectWebSocket() {
    const ws = new WebSocket(WS_SERVER);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket kapcsolat létrejött');
      joinChannel(channel);
    };
    
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'channel-joined':
          userIdRef.current = data.userId;
          setPeers(data.peers);
          // Kapcsolat létrehozása a meglévő peerekkel
          data.peers.forEach(peerId => createPeerConnection(peerId, true));
          break;
          
        case 'peer-joined':
          setPeers(prev => [...prev, data.userId]);
          break;
          
        case 'peer-left':
          setPeers(prev => prev.filter(id => id !== data.userId));
          closePeerConnection(data.userId);
          break;
          
        case 'offer':
          await handleOffer(data);
          break;
          
        case 'answer':
          await handleAnswer(data);
          break;
          
        case 'ice-candidate':
          await handleIceCandidate(data);
          break;
          
        case 'peer-transmitting':
          setActivePeers(prev => {
            const newSet = new Set(prev);
            if (data.transmitting) {
              newSet.add(data.userId);
            } else {
              newSet.delete(data.userId);
            }
            return newSet;
          });
          break;
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket hiba:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket kapcsolat bezárult');
      setIsConnected(false);
      // Újracsatlakozás 3 másodperc után
      setTimeout(connectWebSocket, 3000);
    };
  }
  
  function joinChannel(channelId) {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'join-channel',
        channel: channelId
      }));
    }
  }
  
  // WebRTC peer connection létrehozása
  function createPeerConnection(peerId, initiator = false) {
    if (peerConnectionsRef.current[peerId]) {
      return peerConnectionsRef.current[peerId];
    }
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[peerId] = pc;
    
    // Helyi audio stream hozzáadása
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }
    
    // Távoli audio stream kezelése
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      playRemoteAudio(remoteStream, peerId);
    };
    
    // ICE candidate kezelése
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          to: peerId
        }));
      }
    };
    
    // Ha mi vagyunk a kezdeményező, offer-t küldünk
    if (initiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          if (wsRef.current) {
            wsRef.current.send(JSON.stringify({
              type: 'offer',
              offer: pc.localDescription,
              to: peerId
            }));
          }
        })
        .catch(err => console.error('Offer létrehozási hiba:', err));
    }
    
    return pc;
  }
  
  async function handleOffer(data) {
    const pc = createPeerConnection(data.from);
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'answer',
          answer: pc.localDescription,
          to: data.from
        }));
      }
    } catch (err) {
      console.error('Offer kezelési hiba:', err);
    }
  }
  
  async function handleAnswer(data) {
    const pc = peerConnectionsRef.current[data.from];
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (err) {
        console.error('Answer kezelési hiba:', err);
      }
    }
  }
  
  async function handleIceCandidate(data) {
    const pc = peerConnectionsRef.current[data.from];
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('ICE candidate hiba:', err);
      }
    }
  }
  
  function closePeerConnection(peerId) {
    const pc = peerConnectionsRef.current[peerId];
    if (pc) {
      pc.close();
      delete peerConnectionsRef.current[peerId];
    }
  }
  
  function playRemoteAudio(stream, peerId) {
    // Audio elem létrehozása a távoli hanghoz
    let audioElement = document.getElementById(`audio-${peerId}`);
    
    if (!audioElement) {
      audioElement = document.createElement('audio');
      audioElement.id = `audio-${peerId}`;
      audioElement.autoplay = true;
      document.body.appendChild(audioElement);
    }
    
    audioElement.srcObject = stream;
  }
  useEffect(() => {
    async function setupAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        localStreamRef.current = stream;
        
        // Audio context létrehozása hangerő méréshez
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        analyserRef.current.fftSize = 256;
        
        setIsConnected(true);
      } catch (error) {
        console.error('Mikrofon hozzáférés hiba:', error);
        alert('Kérlek engedélyezd a mikrofon hozzáférést!');
      }
    }
    
    setupAudio();
    
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
  
  // Hangerő mérés
  useEffect(() => {
    if (!analyserRef.current || !isTransmitting) {
      setVolume(0);
      return;
    }
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    function measureVolume() {
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setVolume(Math.min(100, (average / 255) * 100));
      animationFrameRef.current = requestAnimationFrame(measureVolume);
    }
    
    measureVolume();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isTransmitting]);
  
  // PTT gomb kezelése
  const handlePTTStart = () => {
    if (!isConnected || isMuted) return;
    
    setIsTransmitting(true);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
    }
    
    // Értesítés a többi peernek hogy adunk
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'start-transmission'
      }));
    }
  };
  
  const handlePTTEnd = () => {
    setIsTransmitting(false);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
    }
    
    // Értesítés hogy végeztünk az adással
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'stop-transmission'
      }));
    }
  };
  
  // Hangerő gomb kezelése mobilon (Volume Up gomb)
  useEffect(() => {
    let isVolumePressed = false;
    
    const handleKeyDown = (e) => {
      // Volume up gomb detektálása (androidon és iOS-en is)
      if (!isVolumePressed && (e.key === 'AudioVolumeUp' || e.keyCode === 175)) {
        e.preventDefault();
        isVolumePressed = true;
        handlePTTStart();
      }
    };
    
    const handleKeyUp = (e) => {
      if (isVolumePressed && (e.key === 'AudioVolumeUp' || e.keyCode === 175)) {
        e.preventDefault();
        isVolumePressed = false;
        handlePTTEnd();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isConnected, isMuted]);
  
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (isTransmitting) {
      handlePTTEnd();
    }
  };
  
  // Csatorna váltás kezelése
  const handleChannelChange = (newChannel) => {
    // Összes peer kapcsolat lezárása
    Object.keys(peerConnectionsRef.current).forEach(peerId => {
      closePeerConnection(peerId);
    });
    setPeers([]);
    setActivePeers(new Set());
    
    // Új csatornára csatlakozás
    setChannel(newChannel);
    joinChannel(newChannel);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* CB Rádió készülék */}
        <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-3xl shadow-2xl border-4 border-gray-700 overflow-hidden">
          {/* Fejléc */}
          <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-6 h-6 text-white" />
              <span className="text-white font-bold text-lg">CB RÁDIÓ</span>
            </div>
            <div className={`flex items-center gap-1 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              <Signal className="w-4 h-4" />
              <span className="text-xs font-semibold">
                {isConnected ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>
          
          {/* Kijelző */}
          <div className="bg-gradient-to-b from-green-900 to-green-950 p-6 border-y-4 border-gray-700">
            <div className="bg-black rounded-lg p-4 shadow-inner">
              <div className="text-center mb-4">
                <div className="text-green-400 font-mono text-sm mb-1">CSATORNA</div>
                <div className="text-green-400 font-mono text-6xl font-bold tracking-wider">
                  {channel.toString().padStart(2, '0')}
                </div>
                <div className="text-green-400 font-mono text-xs mt-2 flex items-center justify-center gap-2">
                  <Users className="w-3 h-3" />
                  {peers.length} FELHASZNÁLÓ
                </div>
              </div>
              
              {/* Hangerő mutató */}
              {isTransmitting && (
                <div className="mt-4">
                  <div className="text-green-400 font-mono text-xs mb-2 text-center">
                    ADÁS
                  </div>
                  <div className="h-3 bg-gray-900 rounded-full overflow-hidden border border-green-800">
                    <div 
                      className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-100"
                      style={{ width: `${volume}%` }}
                    />
                  </div>
                </div>
              )}
              
              {!isTransmitting && activePeers.size > 0 && (
                <div className="mt-4 text-center">
                  <div className="text-yellow-400 font-mono text-xs animate-pulse">
                    VÉTEL...
                  </div>
                </div>
              )}
              
              {!isTransmitting && activePeers.size === 0 && (
                <div className="mt-4 text-center">
                  <div className="text-green-400 font-mono text-xs animate-pulse">
                    KÉSZENLÉTI
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Csatorna választó */}
          <div className="p-6 bg-gray-800">
            <div className="mb-4">
              <label className="text-gray-300 text-sm font-semibold mb-2 block">
                Csatorna választás (1-40)
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleChannelChange(Math.max(1, channel - 1))}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-bold text-xl transition-colors"
                >
                  ◀
                </button>
                <input
                  type="range"
                  min="1"
                  max="40"
                  value={channel}
                  onChange={(e) => handleChannelChange(parseInt(e.target.value))}
                  className="flex-1"
                />
                <button
                  onClick={() => handleChannelChange(Math.min(40, channel + 1))}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-bold text-xl transition-colors"
                >
                  ▶
                </button>
              </div>
            </div>
            
            {/* Némító gomb */}
            <button
              onClick={toggleMute}
              className={`w-full mb-4 px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                isMuted 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              {isMuted ? 'NÉMÍTVA' : 'HANG BE'}
            </button>
            
            {/* PTT gomb */}
            <div className="text-center">
              <button
                onMouseDown={handlePTTStart}
                onMouseUp={handlePTTEnd}
                onTouchStart={handlePTTStart}
                onTouchEnd={handlePTTEnd}
                disabled={!isConnected || isMuted}
                className={`w-full py-8 rounded-2xl font-bold text-xl transition-all shadow-lg select-none ${
                  isTransmitting
                    ? 'bg-gradient-to-b from-red-500 to-red-700 text-white scale-95'
                    : isConnected && !isMuted
                    ? 'bg-gradient-to-b from-green-500 to-green-700 text-white hover:scale-105'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  {isTransmitting ? <Mic className="w-8 h-8 animate-pulse" /> : <MicOff className="w-8 h-8" />}
                  <span>{isTransmitting ? 'ADÁS...' : 'NYOMD ÉS BESZÉLJ'}</span>
                </div>
              </button>
              <p className="text-gray-400 text-xs mt-3">
                Mobilon használhatod a hangerő fel gombot is!
              </p>
            </div>
          </div>
          
          {/* Információ */}
          <div className="bg-gray-900 px-6 py-3 border-t-2 border-gray-700">
            <p className="text-gray-400 text-xs text-center">
              {isConnected 
                ? `Csatlakozva a ${channel}. csatornára` 
                : 'Mikrofon hozzáférés szükséges'}
            </p>
          </div>
        </div>
        
        {/* Használati útmutató */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
            <Radio className="w-4 h-4" />
            Használat
          </h3>
          <ul className="text-gray-300 text-sm space-y-1">
            <li>• Válassz csatornát (1-40)</li>
            <li>• Nyomd és tartsd a gombot adáshoz</li>
            <li>• Mobilon használd a hangerő fel gombot</li>
            <li>• Fülhallgatóval is működik</li>
            <li>• Azonos csatornán mások is hallani fognak</li>
          </ul>
        </div>
      </div>
    </div>
  );
}