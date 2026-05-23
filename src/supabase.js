// Capa de datos. Si hay credenciales de Supabase en .env, usa Supabase
// (auth Google + Postgres). Si no, cae en modo OFFLINE con localStorage
// y un usuario demo, para poder probar el juego sin backend.

import { createClient } from '@supabase/supabase-js';
import { LINEUP } from './lineup.js';
import { isDemoMode } from './clock.js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const OFFLINE = !URL || !KEY || URL.includes('TU-PROYECTO');

let client = null;
let currentUser = null;

const LS_USER = 'fc_demo_user';
const LS_SCORES = 'fc_demo_scores';
const LS_LOCAL_SESSION = 'fc_local_session'; // { id, username, displayName, password }

const ADMIN_SECRET = 'ChorsaCumple29$';

// Lista de palabras simples ES (sin acentos ni ñ) para generar passwords
// faciles de dictar por voz. ~90 opciones * 100 numeros = 9000 combinaciones.
const PWD_WORDS = [
  'gato','perro','sol','luna','pizza','taco','mate','fuego','hielo','agua',
  'miel','pan','vino','queso','asado','dulce','sal','limon','mango','pera',
  'kiwi','uva','mora','banana','papa','maiz','arroz','leche','cafe','jugo',
  'soda','birra','fernet','ajo','cebolla','tomate','palta','jamon','churro','helado',
  'torta','flan','beso','abrazo','fiesta','baile','ritmo','salsa','tango','rock',
  'punk','jazz','blues','samba','cumbia','reggae','disco','metal','indie','pop',
  'mar','rio','cielo','nube','lluvia','viento','nieve','playa','monte','bosque',
  'rosa','clavel','jazmin','cactus','flor','arbol','hoja','rama','raiz','tronco',
  'oro','plata','cobre','bronce','rubi','jade','opalo','topacio','ambar','perla',
];

export function generateLocalPassword() {
  const w = PWD_WORDS[Math.floor(Math.random() * PWD_WORDS.length)];
  const n = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return w + n;
}

function localSession() {
  try { return JSON.parse(localStorage.getItem(LS_LOCAL_SESSION) || 'null'); }
  catch { return null; }
}
function setLocalSession(s) {
  if (s) localStorage.setItem(LS_LOCAL_SESSION, JSON.stringify(s));
  else localStorage.removeItem(LS_LOCAL_SESSION);
}
function localToUser(s) {
  return s ? { id: s.id, name: s.displayName, avatar: null, local: true } : null;
}

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
  if (data.session?.user) {
    currentUser = mapUser(data.session.user);
  } else {
    // Sin sesion Google: ver si hay sesion local guardada.
    currentUser = localToUser(localSession());
  }
  client.auth.onAuthStateChange((_evt, session) => {
    if (session?.user) {
      currentUser = mapUser(session.user);
      setLocalSession(null); // login Google reemplaza sesion local
    }
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

// Login con cuenta manual (creada por admin). Lanza Error si falla.
export async function signInWithLocal(username, password) {
  if (OFFLINE) throw new Error('Modo offline: no hay cuentas manuales.');
  if (!client) client = createClient(URL, KEY);
  const { data, error } = await client.rpc('local_account_login', {
    p_username: username,
    p_password: password,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Usuario o clave incorrectos');
  const sess = { id: row.id, username: row.username, displayName: row.display_name, password };
  setLocalSession(sess);
  currentUser = localToUser(sess);
  return currentUser;
}

export async function signOut() {
  if (OFFLINE) {
    localStorage.removeItem(LS_USER);
    currentUser = null;
    return;
  }
  if (currentUser?.local) {
    setLocalSession(null);
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
  if (isDemoMode()) return score; // demo: no guardar nada en DB ni localStorage
  if (OFFLINE) {
    const scores = JSON.parse(localStorage.getItem(LS_SCORES) || '{}');
    if (!(slot in scores) || score > scores[slot]) scores[slot] = score;
    localStorage.setItem(LS_SCORES, JSON.stringify(scores));
    return scores[slot];
  }
  if (user?.local) {
    const sess = localSession();
    if (!sess) { console.warn('submitScore: sin sesion local'); return score; }
    const { data, error } = await client.rpc('local_submit_score', {
      p_user_id: sess.id,
      p_password: sess.password,
      p_display_name: sess.displayName,
      p_slot: slot,
      p_etapa: meta.etapa,
      p_game: meta.game,
      p_score: score,
    });
    if (error) { console.warn('local_submit_score:', error.message); return score; }
    return data ?? score;
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
  if (currentUser?.local) {
    const sess = localSession();
    if (!sess) return 'sin sesion local';
    const { error } = await client.rpc('local_clear_scores', {
      p_user_id: sess.id,
      p_password: sess.password,
    });
    if (error) { console.warn('local_clear_scores:', error.message); return error.message; }
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

// ── ADMIN: cuentas manuales (sin Google) ─────────────────────────────────
// Devuelve { username, displayName, password, id } o { error: '...' }.
export async function adminCreateLocalAccount(username, displayName) {
  if (OFFLINE) return { error: 'Modo offline: no hay backend para crear cuentas.' };
  const password = generateLocalPassword();
  const { data, error } = await client.rpc('local_account_create', {
    p_username: username,
    p_display_name: displayName,
    p_password: password,
    p_secret: ADMIN_SECRET,
  });
  if (error) {
    if (/duplicate key/i.test(error.message) || /unique/i.test(error.message)) {
      return { error: 'Ese usuario ya existe' };
    }
    return { error: error.message };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: 'Sin respuesta del servidor' };
  return { id: row.id, username: row.username, displayName: row.display_name, password: row.password };
}

// Lista todas las cuentas locales. Devuelve [] si error.
export async function adminListLocalAccounts() {
  if (OFFLINE) return [];
  const { data, error } = await client.rpc('local_account_list', { p_secret: ADMIN_SECRET });
  if (error) { console.warn('local_account_list:', error.message); return []; }
  return (data || []).map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    password: r.password,
    createdAt: r.created_at,
  }));
}

// Genera nueva clave y la setea. Devuelve { password } o { error }.
export async function adminRegenerateLocalPassword(userId) {
  if (OFFLINE) return { error: 'Modo offline.' };
  const password = generateLocalPassword();
  const { error } = await client.rpc('local_account_regenerate_password', {
    p_user_id: userId,
    p_password: password,
    p_secret: ADMIN_SECRET,
  });
  if (error) return { error: error.message };
  return { password };
}

// Borra cuenta local + todos sus scores. Retorna null si ok, string si falla.
export async function adminDeleteLocalAccount(userId) {
  if (OFFLINE) return 'Modo offline.';
  const { error } = await client.rpc('local_account_delete', {
    p_user_id: userId,
    p_secret: ADMIN_SECRET,
  });
  if (error) { console.warn('local_account_delete:', error.message); return error.message; }
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
