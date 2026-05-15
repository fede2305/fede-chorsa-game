// Desbloqueo de etapas por reloj real.
// Cada etapa abre a su hora y queda abierta el resto de la noche.
// Para testear sin esperar: ?hora=23:30 en la URL fuerza la hora.

const UNLOCK_TIMES = {
  1: { h: 21, m: 0 },
  2: { h: 22, m: 30 },
  3: { h: 23, m: 30 },
  4: { h: 0, m: 0 },
  5: { h: 0, m: 45 },
};

// Minutos desde el mediodia (ancla). Asi las horas de la fiesta (21:00 -> 00:45)
// quedan ordenadas y el horario diurno previo a la fiesta cuenta como "antes".
function nightMinutes(h, m) {
  let mins = h * 60 + m - 12 * 60;
  if (mins < 0) mins += 24 * 60;
  return mins;
}

function nowMinutes() {
  const params = new URLSearchParams(location.search);
  const override = params.get('hora');
  if (override && /^\d{1,2}:\d{2}$/.test(override)) {
    const [h, m] = override.split(':').map(Number);
    return nightMinutes(h, m);
  }
  const d = new Date();
  return nightMinutes(d.getHours(), d.getMinutes());
}

export function isEtapaUnlocked(etapa) {
  const t = UNLOCK_TIMES[etapa];
  if (!t) return false;
  return nowMinutes() >= nightMinutes(t.h, t.m);
}

export function unlockLabel(etapa) {
  const t = UNLOCK_TIMES[etapa];
  if (!t) return '';
  return `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`;
}
