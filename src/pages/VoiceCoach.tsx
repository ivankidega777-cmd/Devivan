import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Loader2, Sparkles, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const STARTER_PROMPTS = [
  "How do I start a conversation on a dating app?",
  "What are some good questions for a first date?",
  "Can we practice a mock first date scenario?",
  "How do I keep a conversation going?",
];

export default function VoiceCoach() {
  const { userProfile } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sessionRef = useRef<any>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);

  const initAudioContexts = () => {
    if (!playbackAudioContextRef.current) {
      playbackAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
    }
    if (playbackAudioContextRef.current.state === 'suspended') {
      playbackAudioContextRef.current.resume();
    }

    if (!recordingAudioContextRef.current) {
      recordingAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
    }
    if (recordingAudioContextRef.current.state === 'suspended') {
      recordingAudioContextRef.current.resume();
    }
  };

  const playNextAudio = () => {
    if (!playbackAudioContextRef.current || playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const buffer = playbackQueueRef.current.shift()!;
    const source = playbackAudioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(playbackAudioContextRef.current.destination);

    const currentTime = playbackAudioContextRef.current.currentTime;
    const startTime = Math.max(currentTime, nextPlayTimeRef.current);
    
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;

    source.onended = () => {
      playNextAudio();
    };
  };

  const decodeAndPlayAudio = async (base64Data: string) => {
    try {
      initAudioContexts();
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const audioBuffer = playbackAudioContextRef.current!.createBuffer(1, pcm16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
      }

      playbackQueueRef.current.push(audioBuffer);
      if (!isPlayingRef.current) {
        nextPlayTimeRef.current = playbackAudioContextRef.current!.currentTime;
        playNextAudio();
      }
    } catch (err) {
      console.error("Error decoding audio:", err);
    }
  };

  const startRecording = async (sessionPromise: Promise<any>) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      initAudioContexts();
      
      const source = recordingAudioContextRef.current!.createMediaStreamSource(stream);
      const processor = recordingAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(recordingAudioContextRef.current!.destination);

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        sessionPromise.then((session) => {
          if (session) {
            session.sendRealtimeInput({
              media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
            });
          }
        }).catch(console.error);
      };
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Microphone access denied or unavailable.");
      disconnect();
    }
  };

  const connect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const systemInstruction = `You are a helpful, encouraging, and charismatic dating coach named Sparky. 
      You help users practice conversations, give advice on their dating profiles, and provide tips for dates.
      The user's name is ${userProfile?.displayName || 'there'}. 
      They are ${userProfile?.age || 'unknown'} years old, identify as ${userProfile?.gender || 'unknown'}, 
      and are interested in ${userProfile?.interestedIn || 'everyone'}.
      Keep your responses concise, conversational, and natural.`;

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            startRecording(sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              decodeAndPlayAudio(base64Audio);
            }
            if (message.serverContent?.interrupted) {
              playbackQueueRef.current = [];
              isPlayingRef.current = false;
            }
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection error occurred.");
            disconnect();
          },
          onclose: () => {
            disconnect();
          }
        }
      });
      
      sessionRef.current = sessionPromise;
    } catch (err) {
      console.error("Failed to connect:", err);
      setError("Failed to connect to the dating coach.");
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => session?.close()).catch(console.error);
      sessionRef.current = null;
    }
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    setIsConnected(false);
    setIsConnecting(false);
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-50 p-6 items-center justify-center relative overflow-hidden overflow-y-auto">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-lime-500/20 rounded-full blur-3xl transition-opacity duration-1000 ${isConnected ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl transition-opacity duration-1000 delay-150 ${isConnected ? 'opacity-100' : 'opacity-0'}`} />
      </div>

      <div className="z-10 flex flex-col items-center max-w-md w-full text-center space-y-8 py-8">
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl mb-4">
            <Sparkles className="w-8 h-8 text-lime-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">AI Dating Coach</h1>
          <p className="text-zinc-400">
            Practice your pickup lines, get profile advice, or just chat about dating.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm w-full">
            {error}
          </div>
        )}

        <div className="relative">
          {/* Pulsing rings when connected */}
          {isConnected && (
            <>
              <div className="absolute inset-0 bg-lime-500 rounded-full animate-ping opacity-20" />
              <div className="absolute inset-[-16px] border border-lime-500/30 rounded-full animate-pulse" />
            </>
          )}
          
          <button
            onClick={isConnected ? disconnect : connect}
            disabled={isConnecting}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
              isConnected 
                ? 'bg-lime-500 text-white shadow-lime-500/50 hover:bg-lime-600' 
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700'
            }`}
          >
            {isConnecting ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isConnected ? (
              <Mic className="w-8 h-8" />
            ) : (
              <MicOff className="w-8 h-8" />
            )}
          </button>
        </div>

        <div className="h-8">
          <p className={`text-sm font-medium transition-opacity duration-300 ${isConnecting || isConnected ? 'opacity-100' : 'opacity-0'}`}>
            {isConnecting ? 'Connecting to Coach...' : isConnected ? 'Listening... Speak now' : ''}
          </p>
        </div>

        {!isConnected && !isConnecting && (
          <div className="w-full mt-8 text-left space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Try asking:
            </h3>
            <div className="grid gap-3">
              {STARTER_PROMPTS.map((prompt, index) => (
                <div 
                  key={index} 
                  className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors cursor-default flex items-start gap-3"
                >
                  <span className="text-lime-500 font-bold mt-0.5">"</span>
                  <span className="flex-1">{prompt}</span>
                  <span className="text-lime-500 font-bold mt-0.5">"</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
