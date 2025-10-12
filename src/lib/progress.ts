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

import { supabase } from './supabase';

/**
 * Persist watch progress both locally and remotely.  The progress is stored
 * in localStorage to enable instant resume while offline.  A copy is also
 * pushed to the Supabase `watch_history` table so that users can resume
 * watching on other devices.  Errors during the remote save are logged
 * quietly and do not interrupt local updates.
 *
 * @param progress The watch progress to save.
 */
export async function saveProgress(progress: WatchProgress): Promise<void> {
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

  // Persist locally for offline resume
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));

  // Persist remotely for cross‑device resume
  try {
    const payload = {
      content_id: progress.id,
      content_type: progress.type === 'anime' ? 'series' : progress.type,
      title: progress.title,
      poster: progress.poster ?? null,
      season: progress.seasonNumber,
      episode: progress.episodeNumber,
      position: progress.currentTime,
      duration: progress.duration,
      last_watched: new Date(progress.updatedAt).toISOString(),
    };

    // Use upsert to either insert a new record or update the existing one.
    const { error } = await supabase
      .from('watch_history')
      .upsert(payload, { onConflict: 'content_id' });

    if (error) {
      console.error('Failed to upsert watch history:', error);
    }
  } catch (err) {
    console.error('Unexpected error saving watch history:', err);
  }

  // Auto mark watched at 95%
  try {
    if (progress.duration > 0 && progress.currentTime / progress.duration >= 0.95) {
      const key = `${progress.type}:${progress.id}` + (progress.seasonNumber && progress.episodeNumber ? `:s${progress.seasonNumber}:e${progress.episodeNumber}` : '');
      const raw = localStorage.getItem('watched');
      const set = new Set<string>(raw ? JSON.parse(raw) : []);
      if (!set.has(key)) {
        set.add(key);
        localStorage.setItem('watched', JSON.stringify(Array.from(set)));
      }
    }
  } catch {}
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
