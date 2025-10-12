import { useEffect, useState } from 'react';

interface PlayerLoadingScreenProps {
  poster?: string;
  title: string;
  isBuffering?: boolean;
  show: boolean;
}

export default function PlayerLoadingScreen({ 
  poster, 
  title, 
  isBuffering = false,
  show 
}: PlayerLoadingScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!show && !fadeOut) {
      // Start fade out animation
      setFadeOut(true);
    }
  }, [show, fadeOut]);

  // Don't render if not showing and fade out completed
  if (!show && fadeOut) {
    return null;
  }

  return (
    <div 
      className={`absolute inset-0 z-40 flex items-center justify-center bg-black transition-opacity duration-500 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Poster Background */}
      {poster && (
        <div className="absolute inset-0">
          <img
            src={poster}
            alt={title}
            className="w-full h-full object-cover opacity-40 blur-sm"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/40" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 text-center px-8 max-w-2xl">
        {/* Poster Image */}
        {poster && (
          <div className="mb-6 flex justify-center">
            <img
              src={poster}
              alt={title}
              className="w-48 h-auto rounded-lg shadow-2xl"
            />
          </div>
        )}

        {/* Title */}
        <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-white">
          {title}
        </h2>

        {/* Loading Spinner */}
        <div className="flex items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-lg text-white/80">
            {isBuffering ? 'Buffering...' : 'Loading...'}
          </p>
        </div>
      </div>
    </div>
  );
}

