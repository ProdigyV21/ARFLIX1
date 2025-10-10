import { AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { StreamWithClassification, getCodecBadge } from '../../lib/streamClassifier';

interface IncompatibleSourceSheetProps {
  streams: StreamWithClassification[];
  onClose: () => void;
}

export default function IncompatibleSourceSheet({ streams, onClose }: IncompatibleSourceSheetProps) {
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
      <div className="bg-neutral-900 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-neutral-700">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-600/20 rounded-full">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">No Compatible Sources Found</h2>
              <p className="text-gray-400">
                This content uses audio formats (E-AC3, DTS, TrueHD, Atmos) that web browsers cannot decode.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <h3 className="font-semibold text-lg mb-3">Available Sources (Incompatible)</h3>
          <p className="text-sm text-gray-400 mb-4">
            These sources require a native app or external player to play with audio.
          </p>

          <div className="space-y-3">
            {streams.slice(0, 5).map((stream, index) => {
              const badge = getCodecBadge(stream.classification);

              return (
                <div
                  key={index}
                  className="bg-neutral-800 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{stream.title}</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400">
                          {badge.text}
                        </span>

                        {stream.classification.resolution && (
                          <span className="text-xs px-2 py-1 rounded bg-neutral-700 text-gray-300">
                            {stream.classification.resolution}
                          </span>
                        )}

                        {stream.classification.audioCodec && (
                          <span className="text-xs px-2 py-1 rounded bg-neutral-700 text-gray-300">
                            {stream.classification.audioCodec.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {stream.classification.incompatibilityReasons.length > 0 && (
                    <div className="text-xs text-red-400 mb-3">
                      {stream.classification.incompatibilityReasons.join(', ')}
                    </div>
                  )}

                  <button
                    onClick={() => handleCopyUrl(stream.url)}
                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Direct URL
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-blue-600/10 border border-blue-600/30 rounded-lg">
            <h4 className="font-semibold mb-2">Solutions:</h4>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">1.</span>
                <span>Look for MP4 or HLS sources with AAC audio in other add-ons</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">2.</span>
                <span>Use a native app (Android TV, Desktop) that supports all codecs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">3.</span>
                <span>Open the copied URL in VLC or another external player</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="p-6 border-t border-neutral-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-neutral-700 hover:bg-neutral-600 rounded-lg font-medium transition-colors"
          >
            Go Back
          </button>
          <a
            href="https://www.videolan.org/vlc/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Download VLC
          </a>
        </div>
      </div>
    </div>
  );
}
