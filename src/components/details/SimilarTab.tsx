import type { CatalogItem } from '../../lib/catalog';

interface SimilarTabProps {
  similar: CatalogItem[];
}

export function SimilarTab({ similar }: SimilarTabProps) {
  if (!similar || similar.length === 0) {
    return (
      <div className="text-center py-12 text-white/60">
        <p>No similar content found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Similar Content</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {similar.map((item) => (
          <div
            key={item.id}
            data-focusable="true"
            className="group cursor-pointer"
          >
            <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-white/5">
              {item.poster ? (
                <>
                  <img
                    src={item.poster}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30">
                  No Image
                </div>
              )}

              {item.rating && (
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/70 rounded text-sm">
                  <span className="text-yellow-400">★</span>
                  <span>{item.rating.toFixed(1)}</span>
                </div>
              )}
            </div>

            <h3 className="font-semibold line-clamp-2 mb-1">{item.title}</h3>
            {item.year && (
              <p className="text-sm text-white/60">{item.year}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
