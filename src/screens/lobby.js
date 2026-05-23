// Lobby: mapa de las 5 etapas (bloqueadas/abiertas por reloj real),
// puntaje total y leaderboard.

import { ETAPA_NAMES } from '../chorsa.js';
import { LINEUP, slotsForEtapa, totalEtapas } from '../lineup.js';
import { GAMES } from '../games/registry.js';
import { isEtapaUnlocked, unlockLabel, isDemoMode, setDemoMode, isNightOver } from '../clock.js';
import {
  fetchLeaderboard, signOut, clearMyScores, adminResetPlayer, adminResetAll, fetchMyScores,
  adminCreateLocalAccount, adminListLocalAccounts, adminRegenerateLocalPassword, adminDeleteLocalAccount,
} from '../supabase.js';

function totalScore(scores) {
  return Object.values(scores).reduce((a, b) => a + b, 0);
}

function etapaScore(scores, etapa) {
  return slotsForEtapa(etapa).reduce((a, s) => a + (scores[s.slot] || 0), 0);
}

export function renderLobby(root, { go, state, _skipRefresh }) {
  if (_skipRefresh) { _renderLobby(root, { go, state }); return; }
  // Refresca scores al entrar al lobby → detecta resets remotos
  fetchMyScores(state.user?.id || 'local').then((data) => {
    state.scores = data.scores || {};
    state.attempts = data.attempts || {};
    // Si una etapa está marcada jugada pero ya no tiene scores, desbloquear
    const before = state.completedEtapas.length;
    state.completedEtapas = state.completedEtapas.filter((e) =>
      slotsForEtapa(e).some((s) => s.slot in state.scores)
    );
    // Tambien: si todos los slots de una etapa tienen attempts=2, marcar completed.
    for (let e = 1; e <= 5; e++) {
      const allDone = slotsForEtapa(e).every((s) => (state.attempts[s.slot] || 0) >= 2);
      if (allDone && !state.completedEtapas.includes(e)) state.completedEtapas.push(e);
    }
    if (state.completedEtapas.length !== before) {
      localStorage.setItem('fc_completed', JSON.stringify(state.completedEtapas));
    }
    root.innerHTML = '';
    _renderLobby(root, { go, state });
  });
}

