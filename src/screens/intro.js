// Pantalla de intro: cuenta la historia de Fede Corsa -> Chorsa.

export function renderIntro(root, { go }) {
  const s = document.createElement('div');
  s.className = 'screen';
  s.innerHTML = `
    <h1>El juego de <span class="brand">Fede Chorsa</span></h1>
    <p>Antes de competir, la historia. Toca para leer y arranca.</p>

    <div class="story-card">
      <div class="lvl">El Corsa rojo</div>
      <p style="margin-bottom:0">
        Fede tenia un Corsa rojo, modelo 2011. Venia de un grupo de autos
        donde habia mil Fedes... asi que para diferenciarlo quedo
        <b class="brand">"Fede Corsa"</b>.
      </p>
    </div>

    <div class="story-card">
      <div class="lvl">De Corsa a Chorsa</div>
      <p style="margin-bottom:0">
        Cambio de auto un par de veces, pero el apodo quedo. Y cuando la
        noche avanzaba y Fede se ponia en pedo, entraba en
        <b class="brand">"modo Chorsa"</b> (con S): todo se aceleraba,
        se mareaba, la realidad se distorsionaba.
      </p>
    </div>

    <div class="story-card">
      <div class="lvl">Tu mision</div>
      <p style="margin-bottom:0">
        5 etapas de la noche, 3 minijuegos cada una. A medida que pasan las
        horas se desbloquean etapas nuevas y el <b class="brand">modo
        chorsa</b> sube: el auto se va solo, tiembla la pantalla, todo se
        pone mas dificil. Sumas puntos en los 15 desafios. El que mas junta,
        gana.
      </p>
    </div>

    <button class="btn" id="go">Arrancar</button>
  `;
  s.querySelector('#go').onclick = () => go('login');
  root.appendChild(s);
}
