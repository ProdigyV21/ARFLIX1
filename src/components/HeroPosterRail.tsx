import { useState, useEffect } from 'react';
import { Play, Info } from 'lucide-react';

interface PosterItem {
  id: string;
  title: string;
  year?: string;
  type: string;
  overview?: string;
  posterUrl: string;
  backdropUrl?: string;
}

interface HeroPosterRailProps {
  items: PosterItem[];
  onPlay: (item: PosterItem) => void;
  onInfo: (item: PosterItem) => void;
}

export default function HeroPosterRail({ items, onPlay, onInfo }: HeroPosterRailProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [currentItem, setCurrentItem] = useState(items[0]);

  useEffect(() => {
    if (items[focusedIndex]) {
      setCurrentItem(items[focusedIndex]);
    }
  }, [focusedIndex, items]);

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 transition-[background-image] duration-700 opacity-50 bg-cover bg-center"
        style={{
          backgroundImage: `url(${currentItem?.backdropUrl || currentItem?.posterUrl})`,
          filter: 'blur(32px) saturate(1.2)'
        }}
      />

      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/40 to-black" />

      <div className="mx-auto max-w-[1600px] px-6 lg:px-10 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-8 items-center">
          <div className="relative">
            <div className="flex gap-3 lg:gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide">
              {items.slice(0, 10).map((item, index) => (
                <button
                  key={item.id}
                  onMouseEnter={() => setFocusedIndex(index)}
                  onFocus={() => setFocusedIndex(index)}
                  onClick={() => onInfo(item)}
                  className={`snap-start shrink-0 w-[160px] lg:w-[200px] focus-glow rounded-[var(--radius-xl)] overflow-hidden bg-white/5 transition-all duration-300 ${
                    focusedIndex === index ? 'scale-105 ring-2 ring-[color:var(--accent)]' : ''
                  }`}
                  style={{ minHeight: '240px' }}
                >
                  <img
                    src={item.posterUrl}
                    alt={item.title}
                    className="w-full h-[240px] lg:h-[300px] object-cover"
                    loading={index < 5 ? 'eager' : 'lazy'}
                  />
                </button>
              ))}
            </div>
          </div>

          <aside className="self-center space-y-4">
            <div>
              <h2
                className="text-3xl lg:text-5xl font-[800] leading-tight tracking-tight"
                style={{ fontFamily: 'Urbanist, "Inter Tight", system-ui' }}
              >
                {currentItem?.title}
              </h2>
              <div className="text-sm text-[color:var(--muted)] mt-2 flex items-center gap-2">
                {currentItem?.year && <span>{currentItem.year}</span>}
                {currentItem?.year && currentItem?.type && <span>•</span>}
                {currentItem?.type && <span className="capitalize">{currentItem.type}</span>}
              </div>
            </div>

            {currentItem?.overview && (
              <p className="text-[15px] leading-relaxed opacity-90 line-clamp-4">
                {currentItem.overview}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => onPlay(currentItem)}
                className="flex items-center gap-2 rounded-full px-6 py-3 bg-[color:var(--accent)] text-black font-semibold hover:opacity-90 focus-ring transition-all"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Watch</span>
              </button>
              <button
                onClick={() => onInfo(currentItem)}
                className="flex items-center gap-2 rounded-full px-6 py-3 bg-white/10 hover:bg-white/15 focus-ring transition-all"
              >
                <Info className="w-5 h-5" />
                <span>More Info</span>
              </button>
            </div>
          </aside>
        </div>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
}
