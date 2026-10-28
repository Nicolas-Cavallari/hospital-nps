-- EXEMPLO DE CONFIGURAÇÃO INICIAL (para experimentar a pesquisa pública)
--
-- Nada aqui é executado automaticamente. Ainda não há telas para cadastrar setores, turnos e
-- perguntas (virão em etapa futura), então, por ora, a configuração é feita por SQL. Copie e rode
-- no SQL Editor do Supabase, DEPOIS de aplicar as migrações (npm run db:migrate).
--
-- ATENÇÃO:
--  * Os textos vêm das telas do Figma; ajuste ao que o hospital definir.
--  * Os HORÁRIOS DOS TURNOS são apenas exemplo: use os reais do hospital.
--  * Rode uma única vez. Só pode existir UMA pergunta de NPS ativa (o banco recusa a segunda).
--  * Depois de a pesquisa ter respostas, não apague perguntas: desative (is_active = false).

do $$
declare
  v_sector uuid;
  v_question uuid;
  v_nps uuid;
begin
  -- Setor: o slug forma o endereço da pesquisa (/pesquisa/recepcao).
  insert into public.sectors (name, slug) values ('Recepção', 'recepcao') returning id into v_sector;

  -- Turnos do hospital (lista exibida ao respondente). Fim menor que o início = passa da meia-noite.
  insert into public.shifts (name, start_time, end_time) values
    ('Manhã', '07:00', '13:00'),
    ('Tarde', '13:00', '19:00'),
    ('Noite', '19:00', '07:00');

  -- Pergunta do setor, opcional (is_required = false), escala de 1 a 5 com rótulos nas pontas.
  insert into public.questions (sector_id, text, is_required, position)
  values (v_sector, 'Como você avalia o atendimento na recepção?', false, 1)
  returning id into v_question;
  insert into public.question_options (question_id, value, label) values
    (v_question, 1, 'Muito ruim'),
    (v_question, 2, null),
    (v_question, 3, null),
    (v_question, 4, null),
    (v_question, 5, 'Excelente');

  -- Pergunta final de NPS (única, vale para todos os setores), sempre obrigatória, de 0 a 10.
  insert into public.questions (is_nps, text, description, is_required)
  values (true, 'De 0 a 10, o quanto você recomendaria nosso hospital?',
          '0 significa nada provável; 10, muito provável.', true)
  returning id into v_nps;
  insert into public.question_options (question_id, value)
  select v_nps, n from generate_series(0, 10) as n;
end;
$$;

-- Link do texto legal (política de privacidade) exibido quando a pessoa envia um feedback.
-- Também pode ser definido pelo Super Admin pela API: PUT /api/admin/settings/privacy-policy-url
-- Descomente e troque pelo endereço real:
-- update public.app_settings set privacy_policy_url = 'https://exemplo.org/politica-de-privacidade';

-- Para tornar uma pergunta OBRIGATÓRIA (sem "Pular esta pergunta"):
-- update public.questions set is_required = true where text = 'Como você avalia o atendimento na recepção?';
