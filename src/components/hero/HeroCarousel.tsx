import { useState, useEffect, useRef } from 'react';
import { Play, Plus, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import type { HeroItem } from '../../lib/tmdb';
import { getHeroItems } from '../../lib/getHeroCollections';

interface HeroCarouselProps {
  onPlayClick?: (item: HeroItem) => void;
  onInfoClick?: (item: HeroItem) => void;
}

export default function HeroCarousel({ onPlayClick, onInfoClick }: HeroCarouselProps) {
  const [items, setItems] = useState<HeroItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    const data = await getHeroItems();
    setItems(data);
    setLoading(false);
  }

  const activeItem = items[activeIndex];

  if (loading) {
    return (
      <div className="relative w-full h-screen bg-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  // Fallback if no items loaded
  const fallbackItems: HeroItem[] = [{
    id: 'tmdb:movie:533535',
    type: 'movie',
    title: 'Deadpool & Wolverine',
    year: '2024',
    overview: 'A listless Wade Wilson toils away in civilian life with his days as the morally flexible mercenary, Deadpool, behind him. But when his homeworld faces an existential threat, Wade must reluctantly suit-up again with an even more reluctant Wolverine.',
    poster16x9: 'https://image.tmdb.org/t/p/w780/yDHYTfA3R0jFYba16jBB1ef8oIt.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/yDHYTfA3R0jFYba16jBB1ef8oIt.jpg',
    rating: 7.7,
    trailer: null
  }];

  const displayItems = items.length > 0 ? items : fallbackItems;
  const displayItem = displayItems[activeIndex];

  const scrollTo = (index: number) => {
    setActiveIndex(index);
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const itemWidth = container.scrollWidth / displayItems.length;
      container.scrollTo({
        left: itemWidth * index,
        behavior: 'smooth'
      });
    }
  };

  const handleNext = () => {
    const nextIndex = (activeIndex + 1) % displayItems.length;
    scrollTo(nextIndex);
  };

  const handlePrev = () => {
    const prevIndex = activeIndex === 0 ? displayItems.length - 1 : activeIndex - 1;
    scrollTo(prevIndex);
  };

  return (
    <section className="relative w-full">
      <div
        ref={scrollContainerRef}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        onScroll={(e) => {
          const container = e.currentTarget;
          const itemWidth = container.scrollWidth / displayItems.length;
          const newIndex = Math.round(container.scrollLeft / itemWidth);
          if (newIndex !== activeIndex) {
            setActiveIndex(newIndex);
          }
        }}
      >
        {displayItems.map((item, index) => (
          <div key={item.id} className="relative w-full h-[75vh] flex-shrink-0 snap-start">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${item.backdrop})`
              }}
            />

            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

            <div className="relative h-full flex flex-col justify-end pb-12 px-8 max-w-3xl">
              <h1
                className="text-7xl font-[900] leading-[0.95] tracking-tight mb-6 text-white drop-shadow-2xl"
                style={{ fontFamily: 'Urbanist, "Inter Tight", system-ui' }}
              >
                {item.title}
              </h1>

              <div className="flex items-center gap-4 mb-6 text-white">
                <span className="text-lg font-semibold">{item.year || '2024'}</span>
                <span className="text-white/60">•</span>
                <span className="text-lg font-semibold">{item.type === 'movie' ? 'Movie' : 'TV Series'}</span>
                {item.rating && (
                  <>
                    <span className="text-white/60">•</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="text-yellow-400 text-xl">★</span>
                      ))}
                      <span className="ml-2 text-lg font-semibold">{item.rating}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="mb-6">
                {item.overview && (
                  <p className="text-lg leading-relaxed text-white/95 line-clamp-3 max-w-2xl">
                    {item.overview}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => onPlayClick?.(item)}
                  className="flex items-center gap-3 px-10 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-white/90 transition-all focus-ring shadow-xl"
                >
                  <Play className="w-6 h-6 fill-current" />
                  <span>Play</span>
                </button>

                <button
                  onClick={() => onInfoClick?.(item)}
                  className="flex items-center justify-center w-14 h-14 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full transition-all focus-ring"
                  aria-label="More info"
                >
                  <Info className="w-6 h-6" />
                </button>

                <button
                  className="flex items-center justify-center w-14 h-14 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full transition-all focus-ring"
                  aria-label="Add to watchlist"
                >
                  <Plus className="w-7 h-7" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      {displayItems.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full transition-all focus-ring z-10"
            aria-label="Previous"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full transition-all focus-ring z-10"
            aria-label="Next"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      {/* Dot Indicators */}
      {displayItems.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {displayItems.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === activeIndex ? 'bg-white w-8' : 'bg-white/50 hover:bg-white/80'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
