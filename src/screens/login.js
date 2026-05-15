// Pantalla de login. Si ya hay sesion, salta directo al lobby.
// Online: boton de Google. Offline (demo): input de nombre.

import { signInWithGoogle, getUser, OFFLINE } from '../supabase.js';
import { refreshScores } from '../main.js';

export function renderLogin(root, { go, state }) {
  if (state.user) {
    go('lobby');
    return;
  }

  const s = document.createElement('div');
  s.className = 'screen center';
  s.innerHTML = `
    <h1>Entra a jugar</h1>
    <p>Necesitamos tu nombre para el ranking. Tu progreso queda guardado.</p>
    ${
      OFFLINE
        ? `<input id="name" class="name-input" maxlength="24" placeholder="Tu nombre" autocomplete="off" />
           <button class="btn" id="g">Entrar</button>
           <p class="muted" style="margin-top:18px">Supabase no esta configurado todavia: corre en modo demo (los puntajes se guardan solo en este celular).</p>`
        : `<button class="btn" id="g">Entrar con Google</button>`
    }
  `;

  const btn = s.querySelector('#g');
  const nameInput = s.querySelector('#name');

  btn.onclick = async () => {
    btn.disabled = true;
    await signInWithGoogle(nameInput ? nameInput.value : undefined);
    const u = getUser();
    if (u) {
      state.user = u;
      await refreshScores();
      go('lobby');
    } else {
      // online: se fue al redirect de Google; nada mas que hacer.
    }
  };

  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btn.click();
    });
  }

  root.appendChild(s);
}
