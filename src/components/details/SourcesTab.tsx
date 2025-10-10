import { useState, useEffect } from 'react';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

interface Stream {
  name: string;
  title?: string;
  url: string;
  quality: string;
  codec: string;
  host: string;
  infoHash?: string;
}

interface SourcesTabProps {
  itemId: string;
}

export function SourcesTab({ itemId }: SourcesTabProps) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noAddons, setNoAddons] = useState(false);

  useEffect(() => {
    async function loadStreams() {
      try {
        setLoading(true);
        setError(null);
        setNoAddons(false);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Please sign in to view sources');
          return;
        }

        const [, type] = itemId.split(':');
        const res = await fetch(
          `${API_BASE}/catalog-streams/${type}/${itemId}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!res.ok) {
          throw new Error('Failed to load sources');
        }

        const data = await res.json();

        if (data.message && data.message.includes('No enabled add-ons')) {
          setNoAddons(true);
          setStreams([]);
        } else {
          setStreams(data.streams || []);
        }
      } catch (err: any) {
        console.error('Failed to load streams:', err);
        setError(err.message || 'Failed to load sources');
      } finally {
        setLoading(false);
      }
    }

    loadStreams();
  }, [itemId]);

  if (loading) {
    return <div className="text-center py-12">Loading sources...</div>;
  }

  if (noAddons) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center gap-3 px-6 py-4 bg-blue-500/20 border border-blue-500/50 rounded-lg mb-4">
          <AlertCircle className="w-6 h-6 text-blue-300" />
          <div className="text-left">
            <p className="text-lg font-semibold text-blue-200">No streams yet</p>
            <p className="text-white/70">
              Connect a Stremio add-on on the Add-ons page to get streams.
            </p>
          </div>
        </div>
        <a
          href="/addons"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-white/90 transition-all"
        >
          Go to Add-ons
          <ExternalLink className="w-5 h-5" />
        </a>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-white/60">
        <p>{error}</p>
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div className="text-center py-12 text-white/60">
        <p>No sources available for this content</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Available Sources</h2>
        <span className="text-white/60">{streams.length} source{streams.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="grid gap-3">
        {streams.map((stream, index) => (
          <div
            key={index}
            data-focusable="true"
            className="group bg-white/5 hover:bg-white/10 rounded-lg p-4 flex items-center gap-4 transition-colors cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold truncate">{stream.name}</h3>
                <div className="flex items-center gap-2">
                  {stream.quality && stream.quality !== 'Unknown' && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs font-semibold rounded">
                      {stream.quality}
                    </span>
                  )}
                  {stream.codec && stream.codec !== 'Unknown' && (
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs font-semibold rounded">
                      {stream.codec}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-white/60 truncate">
                {stream.host || 'Unknown host'}
              </p>
            </div>

            <ExternalLink className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
