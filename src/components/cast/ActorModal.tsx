import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { CastMember } from './CastCarousel';
import MediaCard16x9 from '../media/MediaCard16x9';

interface ActorModalProps {
  actor: CastMember;
  onClose: () => void;
}

interface ActorDetails {
  biography: string;
  birthday?: string;
  knownFor: Array<{
    id: string;
    title: string;
    type: 'movie' | 'series';
    poster?: string;
    year?: number;
  }>;
}

export default function ActorModal({ actor, onClose }: ActorModalProps) {
  const [details, setDetails] = useState<ActorDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActorDetails() {
      try {
        setLoading(true);
        
        // Extract TMDB person ID from actor.id
        const fallbackId = actor.name?.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        const personId = actor.id && actor.id.includes(':') ? actor.id.split(':')[1] : actor.id || fallbackId;
        const tmdbApiKey = '080380c1ad7b3967af3def25159e4374';
        
        // Fetch actor details
        // If we don't have a numeric id, resolve by name first
        let resolvedId = personId;
        if (!/^\d+$/.test(resolvedId)) {
          const searchRes = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${tmdbApiKey}&language=en-US&query=${encodeURIComponent(actor.name)}&page=1&include_adult=false`);
          const searchJson = await searchRes.json();
          if (searchJson?.results?.length) {
            resolvedId = String(searchJson.results[0].id);
          }
        }

        const [personResponse, creditsResponse] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/person/${resolvedId}?api_key=${tmdbApiKey}&language=en-US`),
          fetch(`https://api.themoviedb.org/3/person/${resolvedId}/combined_credits?api_key=${tmdbApiKey}&language=en-US`)
        ]);

        if (!personResponse.ok || !creditsResponse.ok) {
          throw new Error('Failed to fetch actor details');
        }

        const personData = await personResponse.json();
        const creditsData = await creditsResponse.json();

        // Get top known for titles (sorted by popularity)
        const knownFor = [...(creditsData.cast || [])]
          .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
          .slice(0, 12)
          .map((credit: any) => ({
            id: `tmdb:${credit.id}`,
            title: credit.title || credit.name,
            type: credit.media_type === 'tv' ? 'series' : 'movie',
            poster: credit.poster_path 
              ? `https://image.tmdb.org/t/p/w342${credit.poster_path}`
              : undefined,
            year: credit.release_date 
              ? new Date(credit.release_date).getFullYear()
              : credit.first_air_date
              ? new Date(credit.first_air_date).getFullYear()
              : undefined
          }));

        setDetails({
          biography: personData.biography || 'No biography available.',
          birthday: personData.birthday,
          knownFor
        });
      } catch (error) {
        console.error('Failed to load actor details:', error);
        setDetails({
          biography: 'Unable to load actor information.',
          knownFor: []
        });
      } finally {
        setLoading(false);
      }
    }

    loadActorDetails();
  }, [actor.id]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const imageUrl = actor.profile || actor.profileUrl;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">{actor.name}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Actor Info */}
              <div className="flex gap-6 mb-8">
                {imageUrl && (
                  <div className="flex-shrink-0">
                    <img
                      src={imageUrl}
                      alt={actor.name}
                      className="w-48 h-72 object-cover rounded-lg"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-lg text-blue-400 mb-2">{actor.character}</p>
                  {details?.birthday && (
                    <p className="text-sm text-gray-400 mb-4">
                      Born: {new Date(details.birthday).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  )}
                  <div className="text-gray-300 leading-relaxed">
                    <h3 className="text-xl font-semibold mb-3">Biography</h3>
                    <p className="whitespace-pre-line">{details?.biography}</p>
                  </div>
                </div>
              </div>

              {/* Known For */}
              {details && details.knownFor.length > 0 && (
                <div>
                  <h3 className="text-2xl font-bold mb-4">Known For</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {details.knownFor.map((item) => (
                      <div key={item.id} className="flex-shrink-0">
                        <MediaCard16x9
                          item={{
                            id: item.id,
                            title: item.title,
                            image16x9: item.poster || '',
                            year: item.year?.toString()
                          }}
                          onClick={() => {
                            // Handle navigation
                            console.log('Navigate to:', item.id, item.type);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

