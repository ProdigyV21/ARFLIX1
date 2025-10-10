export const tmdbBackdrop = (
  path?: string | null,
  size: 'w780' | 'w1280' | 'original' = 'w780'
): string => {
  if (!path) return '/images/placeholder-16x9.svg';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export const tmdbPoster = (
  path?: string | null,
  size: 'w342' | 'w500' | 'w780' | 'original' = 'w500'
): string => {
  if (!path) return '/images/placeholder-16x9.svg';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};
