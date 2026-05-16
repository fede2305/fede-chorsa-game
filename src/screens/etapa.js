// Pantalla de etapa: corre los minijuegos del lineup en orden.
// - Salta slots ya puntuados (retoma progreso parcial al volver del lobby).
// - Botón ✕ siempre visible: durante juego aborta el intento; en overlay sale al lobby.
// - Muestra anécdota de Chorsa antes de entrar.

import { ETAPA_NAMES } from '../chorsa.js';
import { slotsForEtapa } from '../lineup.js';
import { GAMES } from '../games/registry.js';
import { Stage } from '../engine/canvas.js';
import { submitScore } from '../supabase.js';
import { sfx, startMusic, stopMusic } from '../engine/audio.js';

const ANECDOTES = [
  null, // índice 0 no se usa
  {
    title: 'Antes de arrancar...',
    text: 'Chorsa llegó al asado con las birras calientes. La heladera había estado desenchufada desde el viernes. Lo consideró "no su problema".',
  },
  {
    title: 'Segunda vuelta...',
    text: 'Después de la cuarta cerveza intentó explicar el offside con servilletas. Terminó dibujando un mapa del tesoro. Ganó el debate igual.',
  },
  {
    title: 'Y dale...',
    text: 'Juró conocer un atajo. Llegamos a la fiesta 40 minutos tarde y dos provincias de más. Hasta hoy dice que fue intencional.',
  },
  {
    title: 'Nivel avanzado...',
    text: 'A las 3AM llamó un Uber para ir al kiosco de la esquina. Le explicó al conductor la ruta más eficiente durante 15 minutos. El recorrido fue de 50 metros.',
  },
  {
    title: '🚨 MODO FULL CHORSA 🚨',
    text: 'A las 5AM decidió que el baño era el mejor lugar para hablar de sus sentimientos. Todos lloramos. Nadie recuerda por qué. Bienvenido al nivel final.',
  },
];

