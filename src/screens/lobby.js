// Lobby: mapa de las 5 etapas (bloqueadas/abiertas por reloj real),
// puntaje total y leaderboard.

import { ETAPA_NAMES } from '../chorsa.js';
import { LINEUP, slotsForEtapa, totalEtapas } from '../lineup.js';
import { isEtapaUnlocked, unlockLabel, isDemoMode, setDemoMode } from '../clock.js';
import { fetchLeaderboard, signOut, clearMyScores, adminResetPlayer, adminResetAll } from '../supabase.js';

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
      <div class="total" id="secret-tap" style="cursor:default">
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
    const completed = state.completedEtapas.includes(e);
    const games = slotsForEtapa(e).length;
    const escore = etapaScore(state.scores, e);
    const card = document.createElement('div');
    card.className = 'etapa-card' + (unlocked && !completed ? '' : ' locked');
    card.innerHTML = `
      <div class="num">${e}</div>
      <div class="info">
        <div class="name">${ETAPA_NAMES[e]}</div>
        <div class="sub">${
          completed
            ? 'Ya jugaste — intentos agotados'
            : unlocked
            ? `${games} minijuegos`
            : `Se abre ${unlockLabel(e)}`
        }</div>
      </div>
      <div class="pts">${escore || (completed ? '✓' : '')}</div>
    `;
    if (unlocked && !completed) {
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

  // ── SECRET ADMIN TAP ─────────────────────────────────────────────────────
  // 5 toques rapidos en el total score → abre panel admin
  let tapCount = 0;
  let tapTimer = null;
  s.querySelector('#secret-tap').addEventListener('click', () => {
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { tapCount = 0; }, 2500);
    if (tapCount >= 5) {
      tapCount = 0;
      clearTimeout(tapTimer);
      openAdminPanel(root, { go, state });
    }
  });
}

// ── ADMIN PANEL ────────────────────────────────────────────────────────────
function openAdminPanel(root, { go, state }) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,18,0.92);z-index:999;overflow-y:auto;padding:24px 16px 40px';

  function rebuild() {
    overlay.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'overlay-card';
    card.style.cssText = 'max-width:360px;margin:auto;text-align:left;padding:24px';

    const demo = isDemoMode();

    card.innerHTML = `
      <h2 style="margin:0 0 4px">🛠 Admin</h2>
      <p style="color:#888;font-size:13px;margin:0 0 20px">Modo oculto — solo vos sabés esto</p>

      <h3 style="margin:0 0 8px;font-size:15px">Modo demo</h3>
      <p style="font-size:13px;color:#aaa;margin:0 0 8px">Desbloquea todas las etapas sin importar la hora.</p>
      <button class="btn" id="toggle-demo" style="margin-bottom:20px;width:100%">
        Demo: ${demo ? '✅ ACTIVO' : '❌ INACTIVO'}
      </button>

      <h3 style="margin:0 0 8px;font-size:15px">Desbloquear etapas para rejugar</h3>
      <div id="etapa-unlocks" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px"></div>

      <h3 style="margin:0 0 8px;font-size:15px">Mis puntajes</h3>
      <button class="btn ghost" id="reset-me" style="width:100%;margin-bottom:20px">
        Borrar mis puntajes
      </button>

      <h3 style="margin:0 0 8px;font-size:15px">Jugadores</h3>
      <div id="admin-players"><div class="spinner"></div></div>

      <button class="btn secondary" id="close-admin" style="width:100%;margin-top:24px">Cerrar</button>
    `;

    overlay.appendChild(card);
    root.appendChild(overlay);

    // toggle demo
    card.querySelector('#toggle-demo').onclick = () => {
      setDemoMode(!demo);
      overlay.remove();
      root.innerHTML = '';
      renderLobby(root, { go, state });
    };

    // etapa unlock buttons
    const etapaUnlocks = card.querySelector('#etapa-unlocks');
    for (let e = 1; e <= totalEtapas(); e++) {
      if (state.completedEtapas.includes(e)) {
        const btn = document.createElement('button');
        btn.className = 'btn ghost';
        btn.style.cssText = 'padding:6px 14px;font-size:13px';
        btn.textContent = `Etapa ${e}`;
        btn.onclick = () => {
          state.completedEtapas = state.completedEtapas.filter((x) => x !== e);
          localStorage.setItem('fc_completed', JSON.stringify(state.completedEtapas));
          rebuild();
        };
        etapaUnlocks.appendChild(btn);
      }
    }
    if (!etapaUnlocks.children.length) {
      etapaUnlocks.innerHTML = '<span style="color:#888;font-size:13px">Ninguna etapa completada aún</span>';
    }

    // reset my scores
    card.querySelector('#reset-me').onclick = async () => {
      if (!confirm('¿Borrar TUS puntajes? No se puede deshacer.')) return;
      await clearMyScores(state.user.id);
      state.scores = {};
      state.completedEtapas = state.completedEtapas.filter((e) => {
        // remove etapas where I had scores
        return false; // clear all
      });
      state.completedEtapas = [];
      localStorage.setItem('fc_completed', JSON.stringify([]));
      overlay.remove();
      root.innerHTML = '';
      renderLobby(root, { go, state });
    };

    // players list
    fetchLeaderboard().then((rows) => {
      const pl = card.querySelector('#admin-players');
      if (!rows.length) {
        pl.innerHTML = '<span style="color:#888;font-size:13px">Sin jugadores aún</span>';
        return;
      }
      pl.innerHTML = '';
      rows.forEach((r) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';
        row.innerHTML = `
          ${r.avatar ? `<img src="${escapeHtml(r.avatar)}" style="width:28px;height:28px;border-radius:50%" alt="">` : '<div style="width:28px;height:28px;background:#333;border-radius:50%"></div>'}
          <span style="flex:1;font-size:14px">${escapeHtml(r.name)}</span>
          <span style="color:#888;font-size:12px">${r.total}pts</span>
        `;
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn ghost';
        resetBtn.style.cssText = 'padding:4px 10px;font-size:12px';
        resetBtn.textContent = 'Reset';
        resetBtn.onclick = async () => {
          if (!confirm(`¿Borrar puntajes de ${r.name}?`)) return;
          await adminResetPlayer(r.id);
          if (r.id === state.user.id) state.scores = {};
          rebuild();
        };
        row.appendChild(resetBtn);
        pl.appendChild(row);
      });

      const resetAllBtn = document.createElement('button');
      resetAllBtn.className = 'btn ghost';
      resetAllBtn.style.cssText = 'width:100%;margin-top:12px;color:#e23b2e;border-color:#e23b2e';
      resetAllBtn.textContent = 'Borrar TODOS los puntajes';
      resetAllBtn.onclick = async () => {
        if (!confirm('¿Borrar los puntajes de TODOS? No hay vuelta atrás.')) return;
        await adminResetAll();
        state.scores = {};
        state.completedEtapas = [];
        localStorage.setItem('fc_completed', JSON.stringify([]));
        overlay.remove();
        root.innerHTML = '';
        renderLobby(root, { go, state });
      };
      pl.appendChild(resetAllBtn);
    });

    card.querySelector('#close-admin').onclick = () => overlay.remove();
  }

  rebuild();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  })[c]);
}
