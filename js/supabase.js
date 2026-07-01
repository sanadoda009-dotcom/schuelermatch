import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://blufrvuskqiloslyxjkx.supabase.co'
const SUPABASE_KEY = 'sb_publishable_R0aH-kk1w4m1Umo5jCjV9Q_sM9-rt_8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
