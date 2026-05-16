import './style.css';
import { initAuth, getUser, fetchMyScores } from './supabase.js';
import { renderIntro } from './screens/intro.js';
import { renderLogin } from './screens/login.js';
import { renderLobby } from './screens/lobby.js';
import { renderEtapa } from './screens/etapa.js';
import { renderResults } from './screens/results.js';

const app = document.getElementById('app');

// Estado global del jugador en esta sesion.
export const state = {
  user: null,
  scores: {}, // slot -> mejor puntaje
  completedEtapas: JSON.parse(localStorage.getItem('fc_completed') || '[]'),
};

const screens = {
  intro: renderIntro,
  login: renderLogin,
  lobby: renderLobby,
  etapa: renderEtapa,
  results: renderResults,
};

export function go(screen, params = {}) {
  app.innerHTML = '';
  screens[screen](app, { go, state, params });
}

export async function refreshScores() {
  if (state.user) {
    state.scores = await fetchMyScores(state.user.id);
  }
}

async function boot() {
  app.innerHTML = '<div class="screen"><div class="spinner"></div></div>';
  try {
    await initAuth();
  } catch (e) {
    console.warn('initAuth fallo:', e);
  }
  state.user = getUser();
  await refreshScores();
  go(state.user ? 'lobby' : 'intro');
}

boot();
