import { useState } from 'react';

interface MediaCard16x9Props {
  item: {
    id: number | string;
    title: string;
    image16x9: string;
    year?: string;
  };
  onClick?: () => void;
  showTitle?: boolean;
}

export default function MediaCard16x9({ item, onClick, showTitle: _showTitle = false }: MediaCard16x9Props) {
  const [imageError, setImageError] = useState(false);
  const hasValidImage = item.image16x9 && (
    item.image16x9.includes('/t/p/') ||
    item.image16x9.startsWith('http')
  );

  return (
    <div className="group relative">
      <div
        className="relative aspect-16x9 rounded-xl overflow-hidden bg-neutral-900/40 transition-colors duration-300 cursor-pointer"
        tabIndex={0}
        role="button"
        aria-label={item.title}
        onClick={onClick}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      >
        {!hasValidImage || imageError ? (
          <div className="fit-abs bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center">
            <div className="text-white text-center px-6">
              <div className="text-base font-bold">{item.title}</div>
              {item.year && <div className="text-sm text-white/60 mt-1">{item.year}</div>}
            </div>
          </div>
        ) : (
          <>
            <img
              src={item.image16x9}
              alt={item.title}
              loading="lazy"
              decoding="async"
              className="fit-abs transition-transform duration-300 ease-out group-hover:scale-[1.05]"
              onError={() => setImageError(true)}
            />
            <div className="fit-abs bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />
            {/* Hover glow outline */}
            <div className="pointer-events-none absolute inset-0 rounded-xl z-20 ring-2 ring-white/90 shadow-[0_0_30px_rgba(255,255,255,0.45)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
              <h3 className="text-white font-bold text-base line-clamp-2 drop-shadow-lg">
                {item.title}
                {item.year && <span className="text-white/70 font-normal"> ({item.year})</span>}
              </h3>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
