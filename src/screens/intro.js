// Pantalla de intro: cuenta la historia de Fede Corsa -> Chorsa.

export function renderIntro(root, { go }) {
  const s = document.createElement('div');
  s.className = 'screen';
  s.innerHTML = `
    <h1>El juego de <span class="brand">Fede Chorsa</span></h1>
    <p>Antes de competir, la leyenda. Leé las tres tarjetas y arrancá.</p>

    <div class="story-card">
      <div class="lvl">El Corsa rojo</div>
      <p style="margin-bottom:0">
        Fede tenía un Corsa rojo, modelo 2011. El problema era que en su
        grupo había mil Fedes y ningún método para distinguirlos. El auto
        resolvió el problema: desde entonces fue, para todos,
        <b class="brand">Fede Corsa</b>.
      </p>
    </div>

    <div class="story-card">
      <div class="lvl">De Corsa a Chorsa</div>
      <p style="margin-bottom:0">
        Pasaron los años y los autos; el apodo no se movió. Y la leyenda
        creció con un descubrimiento: cuando la noche avanzaba y las birras
        se acumulaban, Fede entraba en <b class="brand">modo Chorsa</b>. El
        mundo se aceleraba, la pantalla temblaba, la realidad se iba de tema.
        Una letra de diferencia. Un universo de diferencia.
      </p>
    </div>

    <div class="story-card">
      <div class="lvl">La noche</div>
      <p style="margin-bottom:0">
        Lo que sigue es la crónica de una de esas noches. <b class="brand">5
        etapas, de las 21:00 al amanecer</b>, 3 pruebas cada una. Cada hora
        que pasa abre una etapa nueva — y sube el modo chorsa: el auto se va
        solo, todo tiembla, todo cuesta más. Son 15 desafíos. El que más
        puntos junta, gana. El resto, igual la pasó bien.
      </p>
    </div>

    <button class="btn" id="go">Arrancar</button>
  `;
  s.querySelector('#go').onclick = () => go('login');
  root.appendChild(s);
}
