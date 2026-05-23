// Pantalla de login. Si ya hay sesion, salta directo al lobby.
// Online: boton de Google + opcion de usuario manual (creado por admin).
// Offline (demo): input de nombre.

import { signInWithGoogle, signInWithLocal, getUser, OFFLINE } from '../supabase.js';
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
        : `<button class="btn" id="g">Entrar con Google</button>
           <div style="display:flex;align-items:center;gap:10px;margin:22px 0 14px;color:#666;font-size:12px">
             <div style="flex:1;height:1px;background:#333"></div>
             <span>o si no tenes Google</span>
             <div style="flex:1;height:1px;background:#333"></div>
           </div>
           <input id="lu" class="name-input" maxlength="24" placeholder="Usuario" autocomplete="off" autocapitalize="off" />
           <input id="lp" class="name-input" maxlength="24" placeholder="Clave" autocomplete="off" autocapitalize="off" style="margin-top:8px" />
           <button class="btn ghost" id="lg" style="margin-top:10px">Entrar con usuario</button>
           <p id="lerr" style="color:#e23b2e;font-size:13px;min-height:18px;margin:8px 0 0"></p>
           <p class="muted" style="margin-top:14px;font-size:12px">Si no tenes cuenta de Google, pedile a Fede que te genere un usuario.</p>`
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

  // Login con usuario manual (solo online)
  const luBtn = s.querySelector('#lg');
  if (luBtn) {
    const luInput = s.querySelector('#lu');
    const lpInput = s.querySelector('#lp');
    const errEl = s.querySelector('#lerr');

    const tryLogin = async () => {
      const username = (luInput.value || '').trim();
      const password = (lpInput.value || '').trim();
      if (!username || !password) {
        errEl.textContent = 'Completa usuario y clave';
        return;
      }
      errEl.textContent = '';
      luBtn.disabled = true;
      try {
        await signInWithLocal(username, password);
        const u = getUser();
        if (u) {
          state.user = u;
          await refreshScores();
          go('lobby');
        } else {
          errEl.textContent = 'Usuario o clave incorrectos';
          luBtn.disabled = false;
        }
      } catch (e) {
        errEl.textContent = e.message || 'No se pudo entrar';
        luBtn.disabled = false;
      }
    };

    luBtn.onclick = tryLogin;
    [luInput, lpInput].forEach((el) => {
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
    });
  }

  root.appendChild(s);
}
