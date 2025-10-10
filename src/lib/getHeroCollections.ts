import { fetchTrendingMovies, fetchTrendingTV, convertToHeroItem, type HeroItem } from './tmdb';

export async function getHeroItems(): Promise<HeroItem[]> {
  try {
    const [moviesRaw, seriesRaw] = await Promise.all([
      fetchTrendingMovies(),
      fetchTrendingTV()
    ]);

    // Get top 3 from each
    const top3Movies = moviesRaw.slice(0, 3);
    const top3Series = seriesRaw.slice(0, 3);

    const movies = await Promise.all(
      top3Movies.map(item => convertToHeroItem(item, 'movie'))
    );

    const series = await Promise.all(
      top3Series.map(item => convertToHeroItem(item, 'tv'))
    );

    // Combine and filter
    const allItems = [...movies, ...series].filter(item => item.backdrop);

    return allItems;
  } catch (error) {
    console.error('Failed to fetch hero items:', error);
    return [];
  }
}
