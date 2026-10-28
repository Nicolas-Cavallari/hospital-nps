-- Up Migration
-- Configurações gerais do sistema, definidas pelo Super Admin. Por ora, o link do texto legal
-- (política de privacidade) exibido na pesquisa quando a pessoa envia um feedback à ouvidoria.
-- É uma tabela de uma única linha, com colunas tipadas. Cria objetos novos; não altera dados.

create table public.app_settings (
  id                   boolean primary key default true,
  privacy_policy_url   text,
  updated_at           timestamptz not null default now(),
  updated_by           uuid references public.users (id) on delete set null,
  constraint app_settings_singleton check (id),
  constraint app_settings_privacy_url_format
    check (privacy_policy_url is null or (privacy_policy_url ~ '^https?://[^[:space:]]+$' and char_length(privacy_policy_url) <= 2048))
);

create trigger app_settings_set_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();
create trigger app_settings_forbid_delete before delete on public.app_settings
  for each row execute function public.forbid_delete();

-- A linha única nasce vazia (sem link); o Super Admin define o endereço depois.
insert into public.app_settings (id) values (true);

comment on table public.app_settings is 'Configurações gerais (linha única). Alteradas somente pelo Super Admin.';
comment on column public.app_settings.privacy_policy_url is 'Endereço (http/https) do texto legal exibido na pesquisa. Nulo = ainda não disponibilizado.';

-- Mesmo fechamento das demais tabelas para a API pública do Supabase.
alter table public.app_settings enable row level security;

do $$
declare
  api_roles text;
begin
  select string_agg(quote_ident(rolname), ', ') into api_roles
    from pg_roles where rolname in ('anon', 'authenticated');
  if api_roles is not null then
    execute 'revoke all on public.app_settings from ' || api_roles;
  end if;
end;
$$;

-- Down Migration
-- ATENÇÃO: uso apenas em desenvolvimento (apaga a tabela).
drop table public.app_settings;
