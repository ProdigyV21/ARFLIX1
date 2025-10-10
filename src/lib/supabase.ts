import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Addon = {
  id: string;
  user_id: string;
  addon_id: string;
  name: string;
  version: string;
  url: string;
  icon: string | null;
  enabled: boolean;
  order_position: number;
  last_health: string;
  last_health_check: string;
  created_at: string;
  updated_at: string;
};

export type WatchHistoryItem = {
  id: string;
  user_id: string;
  content_id: string;
  content_type: 'movie' | 'series';
  title: string;
  poster: string | null;
  season?: number;
  episode?: number;
  position: number;
  duration: number;
  last_watched: string;
  created_at: string;
};

export type UserSettings = {
  theme?: string;
  language?: string;
};
