-- Up Migration
-- A regra que define qual equipe atendeu (quando há mais de uma no mesmo setor e turno) será
-- decidida depois pelo Super Admin. Até lá, a equipe fica em branco (team_id nulo). Para permitir
-- preencher a equipe de avaliações JÁ finalizadas quando a regra existir, esta migração abre uma
-- única exceção na trava das avaliações finalizadas: definir a equipe quando ainda não havia.
-- Nenhuma outra coluna pode mudar, e uma equipe já definida não pode ser trocada.
-- Apenas substitui uma função; não altera dados.

create or replace function public.evaluations_guard() returns trigger
language plpgsql as $$
begin
  if old.status = 'completed' then
    if old.team_id is null and new.team_id is not null
       and (new.sector_id, new.visit_date, new.visit_time, new.shift_id, new.status,
            new.nps_score, new.access_token_hash, new.started_at, new.completed_at)
           is not distinct from
           (old.sector_id, old.visit_date, old.visit_time, old.shift_id, old.status,
            old.nps_score, old.access_token_hash, old.started_at, old.completed_at) then
      return new;
    end if;
    raise exception 'Uma avaliação finalizada não pode ser alterada.'
      using errcode = 'integrity_constraint_violation';
  end if;
  if new.sector_id <> old.sector_id then
    raise exception 'O setor de uma avaliação não pode ser alterado.'
      using errcode = 'integrity_constraint_violation';
  end if;
  return new;
end;
$$;

-- Down Migration
-- Restaura a trava total das avaliações finalizadas.
create or replace function public.evaluations_guard() returns trigger
language plpgsql as $$
begin
  if old.status = 'completed' then
    raise exception 'Uma avaliação finalizada não pode ser alterada.'
      using errcode = 'integrity_constraint_violation';
  end if;
  if new.sector_id <> old.sector_id then
    raise exception 'O setor de uma avaliação não pode ser alterado.'
      using errcode = 'integrity_constraint_violation';
  end if;
  return new;
end;
$$;
