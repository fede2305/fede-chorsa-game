// Lobby: mapa de las 5 etapas (bloqueadas/abiertas por reloj real),
// puntaje total y leaderboard.

import { ETAPA_NAMES } from '../chorsa.js';
import { LINEUP, slotsForEtapa, totalEtapas } from '../lineup.js';
import { isEtapaUnlocked, unlockLabel } from '../clock.js';
import { fetchLeaderboard, signOut } from '../supabase.js';

function totalScore(scores) {
  return Object.values(scores).reduce((a, b) => a + b, 0);
}

function etapaScore(scores, etapa) {
  return slotsForEtapa(etapa).reduce((a, s) => a + (scores[s.slot] || 0), 0);
}

export function renderLobby(root, { go, state }) {
  const s = document.createElement('div');
  s.className = 'screen';

  const u = state.user;
  const total = totalScore(state.scores);

  s.innerHTML = `
    <div class="topbar">
      ${u.avatar ? `<img src="${u.avatar}" alt="">` : ''}
      <div class="who">${escapeHtml(u.name)}</div>
      <div class="total">
        <div class="muted">Tu total</div>
        <b>${total}</b>
      </div>
    </div>

    <h2 style="margin-top:4px">Etapas de la noche</h2>
    <div id="etapas"></div>

    <h2>Ranking</h2>
    <div id="lb"><div class="spinner"></div></div>

    <button class="btn ghost" id="out">Salir</button>
  `;

  const etapasEl = s.querySelector('#etapas');
  for (let e = 1; e <= totalEtapas(); e++) {
    const unlocked = isEtapaUnlocked(e);
    const games = slotsForEtapa(e).length;
    const escore = etapaScore(state.scores, e);
    const card = document.createElement('div');
    card.className = 'etapa-card' + (unlocked ? '' : ' locked');
    card.innerHTML = `
      <div class="num">${e}</div>
      <div class="info">
        <div class="name">${ETAPA_NAMES[e]}</div>
        <div class="sub">${
          unlocked
            ? `${games} minijuegos`
            : `Se abre ${unlockLabel(e)}`
        }</div>
      </div>
      <div class="pts">${escore || ''}</div>
    `;
    if (unlocked) {
      card.style.cursor = 'pointer';
      card.onclick = () => go('etapa', { etapa: e });
    }
    etapasEl.appendChild(card);
  }

  s.querySelector('#out').onclick = async () => {
    await signOut();
    state.user = null;
    state.scores = {};
    go('intro');
  };

  root.appendChild(s);

  // Leaderboard async.
  fetchLeaderboard().then((rows) => {
    const lb = s.querySelector('#lb');
    if (!rows.length) {
      lb.innerHTML = '<p class="muted">Todavia no jugo nadie. Se el primero.</p>';
      return;
    }
    lb.innerHTML = '';
    rows.slice(0, 20).forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'lb-row' + (r.id === u.id ? ' me' : '');
      row.innerHTML = `
        <div class="rank">${i + 1}</div>
        ${r.avatar ? `<img src="${r.avatar}" alt="">` : ''}
        <div class="nm">${escapeHtml(r.name)}</div>
        <div class="tt">${r.total}</div>
      `;
      lb.appendChild(row);
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  })[c]);
}
