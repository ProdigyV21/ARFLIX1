import type { HeroItem } from '../../lib/tmdb';
import MediaCard16x9 from '../media/MediaCard16x9';

interface HeroRailProps {
  items: HeroItem[];
  onSelect: (item: HeroItem) => void;
  activeId?: string;
}

export default function HeroRail({ items, onSelect, activeId: _activeId }: HeroRailProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="px-16">
      <div className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide">
        {items.map((item) => {
          return (
            <div
              key={item.id}
              className="snap-start shrink-0 w-[280px] sm:w-[320px] lg:w-[360px]"
            >
              <MediaCard16x9
                item={{
                  id: item.id,
                  title: item.title,
                  image16x9: item.poster16x9,
                  year: item.year
                }}
                onClick={() => onSelect(item)}
              />
            </div>
          );
        })}
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
    </div>
  );
}
