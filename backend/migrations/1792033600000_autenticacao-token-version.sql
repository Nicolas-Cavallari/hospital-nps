-- Up Migration
-- Autenticação: permite invalidar as sessões de um usuário quando a senha é trocada ou redefinida,
-- ou quando a conta é desativada. Cada sessão carrega a versão do usuário; ao mudar, as antigas caem.
-- Apenas adiciona uma coluna (com valor padrão); não altera nem apaga dados.

alter table public.users add column token_version integer not null default 0;

comment on column public.users.token_version is 'Incrementada ao trocar/redefinir a senha ou desativar a conta; sessões emitidas antes deixam de valer.';

-- Down Migration
-- ATENÇÃO: uso apenas em desenvolvimento.
alter table public.users drop column token_version;
