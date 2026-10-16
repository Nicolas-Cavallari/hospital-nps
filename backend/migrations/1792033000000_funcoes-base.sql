-- Up Migration
-- Funções reutilizadas pelas demais migrações. Não criam nem alteram dados.

-- Mantém "updated_at" sempre coerente, sem depender da aplicação.
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Impede exclusão: os registros do sistema são preservados (desativa-se em vez de apagar).
create function public.forbid_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'Exclusão não permitida em "%": os registros são preservados (desative em vez de apagar).', tg_table_name
    using errcode = 'integrity_constraint_violation';
end;
$$;

-- Torna uma tabela de histórico somente de inclusão (sem alterar nem apagar).
create function public.forbid_update_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'O histórico em "%" é somente de inclusão: não pode ser alterado nem apagado.', tg_table_name
    using errcode = 'integrity_constraint_violation';
end;
$$;

-- Down Migration
-- ATENÇÃO: uso apenas em desenvolvimento.
drop function public.forbid_update_delete();
drop function public.forbid_delete();
drop function public.set_updated_at();
