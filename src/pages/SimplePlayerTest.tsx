/**
 * SimplePlayerTest - Direct test of PlayerPageNew with public domain content
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

export function SimplePlayerTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const handleBack = () => {
    window.location.href = '/';
  };

  const handlePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleSeek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
    }
  };

  const handleVolumeChange = (vol: number) => {
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
  };

  const handleMuteToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="text-white">
            <h1 className="text-lg font-semibold">PlayerPageNew Test</h1>
            <p className="text-xs text-gray-400 mt-1">Big Buck Bunny (Public Domain)</p>
          </div>
          
          <div className="w-10" /> {/* Spacer */}
        </div>
      </div>

      {/* Video Player */}
      <div className="relative w-full h-screen">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          onMouseMove={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
          onClick={handlePlay}
          crossOrigin="anonymous"
        >
          <source src="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" type="application/x-mpegURL" />
          <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Center Play Button */}
        {showControls && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              onClick={handlePlay}
              className="p-4 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-all pointer-events-auto"
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>
          </div>
        )}

        {/* Bottom Controls */}
        {showControls && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
            <div className="flex items-center gap-4">
              <button
                onClick={handlePlay}
                className="p-2 bg-white bg-opacity-20 text-white rounded-full hover:bg-opacity-30"
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{formatTime(currentTime)}</span>
                  <div className="flex-1 bg-gray-600 rounded-full h-1">
                    <div 
                      className="bg-white h-1 rounded-full transition-all"
                      style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm">{formatTime(duration)}</span>
                </div>
              </div>
              
              <button
                onClick={handleMuteToggle}
                className="p-2 bg-white bg-opacity-20 text-white rounded-full hover:bg-opacity-30"
              >
                {muted ? '🔇' : '🔊'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="absolute top-20 left-4 bg-black bg-opacity-75 p-4 rounded-lg max-w-md">
        <h2 className="text-xl font-bold mb-2">✅ PlayerPageNew Test</h2>
        <p className="text-sm text-gray-300 mb-2">
          This test uses a public domain video (Big Buck Bunny) that doesn't require addons or authentication.
        </p>
        <div className="text-xs text-gray-400 space-y-1">
          <p>• Video: Big Buck Bunny (Public Domain)</p>
          <p>• Format: HLS + MP4 fallback</p>
          <p>• Status: {isPlaying ? 'Playing' : 'Paused'}</p>
          <p>• Time: {formatTime(currentTime)} / {formatTime(duration)}</p>
          <p>• Volume: {Math.round(volume * 100)}% {muted ? '(Muted)' : ''}</p>
        </div>
      </div>
    </div>
  );
}
