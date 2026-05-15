// Resultados de la etapa: desglose por minijuego, total acumulado y posicion.

import { ETAPA_NAMES } from '../chorsa.js';
import { slotsForEtapa } from '../lineup.js';
import { GAMES } from '../games/registry.js';
import { fetchLeaderboard } from '../supabase.js';

export function renderResults(root, { go, state, params }) {
  const etapa = params.etapa;
  const slots = slotsForEtapa(etapa);
  const etapaTotal = slots.reduce((a, s) => a + (state.scores[s.slot] || 0), 0);
  const granTotal = Object.values(state.scores).reduce((a, b) => a + b, 0);

  const s = document.createElement('div');
  s.className = 'screen';
  s.innerHTML = `
    <h1>${ETAPA_NAMES[etapa]} <span class="brand">completada</span></h1>
    <div class="score-big" style="text-align:left">${etapaTotal}</div>
    <p>Puntos de esta etapa</p>

    <h2>Desglose</h2>
    <div id="bd"></div>

    <div class="topbar" style="margin-top:18px">
      <div class="who">Tu total acumulado</div>
      <div class="total"><b>${granTotal}</b></div>
    </div>

    <div id="rank"><div class="spinner"></div></div>

    <button class="btn" id="back">Volver al lobby</button>
  `;

  const bd = s.querySelector('#bd');
  slots.forEach((slot, i) => {
    const meta = GAMES[slot.game];
    const row = document.createElement('div');
    row.className = 'lb-row';
    row.innerHTML = `
      <div class="rank">${i + 1}</div>
      <div class="nm">${meta.name}${slot.boss ? ' (jefe)' : ''}</div>
      <div class="tt">${state.scores[slot.slot] || 0}</div>
    `;
    bd.appendChild(row);
  });

  s.querySelector('#back').onclick = () => go('lobby');
  root.appendChild(s);

  fetchLeaderboard().then((rows) => {
    const rank = s.querySelector('#rank');
    const pos = rows.findIndex((r) => r.id === state.user.id);
    if (pos < 0) {
      rank.innerHTML = '';
      return;
    }
    rank.innerHTML = `<p class="center">Vas <b style="color:#f3c14b">${
      pos + 1
    }&ordm;</b> de ${rows.length} jugadores</p>`;
  });
}
