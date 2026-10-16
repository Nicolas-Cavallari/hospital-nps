-- Up Migration
-- Ouvidoria: atendimento (feedback), tentativas de contato e histórico de ações.
-- Cada feedback enviado gera um único atendimento com código próprio.

create sequence public.ombudsman_case_code_seq;

create function public.next_ombudsman_case_code() returns text
language sql as $$
  select 'OUV-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-'
         || lpad(nextval('public.ombudsman_case_code_seq')::text, 6, '0');
$$;

-- ------------------------------------------------------------ atendimentos
create table public.ombudsman_cases (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null default public.next_ombudsman_case_code(),
  evaluation_id      uuid not null references public.evaluations (id) on delete restrict,
  feedback_type      text,
  message            text not null,
  contact_requested  boolean not null,
  phone              text,
  consent_given      boolean not null default false,
  consent_at         timestamptz,
  status             text not null default 'open',
  closure_reason     text,
  closed_at          timestamptz,
  closed_by          uuid references public.users (id) on delete restrict,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint ombudsman_cases_feedback_type_valid
    check (feedback_type is null or feedback_type in ('elogio', 'reclamacao', 'sugestao', 'outro')),
  constraint ombudsman_cases_message_len check (char_length(btrim(message)) between 1 and 1000),
  constraint ombudsman_cases_phone_format check (phone is null or phone ~ '^[1-9]{2}9[0-9]{8}$'),
  -- Pediu retorno: celular e consentimento são obrigatórios. Anônimo: nenhum dos dois é guardado.
  constraint ombudsman_cases_contact_consistency check (
    (contact_requested and phone is not null and consent_given and consent_at is not null)
    or (not contact_requested and phone is null and not consent_given and consent_at is null)
  ),
  constraint ombudsman_cases_status_valid check (status in ('open', 'closed')),
  constraint ombudsman_cases_closure_reason_valid
    check (closure_reason is null or closure_reason in ('resolved', 'contact_failed')),
  constraint ombudsman_cases_closure_consistency check (
    (status = 'open' and closure_reason is null and closed_at is null and closed_by is null)
    or (status = 'closed' and closure_reason is not null and closed_at is not null)
  ),
  -- "Contato sem sucesso" só faz sentido quando houve pedido de contato.
  constraint ombudsman_cases_failed_needs_contact check (closure_reason <> 'contact_failed' or contact_requested)
);
create unique index ombudsman_cases_code_key on public.ombudsman_cases (code);
create unique index ombudsman_cases_evaluation_key on public.ombudsman_cases (evaluation_id);
create index ombudsman_cases_status_created_idx on public.ombudsman_cases (status, created_at);

comment on table public.ombudsman_cases is 'Atendimento da ouvidoria, criado a partir de um feedback (nota de NPS de 0 a 6). Encerrado, não pode ser reaberto.';
comment on column public.ombudsman_cases.code is 'Código identificador do atendimento (OUV-AAAA-NNNNNN). Formato adotado por padrão; ajustável.';
comment on column public.ombudsman_cases.phone is 'Somente dígitos (DDD + celular). Exibir apenas a Super Admin e ouvidoria.';
comment on column public.ombudsman_cases.closure_reason is 'resolved = resolvido/concluído; contact_failed = encerrado por contato sem sucesso.';

create function public.ombudsman_cases_guard_insert() returns trigger
language plpgsql as $$
declare
  nps smallint;
begin
  select nps_score into nps from public.evaluations where id = new.evaluation_id;
  if nps is null or nps > 6 then
    raise exception 'Feedback para a ouvidoria só existe para avaliações com nota de NPS de 0 a 6.'
      using errcode = 'integrity_constraint_violation';
  end if;
  return new;
end;
$$;

create function public.ombudsman_cases_guard_update() returns trigger
language plpgsql as $$
begin
  if old.status = 'closed' then
    raise exception 'Atendimento encerrado não pode ser alterado nem reaberto.'
      using errcode = 'integrity_constraint_violation';
  end if;
  -- O conteúdo original do feedback nunca é alterado; só a situação e o encerramento mudam.
  if (new.code, new.evaluation_id, new.feedback_type, new.message, new.contact_requested,
      new.phone, new.consent_given, new.consent_at, new.created_at)
     is distinct from
     (old.code, old.evaluation_id, old.feedback_type, old.message, old.contact_requested,
      old.phone, old.consent_given, old.consent_at, old.created_at) then
    raise exception 'Os dados do feedback original não podem ser alterados.'
      using errcode = 'integrity_constraint_violation';
  end if;
  return new;
end;
$$;

create trigger ombudsman_cases_guard_insert_trg before insert on public.ombudsman_cases
  for each row execute function public.ombudsman_cases_guard_insert();
