export type WatchProgress = {
  id: string;
  type: 'movie' | 'series' | 'anime';
  title: string;
  poster?: string;
  backdrop?: string;
  currentTime: number;
  duration: number;
  updatedAt: number;
  seasonNumber?: number;
  episodeNumber?: number;
};

const PROGRESS_KEY = 'arflix_watch_progress';

export function saveProgress(progress: WatchProgress): void {
  const all = getAllProgress();
  const index = all.findIndex(p => p.id === progress.id);

  if (index !== -1) {
    all[index] = progress;
  } else {
    all.unshift(progress);
  }

  if (all.length > 100) {
    all.splice(100);
  }

  localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
}

export function getProgress(id: string): WatchProgress | null {
  const all = getAllProgress();
  return all.find(p => p.id === id) || null;
}

export function getAllProgress(): WatchProgress[] {
  try {
    const data = localStorage.getItem(PROGRESS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function deleteProgress(id: string): void {
  const all = getAllProgress();
  const filtered = all.filter(p => p.id !== id);
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(filtered));
}

export function getContinueWatching(limit: number = 20): WatchProgress[] {
  const all = getAllProgress();
  return all
    .filter(p => {
      const progress = p.currentTime / p.duration;
      return progress >= 0.05 && progress < 0.95 && p.currentTime >= 90;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function shouldShowResumePrompt(progress: WatchProgress | null): boolean {
  if (!progress) return false;
  const ratio = progress.currentTime / progress.duration;
  return progress.currentTime >= 90 && ratio < 0.95;
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
