// js/supabase.js
// Supabase 클라이언트를 한 번만 만들어 export.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { CONFIG } from './config.js'

export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
