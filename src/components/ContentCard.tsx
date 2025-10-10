import { forwardRef, useState } from 'react';

interface ContentCardProps {
  title: string;
  poster?: string;
  type: string;
  year?: string;
  progress?: number;
  onClick: () => void;
}

export const ContentCard = forwardRef<HTMLButtonElement, ContentCardProps>(
  ({ title, poster, type, year, progress, onClick }, ref) => {
    const [imageError, setImageError] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    return (
      <button
        ref={ref}
        data-focusable="true"
        onClick={onClick}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onMouseEnter={() => setIsFocused(true)}
        onMouseLeave={() => setIsFocused(false)}
        className="group flex-shrink-0 w-[180px] lg:w-[200px] focus-glow transition-all duration-200"
        style={{ borderRadius: 'var(--radius-xl)' }}
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-white/5" style={{ borderRadius: 'var(--radius-xl)' }}>
          {poster && !imageError ? (
            <img
              src={poster}
              alt={title}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[color:var(--muted)]">
              No Image
            </div>
          )}

          {progress !== undefined && progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div
                className="h-full bg-[color:var(--accent)]"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200" />
        </div>

        {isFocused && (
          <div className="mt-2 px-1">
            <h3 className="text-sm font-semibold line-clamp-2 text-left mb-0.5">
              {title}
            </h3>

            <div className="flex items-center gap-1.5 text-xs text-[color:var(--muted)]">
              {year && <span>{year}</span>}
              {year && type && <span>•</span>}
              {type && <span className="capitalize">{type}</span>}
            </div>
          </div>
        )}
      </button>
    );
  }
);

ContentCard.displayName = 'ContentCard';
