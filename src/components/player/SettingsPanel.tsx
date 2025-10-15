import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { NormalizedStream } from '../../lib/player';
import { Subtitle } from '../../lib/subtitles';

type Tab = 'quality' | 'source' | 'audio' | 'subtitles' | 'speed';

export interface AudioTrack {
  id: string;
  language: string;
  label: string;
  channels?: string; // e.g., "2.0", "5.1", "Atmos"
}

type SettingsPanelProps = {
  visible: boolean;
  currentStream: NormalizedStream;
  allStreams: NormalizedStream[];
  availableQualities: (number | 'auto')[];
  currentQuality: number | 'auto' | null;
  playbackSpeed: number;
  subtitlesEnabled: boolean;
  currentSubtitle?: string;
  availableSubtitles?: Subtitle[];
  availableAudioTracks?: AudioTrack[];
  currentAudioTrack?: string;
  onClose: () => void;
  onQualityChange: (quality: number | 'auto') => void;
  onStreamChange: (stream: NormalizedStream) => void;
  onSpeedChange: (speed: number) => void;
  onSubtitleChange: (lang?: string) => void;
  onAudioTrackChange?: (trackId: string) => void;
};

export function SettingsPanel({
  visible,
  currentStream,
  allStreams,
  availableQualities,
  currentQuality,
  playbackSpeed,
  subtitlesEnabled,
  currentSubtitle,
  availableSubtitles = [],
  availableAudioTracks = [],
  currentAudioTrack,
  onClose,
  onQualityChange,
  onStreamChange,
  onSpeedChange,
  onSubtitleChange,
  onAudioTrackChange,
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('quality');

  if (!visible) return null;

  const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  const groupedStreams = allStreams.reduce((acc, stream) => {
    const key = stream.host || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(stream);
    return acc;
  }, {} as Record<string, NormalizedStream[]>);

  const subtitleOptions = availableSubtitles.length > 0 ? availableSubtitles : (currentStream.captions || []);

  function formatSize(bytes?: number) {
    if (!bytes || bytes <= 0) return null;
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) {
      return `${mb.toFixed(0)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-end">
      <div className="w-full max-w-md h-full bg-neutral-900 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-800">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            data-focusable="true"
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex border-b border-neutral-800 overflow-x-auto">
          {(['quality', 'source', 'audio', 'subtitles', 'speed'] as Tab[]).map((tab) => (
            <button
              key={tab}
              data-focusable="true"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 px-2 text-sm font-medium capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/50 whitespace-nowrap ${
                activeTab === tab
                  ? 'text-white border-b-2 border-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'quality' && (
            <div className="space-y-2">
              {currentStream.kind === 'mp4' ? (
                <div className="text-sm text-gray-400 text-center py-8">
                  Quality switching is only available for HLS and DASH streams.
                  <div className="mt-2 text-white">Current: {currentStream.quality}p (MP4)</div>
                </div>
              ) : availableQualities.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-8">
                  No quality options available for this stream.
                </div>
              ) : (
                <>
                  <button
                    data-focusable="true"
                    onClick={() => onQualityChange('auto')}
                    className={`w-full p-4 rounded-lg flex items-center justify-between transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 ${
                      currentQuality === 'auto' ? 'bg-white/10' : ''
                    }`}
                  >
                    <span className="font-medium">Auto</span>
                    {currentQuality === 'auto' && <Check className="w-5 h-5" />}
                  </button>
                  {availableQualities
                    .filter((q): q is number => typeof q === 'number')
                    .sort((a, b) => b - a)
                    .map((quality) => (
                      <button
                        key={quality}
                        data-focusable="true"
                        onClick={() => onQualityChange(quality)}
                        className={`w-full p-4 rounded-lg flex items-center justify-between transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 ${
                          currentQuality === quality ? 'bg-white/10' : ''
                        }`}
                      >
                        <span className="font-medium">{quality}p</span>
                        {currentQuality === quality && <Check className="w-5 h-5" />}
                      </button>
                    ))}
                </>
              )}
            </div>
          )}

          {activeTab === 'source' && (
            <div className="space-y-4">
              {Object.entries(groupedStreams).map(([host, streams]) => (
                <div key={host}>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">{host}</h3>
                  <div className="space-y-2">
                    {streams.map((stream, idx) => (
                      <button
                        key={`${host}-${idx}`}
                        data-focusable="true"
                        onClick={() => onStreamChange(stream)}
                        className={`w-full p-4 rounded-lg transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 text-left ${
                          stream.url === currentStream.url ? 'bg-white/10 ring-2 ring-blue-500/50' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Title */}
                            <div className="font-semibold text-base mb-2 truncate">
                              {stream.label || `${stream.quality || 'Unknown'} ${stream.codec || ''}`.trim()}
                            </div>

                            {/* Badges Row 1: Quality, Codec, File Size */}
                            <div className="flex flex-wrap gap-1.5 mb-1.5">
                              {(stream.qualityLabel || stream.quality) && (
                                <span className="text-xs px-2 py-1 rounded bg-blue-600/30 text-blue-200 font-semibold">
                                  {stream.qualityLabel || `${stream.quality}p`}
                                </span>
                              )}
                              {stream.codec && (
                                <span className="text-xs px-2 py-1 rounded bg-neutral-700 text-gray-300 font-medium">
                                  {String(stream.codec).toUpperCase()}
                                </span>
                              )}
                              {stream.kind && (
                                <span className="text-xs px-2 py-1 rounded bg-neutral-700 text-gray-300">
                                  {String(stream.kind).toUpperCase()}
                                </span>
                              )}
                              {formatSize((stream as any).filesizeBytes || (stream as any).fileSizeBytes || (stream as any).sizeBytes || (stream as any).bytes || (stream as any).size) && (
                                <span className="text-xs px-2 py-1 rounded bg-green-600/30 text-green-200 font-semibold">
                                  📦 {formatSize((stream as any).filesizeBytes || (stream as any).fileSizeBytes || (stream as any).sizeBytes || (stream as any).bytes || (stream as any).size)}
                                </span>
                              )}
                            </div>

                            {/* Badges Row 2: HDR, Seeds/Peers, Provider */}
                            <div className="flex flex-wrap gap-1.5">
                              {stream.hdr && stream.hdr !== 'none' && (
                                <span className="text-xs px-2 py-1 rounded bg-purple-600/30 text-purple-300 font-semibold">
                                  ✨ {stream.hdr === 'dolby_vision' ? 'Dolby Vision' : 'HDR10'}
                                </span>
                              )}
                              {((stream as any).seeds !== undefined) && (
                                <span className="text-xs px-2 py-1 rounded bg-emerald-600/20 text-emerald-300">
                                  🌱 {(stream as any).seeds} seeds
                                </span>
                              )}
                              {((stream as any).peers !== undefined) && (
                                <span className="text-xs px-2 py-1 rounded bg-orange-600/20 text-orange-300">
                                  👥 {(stream as any).peers} peers
                                </span>
                              )}
                              {stream.provider && (
                                <span className="text-xs px-2 py-1 rounded bg-neutral-700 text-gray-400">
                                  {stream.provider}
                                </span>
                              )}
                              {stream.sourceType && (
                                <span className="text-xs px-2 py-1 rounded bg-neutral-700 text-gray-400">
                                  {stream.sourceType}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Check mark for selected */}
                          {stream.url === currentStream.url && (
                            <div className="flex-shrink-0">
                              <Check className="w-6 h-6 text-blue-400" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-2">
              {availableAudioTracks.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-8">
                  No audio track options available.
                  <div className="mt-2 text-white">Using default audio track</div>
                </div>
              ) : (
                availableAudioTracks.map((track) => (
                  <button
                    key={track.id}
                    data-focusable="true"
                    onClick={() => onAudioTrackChange?.(track.id)}
                    className={`w-full p-4 rounded-lg flex items-center justify-between transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 ${
                      currentAudioTrack === track.id ? 'bg-white/10' : ''
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-medium">{track.label}</div>
                      {track.channels && (
                        <div className="text-xs text-gray-400 mt-1">{track.channels}</div>
                      )}
                    </div>
                    {currentAudioTrack === track.id && <Check className="w-5 h-5 flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
          )}

          {activeTab === 'subtitles' && (
            <div className="space-y-2">
              <button
                data-focusable="true"
                onClick={() => onSubtitleChange(undefined)}
                className={`w-full p-4 rounded-lg flex items-center justify-between transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 ${
                  !subtitlesEnabled ? 'bg-white/10' : ''
                }`}
              >
                <span className="font-medium">Off</span>
                {!subtitlesEnabled && <Check className="w-5 h-5" />}
              </button>
              {subtitleOptions.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-8">
                  No subtitles available for this stream.
                </div>
              ) : (
                subtitleOptions.map((sub, index) => {
                  const isSubtitle = 'languageCode' in sub;
                  const subId = isSubtitle ? (sub.id || `sub-${index}`) : sub.lang;
                  const subLabel = isSubtitle ? sub.label : sub.lang;

                  return (
                    <button
                      key={subId}
                      data-focusable="true"
                      onClick={() => onSubtitleChange(subId)}
                      className={`w-full p-4 rounded-lg flex items-center justify-between transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 ${
                        currentSubtitle === subId ? 'bg-white/10' : ''
                      }`}
                    >
                      <span className="font-medium">{subLabel}</span>
                      {currentSubtitle === subId && <Check className="w-5 h-5" />}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'speed' && (
            <div className="space-y-2">
              {speeds.map((speed) => (
                <button
                  key={speed}
                  data-focusable="true"
                  onClick={() => onSpeedChange(speed)}
                  className={`w-full p-4 rounded-lg flex items-center justify-between transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 ${
                    playbackSpeed === speed ? 'bg-white/10' : ''
                  }`}
                >
                  <span className="font-medium">{speed === 1.0 ? 'Normal' : `${speed}x`}</span>
                  {playbackSpeed === speed && <Check className="w-5 h-5" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
