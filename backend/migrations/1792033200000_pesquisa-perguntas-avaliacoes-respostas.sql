-- Up Migration
-- Pesquisa: perguntas, alternativas, avaliações e respostas individuais.

-- -------------------------------------------------------------- perguntas
create table public.questions (
  id           uuid primary key default gen_random_uuid(),
  sector_id    uuid references public.sectors (id) on delete restrict,
  is_nps       boolean not null default false,
  text         text not null,
  description  text,
  is_required  boolean not null default false,
  is_active    boolean not null default true,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint questions_text_not_blank check (char_length(btrim(text)) between 1 and 300),
  constraint questions_description_len check (description is null or char_length(description) <= 300),
  -- Pergunta de NPS é global (sem setor); as demais pertencem a um setor.
  constraint questions_scope check ((is_nps and sector_id is null) or (not is_nps and sector_id is not null)),
  constraint questions_nps_required check (not is_nps or is_required)
);
-- Só pode existir uma pergunta de NPS ativa.
create unique index questions_one_active_nps on public.questions (is_nps) where is_nps and is_active;
create index questions_sector_idx on public.questions (sector_id, is_active, position);
create trigger questions_set_updated_at before update on public.questions
  for each row execute function public.set_updated_at();

comment on table public.questions is 'Perguntas por setor e a pergunta padrão de NPS (is_nps, sem setor). Com respostas vinculadas, desativar em vez de excluir.';
comment on column public.questions.description is 'Texto de apoio exibido sob a pergunta (ex.: explicação da escala do NPS).';

-- ------------------------------------------------------------ alternativas
create table public.question_options (
  question_id  uuid not null references public.questions (id) on delete cascade,
  value        smallint not null,
  label        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (question_id, value),
  constraint question_options_value_range check (value between 0 and 10),
  constraint question_options_label_len check (label is null or char_length(btrim(label)) between 1 and 80)
);
create trigger question_options_set_updated_at before update on public.question_options
  for each row execute function public.set_updated_at();

comment on table public.question_options is 'Alternativas de cada pergunta. Escala 1 a 5 (rótulos opcionais nas pontas) ou 0 a 10 no NPS.';
comment on column public.question_options.value is 'Valor numérico gravado na resposta. Uma alternativa já usada só pode ser desativada, nunca apagada.';

-- Não permite trocar o tipo ou o setor de uma pergunta que já tem respostas.
create function public.questions_guard() returns trigger
language plpgsql as $$
begin
  if (new.is_nps is distinct from old.is_nps or new.sector_id is distinct from old.sector_id)
     and exists (select 1 from public.answers where question_id = old.id) then
    raise exception 'Uma pergunta com respostas não pode mudar de setor nem de tipo (NPS).'
      using errcode = 'integrity_constraint_violation';
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------- avaliações
create table public.evaluations (
  id                 uuid primary key default gen_random_uuid(),
  sector_id          uuid not null references public.sectors (id) on delete restrict,
  visit_date         date not null,
  visit_time         time,
  shift_id           uuid references public.shifts (id) on delete restrict,
  team_id            uuid,
  status             text not null default 'incomplete',
  nps_score          smallint,
  access_token_hash  bytea not null,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  updated_at         timestamptz not null default now(),
  constraint evaluations_status_valid check (status in ('incomplete', 'completed')),
  constraint evaluations_nps_range check (nps_score between 0 and 10),
  -- O atendimento é identificado pelo horário OU pelo turno.
  constraint evaluations_when_visited check (visit_time is not null or shift_id is not null),
  constraint evaluations_completion check ((status = 'completed') = (completed_at is not null)),
  -- Uma avaliação só é finalizada com a nota de NPS respondida.
  constraint evaluations_completed_has_nps check (status <> 'completed' or nps_score is not null),
  constraint evaluations_token_sha256 check (octet_length(access_token_hash) = 32),
  -- A equipe atribuída deve ser do mesmo setor da avaliação.
  constraint evaluations_team_in_sector foreign key (team_id, sector_id)
    references public.teams (id, sector_id) on delete restrict
);
create unique index evaluations_token_key on public.evaluations (access_token_hash);
create index evaluations_sector_status_idx on public.evaluations (sector_id, status);
create index evaluations_sector_completed_idx on public.evaluations (sector_id, completed_at);
create index evaluations_shift_idx on public.evaluations (shift_id) where shift_id is not null;
create index evaluations_team_idx on public.evaluations (team_id) where team_id is not null;
create index evaluations_visit_date_idx on public.evaluations (visit_date);

