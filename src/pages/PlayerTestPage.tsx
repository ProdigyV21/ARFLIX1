/**
 * PlayerTestPage - Simple test page to demonstrate PlayerCore
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { PlayerCore, createPlayer, detectPlatform } from '../player/core/PlayerCore';
import { PlayerEvents } from '../player/core/types';

export function PlayerTestPage({ onBack }: { onBack: () => void }) {
  const playerRef = useRef<PlayerCore | null>(null);
  const [platform, setPlatform] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [qualities, setQualities] = useState<any[]>([]);
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [textTracks, setTextTracks] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    const initPlayer = async () => {
      try {
        const detectedPlatform = detectPlatform();
        setPlatform(detectedPlatform);
        addLog(`Platform detected: ${detectedPlatform}`);

        const player = createPlayer(detectedPlatform, {
          preferHighestOnStart: true,
          autoPlay: false,
          volume: 1.0,
          muted: false
        });

        playerRef.current = player;
        addLog('Player created successfully');

        // Set up event listeners
        player.on((event: PlayerEvents) => {
          switch (event.type) {
            case 'ready':
              setIsReady(true);
              addLog('Player ready');
              break;
            case 'time':
              setCurrentTime(event.current);
              setDuration(event.duration);
              break;
            case 'stateChanged':
              setIsPlaying(event.state.playing);
              break;
            case 'tracks':
              setAudioTracks(event.audio);
              setTextTracks(event.text);
              setQualities(event.qualities);
              addLog(`Tracks loaded: ${event.audio.length} audio, ${event.text.length} text, ${event.qualities.length} qualities`);
              break;
            case 'error':
              addLog(`Error: ${event.error?.message || 'Unknown error'}`);
              break;
          }
        });

        // Load a test source (Big Buck Bunny - public domain)
        await player.load({
          url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          type: 'hls',
          provider: 'Test Stream',
          resolution: '1080p'
        });

        addLog('Test stream loaded');
      } catch (error) {
        addLog(`Failed to initialize: ${error}`);
      }
    };

    initPlayer();

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);

  const handlePlay = async () => {
    try {
      await playerRef.current?.play();
      addLog('Play requested');
    } catch (error) {
      addLog(`Play failed: ${error}`);
    }
  };

  const handlePause = async () => {
    try {
      await playerRef.current?.pause();
      addLog('Pause requested');
    } catch (error) {
      addLog(`Pause failed: ${error}`);
    }
  };

  const handleSetMaxQuality = async () => {
    try {
      await playerRef.current?.setQualityMax();
      addLog('Set quality to maximum');
    } catch (error) {
      addLog(`Set quality failed: ${error}`);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-2 bg-gray-800 rounded-full hover:bg-gray-700"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold">PlayerCore Test Page</h1>
        </div>

        {/* Platform Info */}
        <div className="bg-gray-900 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Platform Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-400">Detected Platform:</span>
              <span className="ml-2 font-mono text-green-400">{platform}</span>
            </div>
            <div>
              <span className="text-gray-400">Player Status:</span>
              <span className="ml-2 font-mono text-green-400">
                {isReady ? 'Ready' : 'Initializing...'}
              </span>
            </div>
          </div>
        </div>

        {/* Player Controls */}
        <div className="bg-gray-900 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Player Controls</h2>
          <div className="flex gap-4 mb-4">
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              disabled={!isReady}
              className="px-6 py-3 bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={handleSetMaxQuality}
              disabled={!isReady}
              className="px-6 py-3 bg-green-600 rounded hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              Set Max Quality
            </button>
          </div>
          <div className="text-sm text-gray-400">
            Time: {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Track Information */}
        <div className="bg-gray-900 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Available Tracks</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h3 className="font-semibold text-green-400 mb-2">Qualities ({qualities.length})</h3>
              <ul className="text-sm space-y-1">
                {qualities.map((q, i) => (
                  <li key={i} className="text-gray-300">
                    {q.label || `${q.height}p`}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-blue-400 mb-2">Audio ({audioTracks.length})</h3>
              <ul className="text-sm space-y-1">
                {audioTracks.map((a, i) => (
                  <li key={i} className="text-gray-300">
                    {a.label || a.lang}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-purple-400 mb-2">Subtitles ({textTracks.length})</h3>
              <ul className="text-sm space-y-1">
                {textTracks.map((t, i) => (
                  <li key={i} className="text-gray-300">
                    {t.label || t.lang}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Event Log */}
        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Event Log</h2>
          <div className="bg-black p-4 rounded font-mono text-sm h-64 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="text-green-400 mb-1">
                {log}
              </div>
            ))}
          </div>
        </div>

        {/* Documentation */}
        <div className="mt-8 bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">About This Test</h2>
          <p className="text-gray-300 mb-4">
            This page demonstrates the new multi-platform PlayerCore architecture. It uses:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-2">
            <li><strong>Platform Detection:</strong> Automatically detects Web/Android/iOS/Electron</li>
            <li><strong>Unified API:</strong> Same interface across all platforms</li>
            <li><strong>Shaka Player:</strong> Primary engine for Web (DASH/HLS)</li>
            <li><strong>Quality Management:</strong> Auto-highest quality on start</li>
            <li><strong>Track Enumeration:</strong> Lists all audio/subtitle/quality options</li>
            <li><strong>Event System:</strong> Real-time player state updates</li>
          </ul>
          <p className="text-gray-400 mt-4 text-sm">
            Test stream: Big Buck Bunny (public domain HLS stream)
          </p>
        </div>
      </div>
    </div>
  );
}
