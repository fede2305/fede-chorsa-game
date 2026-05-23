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
    title: 'Arranca la leyenda',
    text: 'Eran las nueve. Chorsa, todavía sobrio — peligroso de otras maneras —, bajó al estacionamiento rumbo al asado. Tres pruebas lo esperaban antes de llegar. No vio venir ninguna.',
  },
  {
    title: 'El asado',
    text: 'Chorsa llegó al asado y, como cada vez, lo pusieron a cargo de las birras. Como cada vez, fue un error: la heladera llevaba desenchufada desde el viernes. Chorsa lo consideró "no su problema" y se sirvió la primera.',
  },
  {
    title: 'El atajo',
    text: 'A esta altura lo de "alegre" había quedado lejos. Chorsa anunció que conocía un atajo. El atajo agregó cuarenta minutos y dos provincias. Hasta hoy jura que fue parte del plan.',
  },
  {
    title: 'Modo Chorsa',
    text: 'Medianoche, modo Chorsa al máximo. Fue la hora en que pidió un Uber para ir al kiosco de la esquina y le explicó la ruta al conductor durante quince minutos. El viaje, de punta a punta, fueron cincuenta metros.',
  },
  {
    title: '🚨 FULL CHORSA 🚨',
    text: 'Cinco de la mañana. Chorsa decidió que el baño era el mejor lugar para hablar de sus sentimientos. Todos lloraron; nadie recuerda por qué. Quedan tres pruebas para cerrar la leyenda: es todo o nada.',
  },
];

// Gancho narrativo por slot (1-15). Índice = número de slot del lineup.
const HOOKS = [
  null, // índice 0 no se usa
  'Mil autos rojos, todos parecidos. Chorsa juró reconocer el suyo de un vistazo, con las llaves de otro auto en la mano.',
  'Corsa encontrado, reloj en contra. El asado ni había empezado y ya llegaba tarde. Chorsa hundió el acelerador.',
  'Sábado a la noche, la avenida es un campo minado. Chorsa esquivó autos, colectivos y la mitad de sus decisiones.',
  'Las birras estaban calientes pero volaban de mano en mano. Chorsa, manos de manteca, se ofreció a que ninguna tocara el piso.',
  'Se acabó la birra. "Voy yo", dijo Chorsa, palabras que nunca terminaron bien. Pero antes del chino, había que cargar nafta.',
  'Volviendo del chino, luces azules en la esquina. Control. Chorsa estaba apenas "alegre": soplar derecho era, técnicamente, posible.',
  'Los reflejos de Chorsa ya venían con retraso. El auto de adelante frenó. Chorsa se enteró bastante después.',
  'En el semáforo, el auto de al lado aceleró en falso. Chorsa lo tomó como un duelo de honor. No lo era. Picó igual.',
  'El famoso atajo. Nadie sabía dónde estaban, Chorsa menos que nadie. Esquivó todo lo que apareció, seguro de que faltaba poco.',
  'Chorsa llegó a algún lado. Había un hueco más o menos del tamaño de un Corsa. "Más o menos" le pareció suficiente.',
  'Otro control, otra vez. Pero ahora el aire le salía en zigzag y "soplar despacio" le sonaba a idioma extranjero.',
  'La fiesta ya se mudó tres veces. Las birras seguían apareciendo, y Chorsa, además, veía algunas que no existían.',
  'Última frenada de la noche. Reflejos: cero. Confianza: intacta. Chorsa apuntó el dedo y se encomendó.',
  'Alguien dijo las palabras malditas: "dale, hacé el 4". Chorsa levantó una pierna y el piso, ofendido, se puso a girar.',
  'Última misión: meter el Corsa en el box y cerrar la leyenda. Despacio y con cuidado, se dijo Chorsa, antes de no hacer ninguna de las dos cosas.',
];