export function renderEtapa(root, { go, state, params }) {
  const etapa = params.etapa;
  const slots = slotsForEtapa(etapa);

  // Retomar desde el primer slot sin puntaje
  let idx = slots.findIndex((s) => !(s.slot in state.scores));
  if (idx < 0) idx = slots.length;

  const wrap = document.createElement('div');
  wrap.className = 'game-wrap';
  root.appendChild(wrap);

  // ── BOTÓN SALIR (siempre visible) ────────────────────────────────────────
  const exitBtn = document.createElement('button');
  exitBtn.textContent = '✕';
  exitBtn.style.cssText = [
    'position:fixed', 'top:14px', 'right:14px', 'z-index:300',
    'width:44px', 'height:44px', 'border-radius:50%',
    'background:rgba(0,0,0,0.55)', 'color:#fff',
    'border:2px solid rgba(255,255,255,0.35)',
    'font-size:20px', 'font-weight:900', 'cursor:pointer',
    'display:flex', 'align-items:center', 'justify-content:center',
    'line-height:1', 'padding:0',
  ].join(';');
  document.body.appendChild(exitBtn);

  // currentFinish: set while a game is running, null during overlays
  let currentFinish = null;

  function exitEtapa() {
    stopMusic();
    exitBtn.remove();
    go('lobby', { _skipRefresh: true });
  }

  exitBtn.onclick = () => {
    if (currentFinish) currentFinish(null); // aborta juego en curso → playSlot detecta null
    else exitEtapa();
  };

  // ── OVERLAYS ─────────────────────────────────────────────────────────────
  function waitChoice(innerHtml, buttons) {
    return new Promise((resolve) => {
      wrap.innerHTML = '';
      const o = document.createElement('div');
      o.className = 'overlay';
      const card = document.createElement('div');
      card.className = 'overlay-card';
      card.innerHTML = innerHtml;
      buttons.forEach((b, i) => {
        const btn = document.createElement('button');
        btn.className = 'btn' + (b.cls ? ' ' + b.cls : '');
        btn.textContent = b.label;
        btn.onclick = () => resolve(i);
        card.appendChild(btn);
      });
      o.appendChild(card);
      wrap.appendChild(o);
    });
  }

  // ── ANÉCDOTA ─────────────────────────────────────────────────────────────
  async function showAnecdote() {
    const a = ANECDOTES[etapa];
    if (!a) return;
    await waitChoice(
      `<div class="lvl-tag">Etapa ${etapa} &mdash; ${ETAPA_NAMES[etapa]}</div>
       <div class="big" style="font-size:20px;margin:10px 0 4px">${a.title}</div>
       <p style="font-size:15px;line-height:1.55;color:#ccc;text-align:left;margin:4px 0 12px">${a.text}</p>`,
      [{ label: '¡Dale, entro! →' }]
    );
  }

  // ── CORRER UN JUEGO ───────────────────────────────────────────────────────
  function runOne(slot, meta) {
    wrap.innerHTML = '';
    const stage = new Stage(wrap);
    const game = meta.create(slot.chorsa);

    return new Promise((resolve) => {
      let settled = false;
      const finish = (score) => {
        if (settled) return;
        settled = true;
        currentFinish = null;
        stage.destroy();
        resolve(score); // null = salida forzada
      };
      currentFinish = finish;
      startMusic();
      stage.run(game, slot.chorsa).then((s) => { stopMusic(); finish(s); });
    });
  }

  // ── FLUJO PRINCIPAL ───────────────────────────────────────────────────────
  async function playSlot() {
    if (idx >= slots.length) {
      stopMusic();
      exitBtn.remove();
      if (!state.completedEtapas.includes(etapa)) {
        state.completedEtapas.push(etapa);
        localStorage.setItem('fc_completed', JSON.stringify(state.completedEtapas));
      }
      sfx('levelup');
      go('results', { etapa });
      return;
    }

    const slot = slots[idx];
    const meta = GAMES[slot.game];
    let best = state.scores[slot.slot] || 0;

    await waitChoice(
      `<div class="lvl-tag">${ETAPA_NAMES[etapa]} &middot; minijuego ${idx + 1}/${slots.length}</div>
       <div class="big">${meta.name}</div>
       <p>${meta.tip || ''}</p>
       ${slot.boss ? '<p class="boss-tag">JEFE FINAL &mdash; chorsa al maximo</p>' : ''}
       ${best ? `<p class="muted">Tu mejor: ${best}</p>` : ''}`,
      [{ label: 'Jugar' }]
    );

    await waitChoice(
      `<div class="lvl-tag">${meta.name}</div>
       <div class="big">Intento 1</div>
       <p class="muted">Tranqui: el juego no arranca hasta que toques la pantalla.</p>`,
      [{ label: 'Empezar' }]
    );

    const s1 = await runOne(slot, meta);
    if (s1 === null) { exitEtapa(); return; }
    best = Math.max(best, s1);

    const choice = await waitChoice(
      `<div class="lvl-tag">${meta.name}</div>
       <p>Puntaje del intento</p>
       <div class="score-big">${s1}</div>
       <p class="muted">Tenes un intento mas si queres. Se guarda el mejor.</p>`,
      [{ label: 'Usar otro intento' }, { label: 'Me quedo con esto', cls: 'secondary' }]
    );

    if (choice === 0) {
      await waitChoice(
        `<div class="lvl-tag">${meta.name}</div>
         <div class="big">Intento 2</div>
         <p class="muted">Ultimo intento de este minijuego.</p>`,
        [{ label: 'Empezar' }]
      );
      const s2 = await runOne(slot, meta);
      if (s2 === null) { exitEtapa(); return; }
      best = Math.max(best, s2);
      await waitChoice(
        `<div class="lvl-tag">${meta.name}</div>
         <p>Puntaje del intento</p>
         <div class="score-big">${s2}</div>
         <p class="muted">Mejor de este minijuego: ${best}</p>`,
        [{ label: 'Guardar y seguir' }]
      );
    }

    const saved = await submitScore(state.user, slot.slot, best);
    state.scores[slot.slot] = saved;
    idx++;
    playSlot();
  }

  showAnecdote().then(() => playSlot());
}
