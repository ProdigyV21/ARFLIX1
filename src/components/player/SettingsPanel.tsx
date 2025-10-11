import { Check, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import { NormalizedStream } from '../../lib/player';
import { Subtitle } from '../../lib/subtitles';

type Tab = 'quality' | 'source' | 'subtitles' | 'speed';

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
  onClose: () => void;
  onQualityChange: (quality: number | 'auto') => void;
  onStreamChange: (stream: NormalizedStream) => void;
  onSpeedChange: (speed: number) => void;
  onSubtitleChange: (lang?: string) => void;
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
  onClose,
  onQualityChange,
  onStreamChange,
  onSpeedChange,
  onSubtitleChange,
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

        <div className="flex border-b border-neutral-800">
          {(['quality', 'source', 'subtitles', 'speed'] as Tab[]).map((tab) => (
            <button
              key={tab}
              data-focusable="true"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 text-sm font-medium capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/50 ${
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
                        className={`w-full p-4 rounded-lg flex items-center justify-between transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 text-left ${
                          stream.url === currentStream.url ? 'bg-white/10' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{stream.label}</div>

                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {stream.quality && (
                              <span className="text-xs px-2 py-0.5 rounded bg-neutral-700 text-gray-300">
                                {stream.quality}p
                              </span>
                            )}
                            {stream.codec && (
                              <span className="text-xs px-2 py-0.5 rounded bg-neutral-700 text-gray-300">
                                {stream.codec.toUpperCase()}
                              </span>
                            )}
                            {(stream as any).audioCodec && (
                              <span className="text-xs px-2 py-0.5 rounded bg-neutral-700 text-gray-300">
                                {(stream as any).audioCodec}
                              </span>
                            )}
                            {stream.hdr && stream.hdr !== 'none' && (
                              <span className="text-xs px-2 py-0.5 rounded bg-purple-600/20 text-purple-400">
                                {stream.hdr === 'dolby_vision' ? 'Dolby Vision' : 'HDR10'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                            {stream.sourceName && <span>{stream.sourceName}</span>}
                            {(stream as any).fileSize && <span>{(stream as any).fileSize}</span>}
                            {(stream as any).seeds !== undefined && <span>👤 {(stream as any).seeds}</span>}
                          </div>
                        </div>
                        {stream.url === currentStream.url && <Check className="w-5 h-5 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
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
