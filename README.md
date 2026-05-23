# Fede Chorsa - juego del cumple

Web-game competitiva para la fiesta. La gente escanea un QR, entra desde el
celular, juega 15 minijuegos repartidos en 5 etapas de la noche que se
desbloquean por hora real, y compite por el puntaje total.

## Correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:5173. Sin configurar Supabase arranca en **modo demo**:
pide tu nombre y guarda los puntajes solo en ese navegador. Sirve para probar
todos los minijuegos.

### Testear el reloj sin esperar

Las etapas se abren por hora real. Para probar otra hora, agrega `?hora=HH:MM`
en la URL. Ej: `http://localhost:5173/?hora=23:30` abre las etapas 1, 2 y 3.

Horarios de desbloqueo (editar en `src/clock.js` si cambia el cronograma):

| Etapa | Nombre        | Hora  |
|-------|---------------|-------|
| 1     | Corsa         | 21:00 |
| 2     | Corsa alegre  | 22:30 |
| 3     | Corsa en pedo | 23:30 |
| 4     | Chorsa        | 00:00 |
| 5     | Full chorsa   | 00:45 |

## Pasos para que funcione de verdad (con login y ranking compartido)

### 1. Crear el proyecto en Supabase (gratis)

1. Entra a https://supabase.com y crea un proyecto.
2. En **SQL Editor**, corre esto para crear la tabla de puntajes:

   ```sql
   create table public.scores (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null,
     display_name text,
     avatar_url text,
     slot int not null,
     etapa int not null,
     game text not null,
     best_score int not null default 0,
     updated_at timestamptz not null default now(),
     unique (user_id, slot)
   );

   alter table public.scores enable row level security;

   -- cualquiera puede leer el ranking
   create policy "leer ranking" on public.scores
     for select using (true);

   -- cada uno escribe solo sus propios puntajes
   create policy "escribir lo propio" on public.scores
     for insert with check (auth.uid() = user_id);
   create policy "actualizar lo propio" on public.scores
     for update using (auth.uid() = user_id);
   ```

3. En **Project Settings -> API** copia el `Project URL` y la `anon public key`.
4. Crea un archivo `.env` (copia de `.env.example`) y completalo:

   ```
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```

### 1a. Anti-trampa de intentos (recomendado)

Para que el conteo de intentos por minijuego (max 2) sea a prueba de trampas
y se sincronice entre dispositivos, corre el SQL de
[`supabase/attempts_column.sql`](supabase/attempts_column.sql) en el SQL Editor.
Agrega `attempts_used` a la tabla `scores` y actualiza la RPC `local_submit_score`.

Sin esto, los warns en consola dicen "column scores.attempts_used does not exist"
y los intentos no se persisten (cada vuelta al lobby resetea el contador).

### 1b. (Opcional) Cuentas sin Google

Para los que no tengan cuenta de Google, podes generarles un usuario + clave
desde el panel admin. Para habilitarlo, corre el SQL de
[`supabase/local_accounts.sql`](supabase/local_accounts.sql) en el **SQL Editor**
de Supabase (una sola vez). Crea la tabla `local_accounts` y las RPCs que el
panel admin usa para crear, listar, regenerar y borrar cuentas.

Despues, en el juego: 5 toques en tu puntaje total → clave admin → seccion
"Usuarios sin Google" → completa nombre + usuario → boton "Crear". La app te
muestra el usuario y una clave generada (palabra + 2 numeros, facil de dictar).
Se la pasas a la persona y entra desde el login con "Entrar con usuario".

**Heads up sobre seguridad:** las claves se guardan en plaintext en la DB,
asumiendo que es un cumple entre amigos y el riesgo es bajo. Si la base se
filtra, las claves se ven. No reuses claves importantes.

### 2. Activar login con Google

1. En **Google Cloud Console** (https://console.cloud.google.com):
   crea un proyecto, anda a **APIs y servicios -> Credenciales -> Crear
   credenciales -> ID de cliente OAuth**, tipo "Aplicacion web".
2. En "URIs de redireccionamiento autorizados" agrega la URL que te da
   Supabase (esta en Supabase -> Authentication -> Providers -> Google).
3. Copia el `Client ID` y `Client Secret` a Supabase ->
   **Authentication -> Providers -> Google** y activalo.
4. En Supabase -> **Authentication -> URL Configuration**, agrega tu URL de
   produccion (la de Vercel) en "Site URL" y "Redirect URLs".

### 3. Desplegar en Vercel (gratis)

1. Subi este proyecto a un repo de GitHub:

   ```bash
   git init
   git add .
   git commit -m "Juego Fede Chorsa"
   git remote add origin https://github.com/TU-USUARIO/fede-chorsa-game.git
   git push -u origin main
   ```

2. En https://vercel.com importa el repo. Framework: **Vite** (lo detecta solo).
3. En Vercel -> **Settings -> Environment Variables** carga
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Te queda una URL fija, ej. `fede-chorsa.vercel.app`.
5. Volve al paso 2.4 y poni esa URL en Supabase.

### 4. Generar el QR

Apunta el QR a la URL de Vercel. Cualquier generador sirve, o:

```bash
npx qrcode "https://fede-chorsa.vercel.app" -o qr.png
```

Imprimi varios y pegalos por la fiesta. Probalo desde 2-3 celulares distintos
(Android e iPhone) antes del evento.

## Estructura del codigo

```
src/
  main.js          router de pantallas + estado del jugador
  chorsa.js        parametros del modo chorsa por nivel (1-5)
  lineup.js        orden FIJO de los 15 slots (no cambiar durante el evento)
  clock.js         desbloqueo de etapas por hora real
  supabase.js      auth Google + cuentas locales + guardado de puntajes
  screens/         intro, login, lobby, etapa, results
  engine/          canvas.js (loop + input), effects.js (distorsion), sprites.js
  games/           los 9 minijuegos + base.js + registry.js
supabase/
  local_accounts.sql     tabla + RPCs para cuentas manuales (sin Google)
  attempts_column.sql    columna attempts_used + RPC actualizada (anti-trampa)
```

## Flujo de un minijuego

Al entrar a una etapa, primero la anecdota (solo la primera vez) y despues
un **picker** con los 3 minijuegos. Cada slot muestra:

- `2 intentos disponibles` si no jugaste
- `Te queda 1 intento — Mejor: X` si jugaste uno
- `✓ Listo · X pts` si usaste los dos

Eleges el que queres, jugas. Despues de intento 1, podes "Usar intento 2 ahora"
o "Me quedo con esto" (lo deja para despues). Volves al picker hasta que la
etapa entera tenga los dos intentos usados en todos los slots.

### Anti-trampa

Si tocas la ✕ durante un juego, pausa y aparece: "Si salis al lobby, este
intento cuenta como usado (queda con 0 puntos)". No podes evitar gastar un
intento abortando.

## Ajustar dificultad

- **Modo chorsa**: `src/chorsa.js`, tabla `LEVELS`. Subir/bajar `drift`, `shake`,
  `speedMult`, `inputLagMs`, etc.
- **Lineup**: `src/lineup.js`, array `LINEUP`. Cambia que minijuego va en cada
  slot y con que nivel de chorsa. Mantener fijo una vez que arranco la fiesta.
- **Cada minijuego**: archivos en `src/games/`. Duraciones y constantes arriba
  de cada archivo.
