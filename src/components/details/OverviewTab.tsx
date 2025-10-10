interface OverviewTabProps {
  meta: any;
}

export function OverviewTab({ meta }: OverviewTabProps) {
  return (
    <div className="space-y-8">
      {meta.overview && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Synopsis</h2>
          <p className="text-lg text-white/80 leading-relaxed">{meta.overview}</p>
        </div>
      )}

      {meta.cast && meta.cast.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Cast</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {meta.cast.map((actor: any, index: number) => (
              <div key={index} className="flex items-center gap-3">
                {actor.profile && (
                  <img
                    src={actor.profile}
                    alt={actor.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{actor.name}</p>
                  {actor.character && (
                    <p className="text-sm text-white/60 truncate">{actor.character}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {meta.director && (
          <div>
            <h3 className="text-sm text-white/60 mb-1">Director</h3>
            <p className="text-lg font-medium">{meta.director}</p>
          </div>
        )}

        {meta.creators && meta.creators.length > 0 && (
          <div>
            <h3 className="text-sm text-white/60 mb-1">Creators</h3>
            <p className="text-lg font-medium">{meta.creators.join(', ')}</p>
          </div>
        )}

        {meta.studios && meta.studios.length > 0 && (
          <div>
            <h3 className="text-sm text-white/60 mb-1">Studio</h3>
            <p className="text-lg font-medium">{meta.studios.join(', ')}</p>
          </div>
        )}

        {meta.networks && meta.networks.length > 0 && (
          <div>
            <h3 className="text-sm text-white/60 mb-1">Network</h3>
            <p className="text-lg font-medium">{meta.networks.join(', ')}</p>
          </div>
        )}

        {meta.status && (
          <div>
            <h3 className="text-sm text-white/60 mb-1">Status</h3>
            <p className="text-lg font-medium">{meta.status}</p>
          </div>
        )}

        {meta.releaseInfo && (
          <div>
            <h3 className="text-sm text-white/60 mb-1">Release Date</h3>
            <p className="text-lg font-medium">
              {new Date(meta.releaseInfo).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
