// Pantalla de etapa: corre los 3 minijuegos del lineup en orden.
// Cada minijuego tiene un intento obligatorio y un 2do intento OPCIONAL.
// Guarda el mejor puntaje y pasa a resultados.

import { ETAPA_NAMES } from '../chorsa.js';
import { slotsForEtapa } from '../lineup.js';
import { GAMES } from '../games/registry.js';
import { Stage } from '../engine/canvas.js';
import { submitScore } from '../supabase.js';

export function renderEtapa(root, { go, state, params }) {
  const etapa = params.etapa;
  const slots = slotsForEtapa(etapa);
  let idx = 0;

  const wrap = document.createElement('div');
  wrap.className = 'game-wrap';
  root.appendChild(wrap);

  // Muestra un overlay con uno o mas botones; resuelve con el indice tocado.
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

  function runOne(slot, meta) {
    wrap.innerHTML = '';
    const stage = new Stage(wrap);
    const game = meta.create(slot.chorsa);

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

    return new Promise((resolve) => {
      let settled = false;
      const finish = (score) => {
        if (settled) return;
        settled = true;
        exitBtn.remove();
        stage.destroy();
        resolve(score);
      };
      exitBtn.onclick = () => finish(Math.max(0, Math.round(game.score || 0)));
      stage.run(game, slot.chorsa).then(finish);
    });
  }

  async function playSlot() {
    if (idx >= slots.length) {
      if (!state.completedEtapas.includes(etapa)) {
        state.completedEtapas.push(etapa);
        localStorage.setItem('fc_completed', JSON.stringify(state.completedEtapas));
      }
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

    // intento 1 (obligatorio)
    await waitChoice(
      `<div class="lvl-tag">${meta.name}</div>
       <div class="big">Intento 1</div>
       <p class="muted">Tranqui: el juego no arranca hasta que toques la pantalla.</p>`,
      [{ label: 'Empezar' }]
    );
    const s1 = await runOne(slot, meta);
    best = Math.max(best, s1);

    // intento 2 (opcional)
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

  playSlot();
}
