import { StreamWithClassification, getCodecBadge } from '../../lib/streamClassifier';

interface SourceSelectorProps {
  streams: StreamWithClassification[];
  currentStream: StreamWithClassification;
  onSelect: (stream: StreamWithClassification) => void;
  onClose: () => void;
}

export default function SourceSelector({ streams, currentStream, onSelect, onClose }: SourceSelectorProps) {
  return (
    <div className="absolute bottom-20 right-6 bg-neutral-900/95 backdrop-blur-sm rounded-lg shadow-xl z-50 min-w-[320px] max-w-md max-h-[60vh] overflow-y-auto">
      <div className="p-4 border-b border-neutral-700">
        <h3 className="font-semibold text-lg">Select Source</h3>
        <p className="text-sm text-gray-400 mt-1">
          Choose a compatible stream source
        </p>
      </div>

      <div className="p-2">
        {streams.map((stream, index) => {
          const badge = getCodecBadge(stream.classification);
          const isCurrent = stream.url === currentStream.url;
          const isPlayable = stream.classification.isPlayable;

          return (
            <button
              key={index}
              onClick={() => {
                if (isPlayable) {
                  onSelect(stream);
                  onClose();
                }
              }}
              disabled={!isPlayable}
              className={`w-full p-3 rounded-lg text-left transition-colors mb-2 ${
                isCurrent
                  ? 'bg-blue-600 text-white'
                  : isPlayable
                  ? 'bg-neutral-800 hover:bg-neutral-700'
                  : 'bg-neutral-800/50 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{stream.title}</div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      badge.compatible
                        ? 'bg-green-600/20 text-green-400'
                        : 'bg-red-600/20 text-red-400'
                    }`}>
                      {badge.text}
                    </span>

                    {stream.classification.resolution && (
                      <span className="text-xs px-2 py-1 rounded bg-neutral-700 text-gray-300">
                        {stream.classification.resolution}
                      </span>
                    )}

                    {stream.classification.isHDR && (
                      <span className="text-xs px-2 py-1 rounded bg-purple-600/20 text-purple-400">
                        HDR
                      </span>
                    )}
                  </div>

                  {!isPlayable && stream.classification.incompatibilityReasons.length > 0 && (
                    <div className="mt-2 text-xs text-red-400">
                      {stream.classification.incompatibilityReasons[0]}
                    </div>
                  )}
                </div>

                {isCurrent && (
                  <div className="text-blue-400 text-sm font-medium">
                    Playing
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-neutral-700 bg-neutral-800/50">
        <div className="text-xs text-gray-400">
          <div className="font-medium mb-1">Compatibility Key:</div>
          <div>✅ = Browser compatible</div>
          <div>🚫 Web = Requires native app</div>
        </div>
      </div>
    </div>
  );
}
