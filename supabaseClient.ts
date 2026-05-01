import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

try {
  const supabaseUrl = (window.localStorage.getItem('SUPABASE_URL_OVERRIDE') || import.meta.env.VITE_SUPABASE_URL || '').trim();
  const supabaseAnonKey = (window.localStorage.getItem('SUPABASE_ANON_KEY_OVERRIDE') || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  } else if (supabaseUrl || supabaseAnonKey) {
    console.warn('Supabase configuration is incomplete or invalid.');
  }
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
}

export const supabase = supabaseClient;
