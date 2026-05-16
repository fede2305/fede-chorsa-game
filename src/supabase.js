// Capa de datos. Si hay credenciales de Supabase en .env, usa Supabase
// (auth Google + Postgres). Si no, cae en modo OFFLINE con localStorage
// y un usuario demo, para poder probar el juego sin backend.

import { createClient } from '@supabase/supabase-js';
import { LINEUP } from './lineup.js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const OFFLINE = !URL || !KEY || URL.includes('TU-PROYECTO');

let client = null;
let currentUser = null;

const LS_USER = 'fc_demo_user';
const LS_SCORES = 'fc_demo_scores';

function demoUser() {
  let name = localStorage.getItem(LS_USER);
  if (!name) {
    name = 'Vos (demo)';
    localStorage.setItem(LS_USER, name);
  }
  return { id: 'local', name, avatar: null };
}

export async function initAuth() {
  if (OFFLINE) {
    currentUser = localStorage.getItem(LS_USER) ? demoUser() : null;
    return;
  }
  client = createClient(URL, KEY);
  const { data } = await client.auth.getSession();
  currentUser = mapUser(data.session?.user);
  client.auth.onAuthStateChange((_evt, session) => {
    currentUser = mapUser(session?.user);
  });
}

function mapUser(u) {
  if (!u) return null;
  const m = u.user_metadata || {};
  return {
    id: u.id,
    name: m.full_name || m.name || u.email || 'Jugador',
    avatar: m.avatar_url || m.picture || null,
  };
}

export function getUser() {
  return currentUser;
}

// En modo OFFLINE recibe el nombre tipeado por el jugador.
// En modo online dispara el login con Google (redirige).
export async function signInWithGoogle(demoName) {
  if (OFFLINE) {
    const name = (demoName || '').trim() || 'Jugador';
    localStorage.setItem(LS_USER, name);
    currentUser = demoUser();
    return currentUser;
  }
  await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
  });
  // OAuth redirige; al volver, initAuth() retoma la sesion.
  return null;
}

export async function signOut() {
  if (OFFLINE) {
    localStorage.removeItem(LS_USER);
    currentUser = null;
    return;
  }
  await client.auth.signOut();
  currentUser = null;
}

// Devuelve { [slot]: bestScore } del usuario.
export async function fetchMyScores(userId) {
  if (OFFLINE) {
    return JSON.parse(localStorage.getItem(LS_SCORES) || '{}');
  }
  const { data, error } = await client
    .from('scores')
    .select('slot,best_score')
    .eq('user_id', userId);
  if (error) {
    console.warn('fetchMyScores:', error.message);
    return {};
  }
  const map = {};
  for (const row of data) map[row.slot] = row.best_score;
  return map;
}

// Guarda el puntaje de un slot si supera al guardado. Devuelve el mejor vigente.
export async function submitScore(user, slot, score) {
  const meta = LINEUP.find((s) => s.slot === slot);
  if (OFFLINE) {
    const scores = JSON.parse(localStorage.getItem(LS_SCORES) || '{}');
    if (!(slot in scores) || score > scores[slot]) scores[slot] = score;
    localStorage.setItem(LS_SCORES, JSON.stringify(scores));
    return scores[slot];
  }
  const { data: existing } = await client
    .from('scores')
    .select('best_score')
    .eq('user_id', user.id)
    .eq('slot', slot)
    .maybeSingle();
  const best = Math.max(score, existing?.best_score || 0);
  const { error } = await client.from('scores').upsert(
    {
      user_id: user.id,
      display_name: user.name,
      avatar_url: user.avatar,
      slot,
      etapa: meta.etapa,
      game: meta.game,
      best_score: best,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,slot' }
  );
  if (error) console.warn('submitScore:', error.message);
  return best;
}

// Borra todos los puntajes del usuario actual. Retorna null si ok, string si falla.
export async function clearMyScores(userId) {
  if (OFFLINE) {
    localStorage.removeItem(LS_SCORES);
    return null;
  }
  const { error } = await client.from('scores').delete().eq('user_id', userId);
  if (error) { console.warn('clearMyScores:', error.message); return error.message; }
  return null;
}

// Admin: borra puntajes de cualquier jugador (requiere RPC admin_reset_player en Supabase).
// Retorna null si ok, string de error si falla.
export async function adminResetPlayer(userId) {
  if (OFFLINE) {
    localStorage.removeItem(LS_SCORES);
    return null;
  }
  const { error } = await client.rpc('admin_reset_player', {
    p_user_id: userId,
    p_secret: 'ChorsaCumple29$',
  });
  if (error) { console.warn('adminResetPlayer:', error.message); return error.message; }
  return null;
}

// Admin: borra todos los puntajes (requiere RPC admin_reset_all en Supabase).
// Retorna null si ok, string de error si falla.
export async function adminResetAll() {
  if (OFFLINE) {
    localStorage.removeItem(LS_SCORES);
    return null;
  }
  const { error } = await client.rpc('admin_reset_all', { p_secret: 'ChorsaCumple29$' });
  if (error) { console.warn('adminResetAll:', error.message); return error.message; }
  return null;
}

// Ranking global: suma de best_score por jugador, ordenado desc.
export async function fetchLeaderboard() {
  if (OFFLINE) {
    const scores = JSON.parse(localStorage.getItem(LS_SCORES) || '{}');
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    const u = currentUser || demoUser();
    return [{ name: u.name, avatar: u.avatar, total, id: u.id }];
  }
  const { data, error } = await client
    .from('scores')
    .select('user_id,display_name,avatar_url,best_score');
  if (error) {
    console.warn('fetchLeaderboard:', error.message);
    return [];
  }
  const byUser = new Map();
  for (const row of data) {
    const cur = byUser.get(row.user_id) || {
      id: row.user_id,
      name: row.display_name,
      avatar: row.avatar_url,
      total: 0,
    };
    cur.total += row.best_score;
    byUser.set(row.user_id, cur);
  }
  return [...byUser.values()].sort((a, b) => b.total - a.total);
}