function _renderLobby(root, { go, state }) {
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

    ${isDemoMode() ? '<h2>🎮 Probar juego</h2><div id="demo-slots"></div>' : ''}

    <h2>Ranking</h2>
    <div id="lb"><div class="spinner"></div></div>

    <button class="btn ghost" id="out">Salir</button>
  `;

  const etapasEl = s.querySelector('#etapas');
  for (let e = 1; e <= totalEtapas(); e++) {
    const unlocked = isEtapaUnlocked(e);
    const completed = state.completedEtapas.includes(e);
    const slotList = slotsForEtapa(e);
    const games = slotList.length;
    const escore = etapaScore(state.scores, e);
    const nDone = slotList.filter((sl) => (state.attempts[sl.slot] || 0) >= 2).length;
    const nStarted = slotList.filter((sl) => (state.attempts[sl.slot] || 0) > 0).length;
    const partial = unlocked && !completed && nStarted > 0;

    const card = document.createElement('div');
    card.className = 'etapa-card' + (unlocked && !completed ? '' : ' locked');
    const nightOver = isNightOver() && !isDemoMode();
    card.innerHTML = `
      <div class="num">${e}</div>
      <div class="info">
        <div class="name">${ETAPA_NAMES[e]}</div>
        <div class="sub">${
          completed
            ? 'Ya jugaste — intentos agotados'
            : unlocked
            ? (partial ? `En progreso — ${nDone}/${games} terminados` : `${games} minijuegos`)
            : nightOver
            ? 'Termino la noche'
            : `Se abre ${unlockLabel(e)}`
        }</div>
      </div>
      <div class="pts">${escore || (completed ? '✓' : '') || (partial ? '…' : '')}</div>
    `;
    if (unlocked && !completed) {
      card.style.cursor = 'pointer';
      card.onclick = () => go('etapa', { etapa: e });
    }
    etapasEl.appendChild(card);
  }

  // Demo game selector
  if (isDemoMode()) {
    const demoEl = s.querySelector('#demo-slots');
    for (let e = 1; e <= totalEtapas(); e++) {
      const group = document.createElement('div');
      group.style.cssText = 'margin-bottom:10px';
      const label = document.createElement('div');
      label.style.cssText = 'font-size:12px;color:#888;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.5px';
      label.textContent = `Etapa ${e} — ${ETAPA_NAMES[e]}`;
      group.appendChild(label);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
      for (const slot of slotsForEtapa(e)) {
        const btn = document.createElement('button');
        btn.className = 'btn ghost';
        btn.style.cssText = 'padding:6px 12px;font-size:13px;flex:1;min-width:0';
        btn.textContent = GAMES[slot.game]?.name || slot.game;
        btn.onclick = () => go('demo_game', { slot });
        row.appendChild(btn);
      }
      group.appendChild(row);
      demoEl.appendChild(group);
    }
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

const ADMIN_PASSWORD = 'ChorsaCumple29$';

// ── ADMIN PANEL ────────────────────────────────────────────────────────────
function openAdminPanel(root, { go, state }) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,18,0.92);z-index:999;overflow-y:auto;padding:24px 16px 40px';

  // Unlocked stays true for the lifetime of the panel
  let adminUnlocked = false;

  function promptPassword(onSuccess) {
    // Sub-modal encima del panel admin (no lo destruye). Asi los closures
    // de los botones (crear usuario, regenerar, etc.) siguen viendo el DOM vivo.
    const sub = document.createElement('div');
    sub.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px';
    sub.innerHTML = `
      <div class="overlay-card" style="max-width:320px;width:100%;text-align:center;padding:28px">
        <h3 style="margin:0 0 16px">Clave admin</h3>
        <input id="pwd-input" type="password" placeholder="••••••••"
          style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid #444;background:#1a1a24;color:#fff;font-size:16px;box-sizing:border-box;margin-bottom:12px">
        <p id="pwd-err" style="color:#e23b2e;font-size:13px;min-height:18px;margin:0 0 12px"></p>
        <button class="btn" id="pwd-ok" style="width:100%;margin-bottom:10px">Entrar</button>
        <button class="btn ghost" id="pwd-cancel" style="width:100%">Cancelar</button>
      </div>
    `;
    document.body.appendChild(sub);

    const input = sub.querySelector('#pwd-input');
    input.focus();

    const cleanup = () => sub.remove();
    const verify = () => {
      if (input.value === ADMIN_PASSWORD) {
        adminUnlocked = true;
        cleanup();
        onSuccess();
      } else {
        sub.querySelector('#pwd-err').textContent = 'Clave incorrecta';
        input.value = '';
        input.focus();
      }
    };

    sub.querySelector('#pwd-ok').onclick = verify;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') verify(); });
    sub.querySelector('#pwd-cancel').onclick = cleanup;
  }

  function requireAdmin(fn) {
    if (adminUnlocked) { fn(); return; }
    promptPassword(fn);
  }

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
        Demo: ${demo ? '✅ ACTIVO' : '❌ INACTIVO'} ${adminUnlocked ? '' : '🔒'}
      </button>

      <h3 style="margin:0 0 8px;font-size:15px">Desbloquear etapas para rejugar</h3>
      <div id="etapa-unlocks" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px"></div>

      <h3 style="margin:0 0 8px;font-size:15px">Mis puntajes</h3>
      <button class="btn ghost" id="reset-me" style="width:100%;margin-bottom:20px">
        Borrar mis puntajes ${adminUnlocked ? '' : '🔒'}
      </button>

      <h3 style="margin:0 0 8px;font-size:15px">Usuarios sin Google</h3>
      <p style="font-size:12px;color:#888;margin:0 0 10px">Crea cuentas para los que no tienen Google. Se les genera una clave facil.</p>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
        <input id="lu-name" maxlength="40" placeholder="Nombre visible (ej: Maria Lopez)"
          style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid #444;background:#1a1a24;color:#fff;font-size:14px;box-sizing:border-box">
        <input id="lu-user" maxlength="20" placeholder="Usuario (ej: maria) — sin espacios"
          autocapitalize="off" autocomplete="off"
          style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid #444;background:#1a1a24;color:#fff;font-size:14px;box-sizing:border-box">
      </div>
      <button class="btn" id="lu-create" style="width:100%;margin-bottom:8px">
        Crear usuario ${adminUnlocked ? '' : '🔒'}
      </button>
      <div id="lu-result" style="min-height:1px;margin-bottom:14px"></div>
      <div id="lu-list"><div class="spinner"></div></div>

      <h3 style="margin:24px 0 8px;font-size:15px">Jugadores</h3>
      <div id="admin-players"><div class="spinner"></div></div>

      <button class="btn secondary" id="close-admin" style="width:100%;margin-top:24px">Cerrar</button>
    `;

    overlay.appendChild(card);
    root.appendChild(overlay);

    // toggle demo (requiere clave)
    card.querySelector('#toggle-demo').onclick = () => requireAdmin(() => {
      setDemoMode(!demo);
      overlay.remove();
      root.innerHTML = '';
      renderLobby(root, { go, state });
    });

    // etapa unlock buttons (requiere clave)
    const etapaUnlocks = card.querySelector('#etapa-unlocks');
    for (let e = 1; e <= totalEtapas(); e++) {
      if (state.completedEtapas.includes(e)) {
        const btn = document.createElement('button');
        btn.className = 'btn ghost';
        btn.style.cssText = 'padding:6px 14px;font-size:13px';
        btn.textContent = `${adminUnlocked ? '' : '🔒 '}Etapa ${e}`;
        btn.onclick = () => requireAdmin(() => {
          state.completedEtapas = state.completedEtapas.filter((x) => x !== e);
          localStorage.setItem('fc_completed', JSON.stringify(state.completedEtapas));
          rebuild();
        });
        etapaUnlocks.appendChild(btn);
      }
    }
    if (!etapaUnlocks.children.length) {
      etapaUnlocks.innerHTML = '<span style="color:#888;font-size:13px">Ninguna etapa completada aún</span>';
    }

    // reset my scores (requiere clave)
    card.querySelector('#reset-me').onclick = () => requireAdmin(async () => {
      if (!confirm('¿Borrar TUS puntajes? No se puede deshacer.')) { rebuild(); return; }
      const err = await clearMyScores(state.user.id);
      if (err) { alert(`Error al borrar: ${err}\n\nVerificá que exista la RLS policy DELETE en la tabla scores.`); rebuild(); return; }
      state.scores = {};
      state.completedEtapas = [];
      localStorage.setItem('fc_completed', JSON.stringify([]));
      overlay.remove();
      root.innerHTML = '';
      renderLobby(root, { go, state });
    });

    // ── Usuarios sin Google ────────────────────────────────────────────────
    const luNameInput = card.querySelector('#lu-name');
    const luUserInput = card.querySelector('#lu-user');
    const luCreateBtn = card.querySelector('#lu-create');
    const luResult = card.querySelector('#lu-result');
    const luList = card.querySelector('#lu-list');

    function showCreatedCreds({ username, displayName, password }) {
      luResult.innerHTML = `
        <div style="background:#1e3a1e;border:1px solid #3a6f3a;border-radius:10px;padding:12px;font-size:13px">
          <div style="color:#7ed87e;font-weight:700;margin-bottom:6px">✅ Cuenta creada</div>
          <div style="margin-bottom:4px"><b>Nombre:</b> ${escapeHtml(displayName)}</div>
          <div style="margin-bottom:4px"><b>Usuario:</b> <code style="background:#0a0a12;padding:2px 6px;border-radius:4px">${escapeHtml(username)}</code></div>
          <div style="margin-bottom:8px"><b>Clave:</b> <code style="background:#0a0a12;padding:2px 6px;border-radius:4px">${escapeHtml(password)}</code></div>
          <button class="btn ghost" id="lu-copy" style="width:100%;padding:6px 10px;font-size:12px">Copiar usuario + clave</button>
        </div>
      `;
      luResult.querySelector('#lu-copy').onclick = () => {
        const txt = `Usuario: ${username}\nClave: ${password}`;
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(
          () => { luResult.querySelector('#lu-copy').textContent = '✅ Copiado'; },
          () => { alert(txt); }
        );
        else alert(txt);
      };
    }

    luCreateBtn.onclick = () => requireAdmin(async () => {
      const displayName = (luNameInput.value || '').trim();
      const username = (luUserInput.value || '').trim().toLowerCase().replace(/\s+/g, '');
      if (!displayName || !username) {
        luResult.innerHTML = '<div style="color:#e23b2e;font-size:13px">Completa nombre y usuario</div>';
        return;
      }
      if (!/^[a-z0-9_-]+$/.test(username)) {
        luResult.innerHTML = '<div style="color:#e23b2e;font-size:13px">Usuario solo con letras/numeros/guion</div>';
        return;
      }
      luCreateBtn.disabled = true;
      const res = await adminCreateLocalAccount(username, displayName);
      luCreateBtn.disabled = false;
      if (res.error) {
        luResult.innerHTML = `<div style="color:#e23b2e;font-size:13px">Error: ${escapeHtml(res.error)}</div>`;
        return;
      }
      luNameInput.value = '';
      luUserInput.value = '';
      showCreatedCreds(res);
      renderLocalList();
    });

    async function renderLocalList() {
      const accounts = await adminListLocalAccounts();
      if (!accounts.length) {
        luList.innerHTML = '<div style="color:#888;font-size:13px">Aun no creaste cuentas manuales.</div>';
        return;
      }
      luList.innerHTML = '';
      accounts.forEach((a) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;background:#15151e;border-radius:8px;margin-bottom:6px;flex-wrap:wrap';
        row.innerHTML = `
          <div style="flex:1;min-width:140px">
            <div style="font-size:13px;font-weight:600">${escapeHtml(a.displayName)}</div>
            <div style="font-size:11px;color:#888">${escapeHtml(a.username)} · <code style="background:#0a0a12;padding:1px 5px;border-radius:3px">${escapeHtml(a.password)}</code></div>
          </div>
        `;
        const regen = document.createElement('button');
        regen.className = 'btn ghost';
        regen.style.cssText = 'padding:4px 10px;font-size:12px';
        regen.textContent = '↻ Clave';
        regen.onclick = () => requireAdmin(async () => {
          const r = await adminRegenerateLocalPassword(a.id);
          if (r.error) { alert(`Error: ${r.error}`); return; }
          showCreatedCreds({ username: a.username, displayName: a.displayName, password: r.password });
          renderLocalList();
        });
        const del = document.createElement('button');
        del.className = 'btn ghost';
        del.style.cssText = 'padding:4px 10px;font-size:12px;color:#e23b2e;border-color:#e23b2e';
        del.textContent = 'Borrar';
        del.onclick = () => requireAdmin(async () => {
          if (!confirm(`¿Borrar la cuenta de ${a.displayName} y todos sus puntajes?`)) return;
          const err = await adminDeleteLocalAccount(a.id);
          if (err) { alert(`Error: ${err}`); return; }
          renderLocalList();
        });
        row.appendChild(regen);
        row.appendChild(del);
        luList.appendChild(row);
      });
    }

    renderLocalList();

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
        resetBtn.textContent = adminUnlocked ? 'Reset' : '🔒 Reset';
        resetBtn.onclick = () => requireAdmin(async () => {
          if (!confirm(`¿Borrar puntajes de ${r.name}?`)) { rebuild(); return; }
          const err = await adminResetPlayer(r.id);
          if (err) { alert(`Error al resetear: ${err}\n\nAsegurate de haber corrido el SQL de las RPCs en Supabase.`); rebuild(); return; }
          if (r.id === state.user.id) {
            state.scores = {};
            state.completedEtapas = [];
            localStorage.setItem('fc_completed', JSON.stringify([]));
          }
          rebuild();
        });
        row.appendChild(resetBtn);
        pl.appendChild(row);
      });

      const resetAllBtn = document.createElement('button');
      resetAllBtn.className = 'btn ghost';
      resetAllBtn.style.cssText = 'width:100%;margin-top:12px;color:#e23b2e;border-color:#e23b2e';
      resetAllBtn.textContent = adminUnlocked ? 'Borrar TODOS los puntajes' : '🔒 Borrar TODOS los puntajes';
      resetAllBtn.onclick = () => requireAdmin(async () => {
        if (!confirm('¿Borrar los puntajes de TODOS? No hay vuelta atrás.')) { rebuild(); return; }
        const err = await adminResetAll();
        if (err) { alert(`Error al resetear todo: ${err}\n\nAsegurate de haber corrido el SQL de las RPCs en Supabase.`); rebuild(); return; }
        state.scores = {};
        state.completedEtapas = [];
        localStorage.setItem('fc_completed', JSON.stringify([]));
        overlay.remove();
        root.innerHTML = '';
        renderLobby(root, { go, state });
      });
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
