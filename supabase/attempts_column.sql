-- Anti-trampa: trackear cuantos intentos uso cada jugador por slot (0..2).
-- Si attempts_used llega a 2, ese slot esta cerrado.
-- Pegar todo en el SQL Editor de Supabase y correr una vez.
--
-- Si ya hay puntajes guardados antes de correr esto, los marcamos como
-- "1 intento usado" para no penalizar a quienes ya jugaron.

alter table public.scores
  add column if not exists attempts_used int not null default 0;

update public.scores
  set attempts_used = 1
  where attempts_used = 0 and best_score is not null;

-- ── Actualizar RPC local_submit_score para incluir attempts ─────────────
-- Drop primero porque la firma cambia (nuevo p_attempts).
drop function if exists public.local_submit_score(uuid, text, text, int, int, text, int);

create or replace function public.local_submit_score(
  p_user_id uuid,
  p_password text,
  p_display_name text,
  p_slot int,
  p_etapa int,
  p_game text,
  p_score int,
  p_attempts int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_score int;
  v_existing_attempts int;
  v_best int;
  v_attempts int;
begin
  if not exists (
    select 1 from public.local_accounts
    where id = p_user_id and password = p_password
  ) then
    raise exception 'invalid credentials';
  end if;

  select best_score, attempts_used into v_existing_score, v_existing_attempts
  from public.scores
  where user_id = p_user_id and slot = p_slot;

  v_best := greatest(p_score, coalesce(v_existing_score, 0));
  v_attempts := greatest(p_attempts, coalesce(v_existing_attempts, 0));

  insert into public.scores (user_id, display_name, slot, etapa, game, best_score, attempts_used, updated_at)
  values (p_user_id, p_display_name, p_slot, p_etapa, p_game, v_best, v_attempts, now())
  on conflict (user_id, slot) do update
    set best_score = excluded.best_score,
        attempts_used = excluded.attempts_used,
        display_name = excluded.display_name,
        updated_at = excluded.updated_at;

  return v_best;
end;
$$;
