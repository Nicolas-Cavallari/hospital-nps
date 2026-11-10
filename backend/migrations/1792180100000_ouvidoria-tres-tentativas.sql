-- Up Migration
-- Conta tentativas sem resposta TOTAIS. O bloqueio do atendimento no gatilho anterior
-- serializa inclusões concorrentes. O encerramento pertence à mesma transação da tentativa.
create function public.ombudsman_close_after_three_attempts() returns trigger
language plpgsql as $$
begin
  if new.outcome = 'no_answer' and (
    select count(*) from public.ombudsman_contact_attempts
    where case_id = new.case_id and outcome = 'no_answer'
  ) >= 3 then
    update public.ombudsman_cases
    set status = 'closed', closure_reason = 'contact_failed',
        closed_at = clock_timestamp(), closed_by = new.attempted_by
    where id = new.case_id and status = 'open';
  end if;
  return new;
end;
$$;
create trigger ombudsman_close_after_three_attempts_trg
after insert on public.ombudsman_contact_attempts
for each row execute function public.ombudsman_close_after_three_attempts();

-- Down Migration
drop trigger ombudsman_close_after_three_attempts_trg on public.ombudsman_contact_attempts;
drop function public.ombudsman_close_after_three_attempts();
