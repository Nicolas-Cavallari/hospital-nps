-- Up Migration
-- Estrutura organizacional: setores, turnos, equipes e usuários internos.

-- ---------------------------------------------------------------- setores
create table public.sectors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint sectors_name_not_blank check (char_length(btrim(name)) between 1 and 100),
  constraint sectors_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60)
);
create unique index sectors_slug_key on public.sectors (slug);
create unique index sectors_name_key on public.sectors (lower(name));
create trigger sectors_set_updated_at before update on public.sectors
  for each row execute function public.set_updated_at();

comment on table public.sectors is 'Setores avaliados (ex.: recepção, triagem). O slug compõe a URL pública da pesquisa (/pesquisa/:slug).';
comment on column public.sectors.is_active is 'Setor inativo deixa de aceitar respostas; o histórico é preservado e o setor pode ser reativado.';

-- ----------------------------------------------------------------- turnos
create table public.shifts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  start_time  time not null,
  end_time    time not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint shifts_name_not_blank check (char_length(btrim(name)) between 1 and 50),
  constraint shifts_interval_valid check (start_time <> end_time)
);
create unique index shifts_name_key on public.shifts (lower(name));
create trigger shifts_set_updated_at before update on public.shifts
  for each row execute function public.set_updated_at();

comment on table public.shifts is 'Turnos cadastrados pelo Super Admin, com horário. É a lista exibida ao respondente.';
comment on column public.shifts.end_time is 'Se for menor que o início, o turno atravessa a meia-noite (ex.: 19:00 a 07:00).';

-- ---------------------------------------------------------------- equipes
create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  sector_id   uuid not null references public.sectors (id) on delete restrict,
  shift_id    uuid not null references public.shifts (id) on delete restrict,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint teams_name_not_blank check (char_length(btrim(name)) between 1 and 100),
  constraint teams_name_per_sector_shift_key unique (sector_id, shift_id, name),
  -- Permite que a avaliação garanta que a equipe pertence ao mesmo setor (chave composta).
  constraint teams_id_sector_key unique (id, sector_id)
);
create index teams_shift_id_idx on public.teams (shift_id);
create trigger teams_set_updated_at before update on public.teams
  for each row execute function public.set_updated_at();

comment on table public.teams is 'Equipes (ex.: Equipe A e Equipe B) de um setor, associadas a um turno.';

-- --------------------------------------------------------------- usuários
create table public.users (
  id                    uuid primary key default gen_random_uuid(),
  username              text not null,
  full_name             text not null,
  role                  text not null,
  sector_id             uuid references public.sectors (id) on delete restrict,
  password_hash         text not null,
  must_change_password  boolean not null default true,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint users_username_format check (username ~ '^[a-z0-9._-]{3,50}$'),
  constraint users_full_name_not_blank check (char_length(btrim(full_name)) between 1 and 150),
  constraint users_role_valid check (role in ('super_admin', 'gestor', 'ouvidoria')),
  -- Gestor tem setor; os demais perfis não.
  constraint users_gestor_sector check ((role = 'gestor') = (sector_id is not null)),
  -- Garante que só um hash (argon2 ou bcrypt) é aceito: senha em texto puro é recusada pelo banco.
  constraint users_password_is_hash check (password_hash ~ '^\$(argon2(id|i|d)|2[aby])\$')
);
create unique index users_username_key on public.users (username);
create index users_sector_id_idx on public.users (sector_id) where sector_id is not null;
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

comment on table public.users is 'Usuários internos (Super Admin, gestor, ouvidoria). O respondente público não tem conta.';
comment on column public.users.username is 'Login em minúsculas (sem e-mail).';
comment on column public.users.password_hash is 'Somente o hash da senha (argon2 ou bcrypt). Nunca a senha.';
comment on column public.users.must_change_password is 'Verdadeiro para senha temporária: força a troca no primeiro login.';

-- Down Migration
-- ATENÇÃO: uso apenas em desenvolvimento (apaga as tabelas e seus dados).
drop table public.users;
drop table public.teams;
drop table public.shifts;
drop table public.sectors;
