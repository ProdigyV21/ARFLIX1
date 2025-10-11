import { useState, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import MediaCard16x9 from '../components/media/MediaCard16x9';
import { useFocusManager } from '../lib/focus';
import { searchContent } from '../lib/api';

interface SearchPageProps {
  onNavigate: (page: string, data?: any) => void;
}

interface SearchResult {
  id: string;
  type: 'movie' | 'series' | 'anime';
  title: string;
  year?: number;
  overview?: string;
  poster?: string;
  backdrop?: string;
  rating?: number;
}

export function SearchPage({ onNavigate }: SearchPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useFocusManager(containerRef, {
    autofocus: false,
  });

  async function handleSearch() {
    if (!query.trim() || query.trim().length < 2) return;

    try {
      setSearching(true);
      setHasSearched(true);
      setResults([]);

      const response = await searchContent(query.trim());
      setResults(response.results || []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  const movies = results.filter(item => item.type === 'movie');
  const tvShows = results.filter(item => item.type === 'series' || item.type === 'anime');

  return (
    <div ref={containerRef} className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto mb-12">
        <h1 className="text-5xl font-bold mb-8">Search</h1>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for movies and shows..."
              className="w-full pl-14 pr-4 py-4 bg-secondary/50 backdrop-blur border border-white/20 rounded-lg text-xl focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-transparent"
              autoFocus
            />
          </div>

          <button
            data-focusable="true"
            onClick={handleSearch}
            disabled={searching || !query.trim() || query.trim().length < 2}
            className="px-8 py-4 bg-white text-black rounded-lg text-lg font-semibold hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searching ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>

      {searching && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-16 h-16 animate-spin mb-4" />
          <p className="text-xl text-muted-foreground">Searching...</p>
        </div>
      )}

      {!searching && hasSearched && results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-2xl text-muted-foreground">No results found for "{query}"</p>
          <p className="text-lg text-muted-foreground/60 mt-2">
            Try a different search term or add more add-ons
          </p>
        </div>
      )}

      {!searching && results.length > 0 && (
        <div className="px-8 space-y-12">
          {movies.length > 0 && (
            <section>
              <h2 className="text-3xl font-bold mb-6">
                Movies ({movies.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {movies.map((item) => (
                  <MediaCard16x9
                    key={item.id}
                    item={{
                      id: item.id,
                      title: item.title,
                      image16x9: item.backdrop || item.poster || '',
                      year: item.year?.toString(),
                    }}
                    onClick={() =>
                      onNavigate('details', {
                        id: item.id,
                        type: item.type,
                      })
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {tvShows.length > 0 && (
            <section>
              <h2 className="text-3xl font-bold mb-6">
                TV Shows ({tvShows.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {tvShows.map((item) => (
                  <MediaCard16x9
                    key={item.id}
                    item={{
                      id: item.id,
                      title: item.title,
                      image16x9: item.backdrop || item.poster || '',
                      year: item.year?.toString(),
                    }}
                    onClick={() =>
                      onNavigate('details', {
                        id: item.id,
                        type: item.type,
                      })
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