create trigger ombudsman_cases_guard_update_trg before update on public.ombudsman_cases
  for each row execute function public.ombudsman_cases_guard_update();
create trigger ombudsman_cases_set_updated_at before update on public.ombudsman_cases
  for each row execute function public.set_updated_at();
create trigger ombudsman_cases_forbid_delete before delete on public.ombudsman_cases
  for each row execute function public.forbid_delete();

-- -------------------------------------------------- tentativas de contato
create table public.ombudsman_contact_attempts (
  id                 uuid primary key default gen_random_uuid(),
  case_id            uuid not null references public.ombudsman_cases (id) on delete restrict,
  attempt_number     smallint not null,
  attempted_by       uuid not null references public.users (id) on delete restrict,
  attempted_at       timestamptz not null default now(),
  outcome            text not null,
  wants_to_continue  boolean,
  notes              text,
  constraint ombudsman_attempts_outcome_valid check (outcome in ('no_answer', 'answered')),
  -- O interesse em continuar só é registrado quando a pessoa atendeu.
  constraint ombudsman_attempts_interest_consistency check ((outcome = 'answered') = (wants_to_continue is not null)),
  constraint ombudsman_attempts_notes_len check (notes is null or char_length(notes) <= 2000),
  constraint ombudsman_attempts_number_key unique (case_id, attempt_number)
);

comment on table public.ombudsman_contact_attempts is 'Cada tentativa de contato com a pessoa que enviou o feedback. Histórico somente de inclusão.';
comment on column public.ombudsman_contact_attempts.attempt_number is 'Sequencial por atendimento (1, 2, 3...), preenchido pelo banco.';
comment on column public.ombudsman_contact_attempts.wants_to_continue is 'Interesse da pessoa em continuar o atendimento (quando atendeu).';
comment on column public.ombudsman_contact_attempts.notes is 'Informações sobre o retorno recebido.';

create function public.ombudsman_attempts_guard() returns trigger
language plpgsql as $$
declare
  c_status    text;
  c_contact   boolean;
begin
  -- Trava o atendimento para numerar as tentativas sem corrida entre transações.
  select status, contact_requested into c_status, c_contact
    from public.ombudsman_cases where id = new.case_id for update;

  if c_status is distinct from 'open' then
    raise exception 'Atendimento encerrado: não aceita novas tentativas de contato.'
      using errcode = 'integrity_constraint_violation';
  end if;
  if not c_contact then
    raise exception 'Atendimento anônimo (sem pedido de contato) não tem tentativas de contato.'
      using errcode = 'integrity_constraint_violation';
  end if;

  select coalesce(max(attempt_number), 0) + 1 into new.attempt_number
    from public.ombudsman_contact_attempts where case_id = new.case_id;
  return new;
end;
$$;

create trigger ombudsman_attempts_guard_insert before insert on public.ombudsman_contact_attempts
  for each row execute function public.ombudsman_attempts_guard();
create trigger ombudsman_attempts_append_only before update or delete on public.ombudsman_contact_attempts
  for each row execute function public.forbid_update_delete();

-- ------------------------------------------------- histórico de providências
create table public.ombudsman_case_actions (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references public.ombudsman_cases (id) on delete restrict,
  description  text not null,
  created_by   uuid not null references public.users (id) on delete restrict,
  created_at   timestamptz not null default now(),
  constraint ombudsman_actions_description_len check (char_length(btrim(description)) between 1 and 2000)
);
create index ombudsman_actions_case_idx on public.ombudsman_case_actions (case_id, created_at);

comment on table public.ombudsman_case_actions is 'Providências tomadas e andamento do atendimento. Histórico somente de inclusão.';

create function public.ombudsman_actions_guard() returns trigger
language plpgsql as $$
declare
  c_status text;
begin
  select status into c_status from public.ombudsman_cases where id = new.case_id for share;
  if c_status is distinct from 'open' then
    raise exception 'Atendimento encerrado: não aceita novas ações.'
      using errcode = 'integrity_constraint_violation';
  end if;
  return new;
end;
$$;

create trigger ombudsman_actions_guard_insert before insert on public.ombudsman_case_actions
  for each row execute function public.ombudsman_actions_guard();
create trigger ombudsman_actions_append_only before update or delete on public.ombudsman_case_actions
  for each row execute function public.forbid_update_delete();

-- Down Migration
-- ATENÇÃO: uso apenas em desenvolvimento (apaga as tabelas e seus dados).
drop table public.ombudsman_case_actions;
drop function public.ombudsman_actions_guard();
drop table public.ombudsman_contact_attempts;
drop function public.ombudsman_attempts_guard();
drop table public.ombudsman_cases;
drop function public.ombudsman_cases_guard_update();
drop function public.ombudsman_cases_guard_insert();
drop function public.next_ombudsman_case_code();
drop sequence public.ombudsman_case_code_seq;
