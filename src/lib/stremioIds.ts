import { ExternalIds } from './externalIds';

export function buildMovieCandidates(ext: ExternalIds, supportedPrefixes?: string[]): string[] {
  const candidates: string[] = [];
  const prefixes = supportedPrefixes || ['tt', 'tmdb', 'tvdb'];

  if (prefixes.includes('tt') && ext.imdbId) {
    candidates.push(ext.imdbId);
  }

  if (prefixes.includes('tmdb') && ext.tmdbMovieId) {
    candidates.push(`tmdb:${ext.tmdbMovieId}`);
  }

  if (prefixes.includes('tvdb') && ext.tvdbId) {
    candidates.push(`tvdb:${ext.tvdbId}`);
  }

  if (prefixes.includes('anilist') && ext.anilistId) {
    candidates.push(`anilist:${ext.anilistId}`);
  }

  if (prefixes.includes('kitsu') && ext.kitsuId) {
    candidates.push(`kitsu:${ext.kitsuId}`);
  }

  return candidates;
}

export function buildSeriesCandidates(
  ext: ExternalIds,
  season: number,
  episode: number,
  supportedPrefixes?: string[]
): string[] {
  const candidates: string[] = [];
  const prefixes = supportedPrefixes || ['tt', 'tmdb', 'tvdb'];

  if (prefixes.includes('tt') && ext.imdbId) {
    candidates.push(`${ext.imdbId}:${season}:${episode}`);
  }

  if (prefixes.includes('tmdb') && ext.tmdbTvId) {
    candidates.push(`tmdb:${ext.tmdbTvId}:${season}:${episode}`);
  }

  if (prefixes.includes('tvdb') && ext.tvdbId) {
    candidates.push(`tvdb:${ext.tvdbId}:${season}:${episode}`);
  }

  if (prefixes.includes('anilist') && ext.anilistId) {
    candidates.push(`anilist:${ext.anilistId}:${season}:${episode}`);
  }

  if (prefixes.includes('kitsu') && ext.kitsuId) {
    candidates.push(`kitsu:${ext.kitsuId}:${season}:${episode}`);
  }

  return candidates;
}

export function detectIdPrefixesFromManifest(manifest: any): string[] {
  const prefixes = new Set<string>();

  if (manifest.behaviorHints?.idPrefixes) {
    return manifest.behaviorHints.idPrefixes;
  }

  if (manifest.catalogs) {
    for (const catalog of manifest.catalogs) {
      if (catalog.id?.includes('imdb') || catalog.id?.includes('tt')) {
        prefixes.add('tt');
      }
      if (catalog.id?.includes('tmdb')) {
        prefixes.add('tmdb');
      }
      if (catalog.id?.includes('tvdb')) {
        prefixes.add('tvdb');
      }
      if (catalog.id?.includes('anilist')) {
        prefixes.add('anilist');
      }
      if (catalog.id?.includes('kitsu')) {
        prefixes.add('kitsu');
      }
    }
  }

  if (manifest.id) {
    const id = manifest.id.toLowerCase();
    if (id.includes('imdb')) prefixes.add('tt');
    if (id.includes('tmdb')) prefixes.add('tmdb');
    if (id.includes('tvdb')) prefixes.add('tvdb');
    if (id.includes('anilist')) prefixes.add('anilist');
    if (id.includes('kitsu')) prefixes.add('kitsu');
  }

  if (prefixes.size === 0) {
    return ['tt', 'tmdb', 'tvdb'];
  }

  return Array.from(prefixes);
}
