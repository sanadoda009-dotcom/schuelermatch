import { supabase } from './supabase.js'

// Prüft ob jemand eingeloggt ist und die richtige Rolle hat.
// Leitet sonst automatisch weiter.
export async function requireAuth(expectedRole) {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    window.location.href = 'login.html'
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (expectedRole && profile?.role !== expectedRole) {
    window.location.href = profile?.role === 'firma' ? 'dashboard-firma.html' : 'dashboard-schueler.html'
    return null
  }

  return profile
}

export async function logout() {
  await supabase.auth.signOut()
  window.location.href = 'login.html'
}