export function renderEtapa(root, { go, state, params }) {
  const etapa = params.etapa;
  const slots = slotsForEtapa(etapa);

  state.attempts = state.attempts || {};

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

  // currentFinish + currentStage: set while a game is running, null durante overlays.
  let currentFinish = null;
  let currentStage = null;

  function exitEtapa() {
    stopMusic();
    exitBtn.remove();
    go('lobby', { _skipRefresh: true });
  }

  // Anti-trampa: si hay juego corriendo, pausa + confirma salida.
  // Si user confirma, el juego termina con score=null (lo cuenta como intento usado).
  exitBtn.onclick = () => {
    if (currentFinish && currentStage) {
      currentStage.pause();
      showPauseConfirm(
        () => { if (currentStage) currentStage.resume(); },
        () => { if (currentFinish) currentFinish(null); }
      );
    } else {
      exitEtapa();
    }
  };

  function showPauseConfirm(onResume, onExit) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:400;display:flex;align-items:center;justify-content:center;padding:24px';
    overlay.innerHTML = `
      <div class="overlay-card" style="max-width:340px;width:100%;text-align:center;padding:28px">
        <h2 style="margin:0 0 12px">Pausado</h2>
        <p style="font-size:15px;color:#d4d4d8;margin:0 0 18px">
          Si salis al lobby, este intento cuenta como usado (queda con 0 puntos).
        </p>
        <button class="btn" id="pause-resume" style="width:100%;margin-bottom:10px">Seguir jugando</button>
        <button class="btn ghost" id="pause-exit" style="width:100%">Salir y perder intento</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#pause-resume').onclick = () => { overlay.remove(); onResume(); };
    overlay.querySelector('#pause-exit').onclick = () => { overlay.remove(); onExit(); };
  }

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
      `<div class="lvl-tag">Etapa ${etapa} de 5 &mdash; ${ETAPA_NAMES[etapa]}</div>
       <div class="etapa-progress">
         ${Array.from({ length: 5 }, (_, i) =>
           `<div class="step-dot ${i + 1 < etapa ? 'done' : i + 1 === etapa ? 'cur' : ''}"></div>`
         ).join('')}
       </div>
       <div class="big" style="font-size:26px;margin:14px 0 8px">${a.title}</div>
       <p style="font-size:17px;line-height:1.6;color:#d4d4d8;text-align:left;margin:8px 0 16px">${a.text}</p>`,
      [{ label: '¡Dale, entro! →' }]
    );
  }

  // ── CORRER UN JUEGO ───────────────────────────────────────────────────────
  // Devuelve score (number) si termino natural, null si fue abortado via ✕.
  function runOne(slot, meta) {
    wrap.innerHTML = '';
    const stage = new Stage(wrap);
    currentStage = stage;
    const game = meta.create(slot.chorsa);

    return new Promise((resolve) => {
      let settled = false;
      const finish = (score) => {
        if (settled) return;
        settled = true;
        currentFinish = null;
        currentStage = null;
        stage.destroy();
        resolve(score);
      };
      currentFinish = finish;
      startMusic();
      stage.run(game, slot.chorsa).then((s) => { stopMusic(); finish(s); });
    });
  }

  async function persistAttempt(slot, best, newAttempts) {
    state.scores[slot.slot] = best;
    state.attempts[slot.slot] = newAttempts;
    const saved = await submitScore(state.user, slot.slot, best, newAttempts);
    if (typeof saved === 'number') state.scores[slot.slot] = saved;
  }

  function checkEtapaDone() {
    const allDone = slots.every((s) => (state.attempts[s.slot] || 0) >= 2);
    if (allDone && !state.completedEtapas.includes(etapa)) {
      state.completedEtapas.push(etapa);
      localStorage.setItem('fc_completed', JSON.stringify(state.completedEtapas));
    }
    return allDone;
  }

  // ── PICKER de minijuegos ─────────────────────────────────────────────────
  function showPicker() {
    wrap.innerHTML = '';
    const o = document.createElement('div');
    o.className = 'overlay';
    const card = document.createElement('div');
    card.className = 'overlay-card';
    card.style.cssText = 'max-width:420px;width:100%;text-align:left;padding:24px';

    const allDoneCount = slots.filter((s) => (state.attempts[s.slot] || 0) >= 2).length;

    card.innerHTML = `
      <div class="lvl-tag" style="text-align:center">Etapa ${etapa} &mdash; ${ETAPA_NAMES[etapa]}</div>
      <h2 style="text-align:center;margin:10px 0 6px;font-size:24px">Elegi minijuego</h2>
      <p class="muted" style="text-align:center;font-size:13px;margin:0 0 16px">${allDoneCount}/${slots.length} terminados</p>
      <div id="slot-list" style="display:flex;flex-direction:column;gap:8px"></div>
      <button class="btn secondary" id="back-lobby" style="width:100%;margin-top:14px">Volver al lobby</button>
    `;
    o.appendChild(card);
    wrap.appendChild(o);

    const slotList = card.querySelector('#slot-list');
    slots.forEach((slot) => {
      const meta = GAMES[slot.game];
      const attempts = state.attempts[slot.slot] || 0;
      const score = state.scores[slot.slot] || 0;
      const done = attempts >= 2;

      const row = document.createElement('button');
      row.className = 'btn' + (done ? ' secondary' : '');
      row.style.cssText = 'width:100%;display:flex;align-items:center;gap:10px;text-align:left;justify-content:flex-start;padding:14px' + (done ? ';opacity:0.55;cursor:default' : '');

      const statusText = done
        ? `✓ Listo &middot; ${score} pts`
        : attempts === 1
        ? `Te queda 1 intento &middot; Mejor: ${score}`
        : '2 intentos disponibles';

      row.innerHTML = `
        <div style="flex:1">
          <div style="font-weight:800;font-size:16px">${meta.name}${slot.boss ? ' 👑' : ''}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.7);font-weight:500">${statusText}</div>
        </div>
      `;

      if (!done) {
        row.onclick = () => playSlot(slot);
      } else {
        row.disabled = true;
      }
      slotList.appendChild(row);
    });

    card.querySelector('#back-lobby').onclick = () => exitEtapa();
  }

  // ── JUGAR UN SLOT ────────────────────────────────────────────────────────
  async function playSlot(slot) {
    const meta = GAMES[slot.game];
    const currentAttempts = state.attempts[slot.slot] || 0;
    let best = state.scores[slot.slot] || 0;

    const bulletsHtml = (meta.tipBullets || [])
      .map((b) => `<li>${b}</li>`)
      .join('');
    const iconHtml = meta.controlIcon
      ? `<div class="control-icon">${meta.controlIcon}</div>`
      : '';

    await waitChoice(
      `<div class="lvl-tag">${ETAPA_NAMES[etapa]}</div>
       <div class="big" style="font-size:30px;margin:6px 0 8px">${meta.name}</div>
       <p style="font-size:16px;color:#d4d4d8;margin:4px 0 12px">${HOOKS[slot.slot] || meta.tip || ''}</p>
       ${bulletsHtml ? `<ul class="tip-bullets">${bulletsHtml}</ul>` : ''}
       ${iconHtml}
       ${slot.boss ? '<p class="boss-tag">JEFE FINAL &mdash; chorsa al máximo</p>' : ''}
       ${best ? `<p class="best-score">Tu mejor: <b>${best}</b></p>` : ''}`,
      [{ label: 'Jugar →' }]
    );

    // Si attempts === 0 → jugar intento 1, despues ofrecer intento 2 o "me quedo".
    // Si attempts === 1 → jugar directo intento 2.
    if (currentAttempts === 0) {
      await waitChoice(
        `<div class="lvl-tag">${meta.name}</div>
         <div class="attempt-badge">INTENTO 1 de 2</div>
         <p class="muted" style="font-size:15px;margin-top:14px">Tranqui: el juego no arranca hasta que toques la pantalla.</p>`,
        [{ label: 'Empezar' }]
      );

      const s1 = await runOne(slot, meta);
      const aborted1 = s1 === null;
      const score1 = aborted1 ? 0 : s1;
      best = Math.max(best, score1);
      await persistAttempt(slot, best, 1);

      if (aborted1) {
        // Usuario confirmo salida. Cuenta intento 1, vuelve al lobby.
        exitEtapa();
        return;
      }

      const choice = await waitChoice(
        `<div class="lvl-tag">${meta.name}</div>
         <p>Puntaje del intento</p>
         <div class="score-big">${score1}</div>
         <p class="muted">Tenes un intento mas si queres. Se guarda el mejor.</p>`,
        [{ label: 'Usar intento 2 ahora' }, { label: 'Me quedo con esto', cls: 'secondary' }]
      );

      if (choice === 1) {
        // "Me quedo con esto": attempts queda en 1, puede volver despues.
        if (checkEtapaDone()) { goToResults(); return; }
        showPicker();
        return;
      }

      // Usa intento 2 ahora.
      await waitChoice(
        `<div class="lvl-tag">${meta.name}</div>
         <div class="attempt-badge">INTENTO 2 de 2</div>
         <p class="muted" style="font-size:15px;margin-top:14px">Último intento de este minijuego.</p>`,
        [{ label: 'Empezar' }]
      );

      const s2 = await runOne(slot, meta);
      const aborted2 = s2 === null;
      const score2 = aborted2 ? 0 : s2;
      best = Math.max(best, score2);
      await persistAttempt(slot, best, 2);

      if (aborted2) { exitEtapa(); return; }

      await waitChoice(
        `<div class="lvl-tag">${meta.name}</div>
         <p>Puntaje del intento</p>
         <div class="score-big">${score2}</div>
         <p class="muted">Mejor de este minijuego: <b>${best}</b></p>`,
        [{ label: 'Guardar y seguir' }]
      );
    } else {
      // currentAttempts === 1: solo intento 2 disponible
      await waitChoice(
        `<div class="lvl-tag">${meta.name}</div>
         <div class="attempt-badge">INTENTO 2 de 2</div>
         <p class="muted" style="font-size:15px;margin-top:14px">Ultimo intento de este minijuego.</p>`,
        [{ label: 'Empezar' }]
      );

      const s2 = await runOne(slot, meta);
      const aborted = s2 === null;
      const score2 = aborted ? 0 : s2;
      best = Math.max(best, score2);
      await persistAttempt(slot, best, 2);

      if (aborted) { exitEtapa(); return; }

      await waitChoice(
        `<div class="lvl-tag">${meta.name}</div>
         <p>Puntaje del intento</p>
         <div class="score-big">${score2}</div>
         <p class="muted">Mejor de este minijuego: <b>${best}</b></p>`,
        [{ label: 'Guardar y seguir' }]
      );
    }

    if (checkEtapaDone()) { goToResults(); return; }
    showPicker();
  }

  function goToResults() {
    stopMusic();
    exitBtn.remove();
    sfx('levelup');
    go('results', { etapa });
  }

  // ── FLUJO PRINCIPAL ───────────────────────────────────────────────────────
  async function main() {
    if (checkEtapaDone()) { goToResults(); return; }
    const anyStarted = slots.some((s) => (state.attempts[s.slot] || 0) > 0);
    if (!anyStarted) await showAnecdote();
    showPicker();
  }

  main();
}

// ── DEMO RUNNER ───────────────────────────────────────────────────────────────
// Corre un slot específico en bucle infinito sin guardar puntaje.
export function renderDemoGame(root, { go, state, params }) {
  const slot = params.slot; // objeto LINEUP: { slot, etapa, chorsa, game }
  const meta = GAMES[slot.game];

  const wrap = document.createElement('div');
  wrap.className = 'game-wrap';
  root.appendChild(wrap);

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

  let currentFinish = null;

  function exitDemo() {
    stopMusic();
    exitBtn.remove();
    go('lobby', { _skipRefresh: true });
  }

  exitBtn.onclick = () => {
    if (currentFinish) currentFinish(null);
    else exitDemo();
  };

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

  function runGame() {
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
        resolve(score);
      };
      currentFinish = finish;
      startMusic();
      stage.run(game, slot.chorsa).then((s) => { stopMusic(); finish(s); });
    });
  }

  async function loop() {
    await waitChoice(
      `<div class="lvl-tag">DEMO &mdash; Chorsa ${slot.chorsa}</div>
       <div class="big">${meta.name}</div>
       <p>${HOOKS[slot.slot] || meta.tip || ''}</p>
       <p class="muted" style="font-size:12px">Los puntajes no se guardan en modo demo.</p>`,
      [{ label: 'Jugar' }, { label: 'Volver', cls: 'secondary' }]
    ).then(async (choice) => {
      if (choice === 1) { exitDemo(); return; }

      const score = await runGame();
      if (score === null) { exitDemo(); return; }

      const again = await waitChoice(
        `<div class="lvl-tag">DEMO &mdash; ${meta.name}</div>
         <p>Puntaje</p>
         <div class="score-big">${score}</div>`,
        [{ label: 'Jugar de nuevo' }, { label: 'Volver al lobby', cls: 'secondary' }]
      );
      if (again === 1) { exitDemo(); return; }
      loop();
    });
  }

  loop();
}
