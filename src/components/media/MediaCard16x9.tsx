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

export default function MediaCard16x9({ item, onClick, showTitle = false }: MediaCard16x9Props) {
  const [imageError, setImageError] = useState(false);
  const hasValidImage = item.image16x9 && (
    item.image16x9.includes('/t/p/') ||
    item.image16x9.startsWith('http')
  );

  return (
    <div className="group relative">
      <div
        className="aspect-16x9 rounded-xl overflow-hidden bg-neutral-900/40 border-2 border-white/10 hover:border-white/30 transition-all cursor-pointer"
        tabIndex={0}
        role="button"
        aria-label={item.title}
        onClick={onClick}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      >
        {!hasValidImage && !imageError && (
          <div className="fit-abs bg-gradient-to-br from-neutral-800 to-neutral-900" />
        )}

        <img
          src={item.image16x9}
          alt={item.title}
          loading="lazy"
          decoding="async"
          className="fit-abs"
          onError={() => setImageError(true)}
        />

        <div className="fit-abs bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />

        <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
          <h3 className="text-white font-bold text-base line-clamp-2 drop-shadow-lg">
            {item.title}
          </h3>
        </div>
      </div>
    </div>
  );
}
