import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const STORAGE_BUCKET = 'gallery';

export type MediaType = 'image' | 'video';
export type UserRole = 'user' | 'admin';

export interface MediaRecord {
  id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  public_url: string;
  file_size: number;
  mime_type: string | null;
  media_type: MediaType;
  is_favorite: boolean;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface AdminMediaRecord extends MediaRecord {
  uploader_email: string;
}

export interface MediaStats {
  total_media: number;
  total_users: number;
  total_images: number;
  total_videos: number;
  total_storage_bytes: number;
}
