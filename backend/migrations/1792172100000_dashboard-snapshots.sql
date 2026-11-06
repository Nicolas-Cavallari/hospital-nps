-- Up Migration
-- Snapshot agregado dos indicadores. O job substitui o conteúdo a cada oito horas.
create table public.dashboard_snapshots (
  id smallint primary key default 1 check (id = 1),
  refreshed_at timestamptz not null,
  rows jsonb not null
);

-- Down Migration
drop table if exists public.dashboard_snapshots;