comment on table public.evaluations is 'Uma avaliação por respondente (anônimo). "incomplete" enquanto em andamento ou abandonada; "completed" quando finalizada (e então imutável).';
comment on column public.evaluations.team_id is 'Equipe atribuída a partir do setor, do turno e dos horários cadastrados. Nulo quando não puder ser determinada sem ambiguidade.';
comment on column public.evaluations.nps_score is 'Cópia da resposta à pergunta de NPS, mantida por gatilho (fonte única: a tabela answers).';
comment on column public.evaluations.access_token_hash is 'SHA-256 do token opaco entregue ao respondente. O token em si nunca é gravado.';

create function public.evaluations_guard() returns trigger
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

create trigger evaluations_guard_update before update on public.evaluations
  for each row execute function public.evaluations_guard();
create trigger evaluations_set_updated_at before update on public.evaluations
  for each row execute function public.set_updated_at();
create trigger evaluations_forbid_delete before delete on public.evaluations
  for each row execute function public.forbid_delete();

-- --------------------------------------------------------------- respostas
-- Uma linha por pergunta de cada avaliação. Corrigir uma resposta substitui a linha
-- (INSERT ... ON CONFLICT (evaluation_id, question_id) DO UPDATE), sem apagar nada.
create table public.answers (
  evaluation_id  uuid not null references public.evaluations (id) on delete restrict,
  question_id    uuid not null references public.questions (id) on delete restrict,
  value          smallint,
  skipped        boolean not null default false,
  answered_at    timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (evaluation_id, question_id),
  constraint answers_value_or_skipped check ((skipped and value is null) or (not skipped and value is not null)),
  -- O valor respondido precisa ser uma alternativa cadastrada da pergunta (não verificada quando pulada).
  constraint answers_valid_option foreign key (question_id, value)
    references public.question_options (question_id, value) on delete restrict
);
create index answers_question_value_idx on public.answers (question_id, value);

comment on table public.answers is 'Respostas individuais, gravadas uma a uma conforme o respondente avança. Nunca são apagadas.';
comment on column public.answers.skipped is 'Pergunta apresentada e pulada (value nulo). Distingue de "nunca chegou nela" (sem linha).';

create function public.answers_guard() returns trigger
language plpgsql as $$
declare
  ev_status    text;
  ev_sector    uuid;
  q_sector     uuid;
  q_nps        boolean;
  q_active     boolean;
  q_required   boolean;
begin
  -- "for share" evita finalizar a avaliação enquanto a resposta está sendo gravada.
  select status, sector_id into ev_status, ev_sector
    from public.evaluations where id = new.evaluation_id for share;

  if ev_status is distinct from 'incomplete' then
    raise exception 'Não é possível alterar respostas de uma avaliação finalizada.'
      using errcode = 'integrity_constraint_violation';
  end if;

  select sector_id, is_nps, is_active, is_required
    into q_sector, q_nps, q_active, q_required
    from public.questions where id = new.question_id;

  if q_active is distinct from true then
    raise exception 'Pergunta inexistente ou desativada: não recebe novas respostas.'
      using errcode = 'integrity_constraint_violation';
  end if;

  if not (q_nps or q_sector is not distinct from ev_sector) then
    raise exception 'A pergunta não pertence ao setor da avaliação.'
      using errcode = 'integrity_constraint_violation';
  end if;

  if new.skipped and (q_required or q_nps) then
    raise exception 'Pergunta obrigatória não pode ser pulada.'
      using errcode = 'integrity_constraint_violation';
  end if;

  return new;
end;
$$;

-- Mantém evaluations.nps_score igual à resposta da pergunta de NPS.
create function public.answers_sync_nps() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from public.questions where id = new.question_id and is_nps) then
    update public.evaluations set nps_score = new.value where id = new.evaluation_id;
  end if;
  return null;
end;
$$;

create trigger answers_guard_write before insert or update on public.answers
  for each row execute function public.answers_guard();
create trigger answers_set_updated_at before update on public.answers
  for each row execute function public.set_updated_at();
create trigger answers_sync_nps_after after insert or update on public.answers
  for each row execute function public.answers_sync_nps();
create trigger answers_forbid_delete before delete on public.answers
  for each row execute function public.forbid_delete();

create trigger questions_guard_update before update on public.questions
  for each row execute function public.questions_guard();

-- Down Migration
-- ATENÇÃO: uso apenas em desenvolvimento (apaga as tabelas e seus dados).
drop table public.answers;
drop function public.answers_sync_nps();
drop function public.answers_guard();
drop table public.evaluations;
drop function public.evaluations_guard();
drop table public.question_options;
drop table public.questions;
drop function public.questions_guard();
