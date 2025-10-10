import { ExternalLink } from 'lucide-react';

interface Trailer {
  id: string;
  name: string;
  key: string;
  site: string;
  type: string;
  url: string;
}

interface TrailersTabProps {
  trailers: Trailer[];
}

export function TrailersTab({ trailers }: TrailersTabProps) {
  if (!trailers || trailers.length === 0) {
    return (
      <div className="text-center py-12 text-white/60">
        <p>No trailers available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Trailers & Videos</h2>

      <div className="grid gap-4">
        {trailers.map((trailer) => (
          <a
            key={trailer.id}
            href={trailer.url}
            target="_blank"
            rel="noopener noreferrer"
            data-focusable="true"
            className="group bg-white/5 hover:bg-white/10 rounded-lg overflow-hidden flex gap-4 transition-colors"
          >
            <div className="relative w-80 h-44 flex-shrink-0 bg-black">
              <img
                src={`https://img.youtube.com/vi/${trailer.key}/mqdefault.jpg`}
                alt={trailer.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white ml-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex-1 py-4 pr-4 flex flex-col justify-center">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h3 className="text-lg font-semibold">{trailer.name}</h3>
                <ExternalLink className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors flex-shrink-0" />
              </div>
              <div className="flex items-center gap-3 text-sm text-white/60">
                <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded">
                  {trailer.site}
                </span>
                <span>{trailer.type}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
