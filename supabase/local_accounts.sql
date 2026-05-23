-- Cuentas manuales para jugadores sin Google.
-- Pegar todo en el SQL Editor de Supabase y correr una vez.
--
-- El "secret" debe coincidir con ADMIN_PASSWORD en src/screens/lobby.js.
-- Si lo cambias aca, cambialo tambien alla.

create table if not exists public.local_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.local_accounts enable row level security;
-- Sin policies: nadie puede leer/escribir desde el cliente.
-- Todo va por las RPCs SECURITY DEFINER de abajo.

-- ── ADMIN: crear cuenta local ─────────────────────────────────────────────
create or replace function public.local_account_create(
  p_username text,
  p_display_name text,
  p_password text,
  p_secret text
) returns table(id uuid, username text, display_name text, password text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret <> 'ChorsaCumple29$' then
    raise exception 'invalid secret';
  end if;
  if length(trim(coalesce(p_username, ''))) = 0 then
    raise exception 'username required';
  end if;
  if length(trim(coalesce(p_display_name, ''))) = 0 then
    raise exception 'display_name required';
  end if;
  if length(coalesce(p_password, '')) = 0 then
    raise exception 'password required';
  end if;
  return query
    insert into public.local_accounts (username, display_name, password)
    values (lower(trim(p_username)), trim(p_display_name), p_password)
    returning local_accounts.id, local_accounts.username, local_accounts.display_name, local_accounts.password;
end;
$$;

-- ── LOGIN: validar credencial y devolver perfil ───────────────────────────
create or replace function public.local_account_login(
  p_username text,
  p_password text
) returns table(id uuid, username text, display_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select la.id, la.username, la.display_name
    from public.local_accounts la
    where la.username = lower(trim(coalesce(p_username, '')))
      and la.password = p_password
    limit 1;
end;
$$;

-- ── ADMIN: listar cuentas locales ─────────────────────────────────────────
create or replace function public.local_account_list(p_secret text)
returns table(id uuid, username text, display_name text, password text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret <> 'ChorsaCumple29$' then
    raise exception 'invalid secret';
  end if;
  return query
    select la.id, la.username, la.display_name, la.password, la.created_at
    from public.local_accounts la
    order by la.created_at asc;
end;
$$;

-- ── ADMIN: regenerar contrasena ───────────────────────────────────────────
create or replace function public.local_account_regenerate_password(
  p_user_id uuid,
  p_password text,
  p_secret text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret <> 'ChorsaCumple29$' then
    raise exception 'invalid secret';
  end if;
  update public.local_accounts set password = p_password where id = p_user_id;
end;
$$;

-- ── ADMIN: borrar cuenta local (y sus puntajes) ───────────────────────────
create or replace function public.local_account_delete(
  p_user_id uuid,
  p_secret text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret <> 'ChorsaCumple29$' then
    raise exception 'invalid secret';
  end if;
  delete from public.scores where user_id = p_user_id;
  delete from public.local_accounts where id = p_user_id;
end;
$$;

-- ── LOCAL USER: guardar puntaje (verifica password) ───────────────────────
create or replace function public.local_submit_score(
  p_user_id uuid,
  p_password text,
  p_display_name text,
  p_slot int,
  p_etapa int,
  p_game text,
  p_score int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing int;
  v_best int;
begin
  if not exists (
    select 1 from public.local_accounts
    where id = p_user_id and password = p_password
  ) then
    raise exception 'invalid credentials';
  end if;

  select best_score into v_existing
  from public.scores
  where user_id = p_user_id and slot = p_slot;

  v_best := greatest(p_score, coalesce(v_existing, 0));

  insert into public.scores (user_id, display_name, slot, etapa, game, best_score, updated_at)
  values (p_user_id, p_display_name, p_slot, p_etapa, p_game, v_best, now())
  on conflict (user_id, slot) do update
    set best_score = excluded.best_score,
        display_name = excluded.display_name,
        updated_at = excluded.updated_at;

  return v_best;
end;
$$;

-- ── LOCAL USER: borrar mis puntajes (verifica password) ───────────────────
create or replace function public.local_clear_scores(
  p_user_id uuid,
  p_password text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.local_accounts
    where id = p_user_id and password = p_password
  ) then
    raise exception 'invalid credentials';
  end if;
  delete from public.scores where user_id = p_user_id;
end;
$$;
