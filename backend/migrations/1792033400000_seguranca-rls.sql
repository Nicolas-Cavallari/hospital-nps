-- Up Migration
-- Segurança no Supabase. O Supabase expõe, por padrão, uma API REST sobre o schema "public".
-- Aqui as tabelas ficam fechadas para essa API: RLS ativado e SEM políticas (nega tudo para
-- os papéis "anon" e "authenticated"), e os privilégios desses papéis são retirados.
-- O backend acessa o banco com a conexão do proprietário das tabelas, que não é afetada.
-- Este arquivo não altera dados.

alter table public.sectors                      enable row level security;
alter table public.shifts                       enable row level security;
alter table public.teams                        enable row level security;
alter table public.users                        enable row level security;
alter table public.questions                    enable row level security;
alter table public.question_options             enable row level security;
alter table public.evaluations                  enable row level security;
alter table public.answers                      enable row level security;
alter table public.ombudsman_cases              enable row level security;
alter table public.ombudsman_contact_attempts   enable row level security;
alter table public.ombudsman_case_actions       enable row level security;
-- Tabela de controle das migrações (criada pela própria ferramenta).
alter table public.pgmigrations                 enable row level security;

do $$
declare
  api_roles  text;
  fn         record;
begin
  -- Papéis da API do Supabase (não existem em um PostgreSQL comum).
  select string_agg(quote_ident(rolname), ', ') into api_roles
    from pg_roles where rolname in ('anon', 'authenticated');

  if api_roles is not null then
    execute 'revoke all on all tables in schema public from ' || api_roles;
    execute 'revoke all on all sequences in schema public from ' || api_roles;
    -- Tabelas e sequências criadas no futuro por este usuário também nascem fechadas.
    execute 'alter default privileges in schema public revoke all on tables from ' || api_roles;
    execute 'alter default privileges in schema public revoke all on sequences from ' || api_roles;
    execute 'alter default privileges in schema public revoke all on functions from ' || api_roles;
  end if;

  -- Funções do sistema não devem ser chamáveis pela API (por padrão o PUBLIC pode executar).
  for fn in
    select p.oid::regprocedure as signature
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proowner = (select oid from pg_roles where rolname = current_user)
  loop
    execute format('revoke all on function %s from public%s', fn.signature,
                   case when api_roles is null then '' else ', ' || api_roles end);
  end loop;
end;
$$;

-- Down Migration
-- ATENÇÃO: uso apenas em desenvolvimento. Reabre o acesso padrão às tabelas.
alter table public.pgmigrations                 disable row level security;
alter table public.ombudsman_case_actions       disable row level security;
alter table public.ombudsman_contact_attempts   disable row level security;
alter table public.ombudsman_cases              disable row level security;
alter table public.answers                      disable row level security;
alter table public.evaluations                  disable row level security;
alter table public.question_options             disable row level security;
alter table public.questions                    disable row level security;
alter table public.users                        disable row level security;
alter table public.teams                        disable row level security;
alter table public.shifts                       disable row level security;
alter table public.sectors                      disable row level security;
