import { useState } from 'react';
import ScrollCarousel from '../common/ScrollCarousel';
import ActorModal from './ActorModal';

export interface CastMember {
  id: string;
  name: string;
  character: string;
  profile?: string;
  profileUrl?: string;
}

interface CastCarouselProps {
  cast: CastMember[];
  className?: string;
  onNavigate?: (id: string, type: 'movie' | 'series') => void;
}

export default function CastCarousel({ cast, className = '', onNavigate }: CastCarouselProps) {
  const [selectedActor, setSelectedActor] = useState<CastMember | null>(null);

  if (cast.length === 0) return null;

  return (
    <>
      <div className={className}>
        <h2 className="text-2xl font-bold mb-4">Cast</h2>
        <ScrollCarousel id="cast-carousel" className="pb-2">
          {cast.map((member) => {
            const imageUrl = member.profile || member.profileUrl;
            
            return (
              <button
                key={member.id}
                onClick={() => setSelectedActor(member)}
                className="flex-shrink-0 w-32 text-left group/cast cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50 rounded-lg transition-transform duration-300 ease-out hover:scale-[1.03]"
                aria-label={`View details for ${member.name}`}
              >
                <div className="relative aspect-[2/3] mb-2 rounded-lg overflow-hidden bg-gray-800">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={member.name}
                      className="w-full h-full object-cover group-hover/cast:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="font-semibold text-sm line-clamp-1 mb-1 group-hover/cast:text-blue-400 transition-colors">
                  {member.name}
                </p>
                <p className="text-xs text-gray-400 line-clamp-2">
                  {member.character}
                </p>
              </button>
            );
          })}
        </ScrollCarousel>
      </div>

      {selectedActor && (
        <ActorModal
          actor={selectedActor}
          onNavigate={onNavigate}
          onClose={() => setSelectedActor(null)}
        />
      )}
    </>
  );
}

