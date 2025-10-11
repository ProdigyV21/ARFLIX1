import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Maximize, Settings, Loader2 } from 'lucide-react';
import { formatTime } from '../../lib/progress';
import { useRef, useState } from 'react';

type PlayerControlsProps = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  isBuffering: boolean;
  volume: number;
  isMuted: boolean;
  currentQualityLabel?: string;
  title: string;
  subtitle?: string;
  visible: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onFullscreen: () => void;
  onOpenSettings: () => void;
  onNextEpisode?: () => void;
};

export function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  buffered,
  isBuffering,
  volume,
  isMuted,
  currentQualityLabel,
  title,
  subtitle,
  visible,
  onPlayPause,
  onSeek,
  onSkipBack,
  onSkipForward,
  onVolumeChange,
  onMuteToggle,
  onFullscreen,
  onOpenSettings,
  onNextEpisode: _onNextEpisode,
}: PlayerControlsProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  // const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    onSeek(percent * duration);
  };

  const handleTimelineMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(percent * duration);
  };

  const handleTimelineLeave = () => {
    setHoverTime(null);
  };

  return (
    <div
      className={`absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="absolute top-0 left-0 right-0 p-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">{title}</h1>
          {subtitle && <p className="text-sm text-gray-300">{subtitle}</p>}
        </div>
        {currentQualityLabel && (
          <div className="bg-black/60 px-3 py-1 rounded text-sm font-medium">
            {currentQualityLabel}
          </div>
        )}
      </div>

      {/* Show buffering spinner in center when buffering */}
      {isBuffering && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Loader2 className="w-16 h-16 animate-spin text-white" />
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div
          ref={timelineRef}
          className="w-full h-2 bg-white/20 rounded-full cursor-pointer mb-4 relative group"
          onClick={handleTimelineClick}
          onMouseMove={handleTimelineMove}
          onMouseLeave={handleTimelineLeave}
        >
          <div
            className="absolute h-full bg-white/30 rounded-full"
            style={{ width: `${bufferedPercent}%` }}
          />
          <div
            className="absolute h-full bg-white rounded-full transition-all group-hover:h-3"
            style={{ width: `${progress}%` }}
          />
          {hoverTime !== null && (
            <div
              className="absolute -top-8 bg-black/90 px-2 py-1 rounded text-xs"
              style={{ left: `${(hoverTime / duration) * 100}%`, transform: 'translateX(-50%)' }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              data-focusable="true"
              onClick={onSkipBack}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              data-focusable="true"
              onClick={onPlayPause}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" fill="currentColor" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
              )}
            </button>

            <button
              data-focusable="true"
              onClick={onSkipForward}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            <span className="text-sm ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                data-focusable="true"
                onClick={onMuteToggle}
                className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume * 100}
                onChange={(e) => onVolumeChange(parseInt(e.target.value) / 100)}
                className="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />
            </div>

            <button
              data-focusable="true"
              onClick={onOpenSettings}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <Settings className="w-5 h-5" />
            </button>

            <button
              data-focusable="true"
              onClick={onFullscreen}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
