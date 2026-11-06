-- Up Migration
-- Corrige ambientes em que a migration inicial foi registrada sem criar a tabela.
create table if not exists public.dashboard_snapshots (
  id smallint primary key default 1 check (id = 1),
  refreshed_at timestamptz not null,
  rows jsonb not null
);

-- Down Migration
drop table if exists public.dashboard_snapshots;
