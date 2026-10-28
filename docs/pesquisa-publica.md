# Pesquisa pública (Etapa 5)

Cada setor tem a sua URL: `/pesquisa/<slug>` (ex.: `/pesquisa/recepcao`). Sem login. A tela lê a configuração do banco e grava as respostas conforme a pessoa avança.

## Fluxo

1. **Início** → **Data, horário e turno** (cria a avaliação no banco, como *incompleta*).
2. **Perguntas do setor**, uma por tela. Tocar na alternativa **salva a resposta** e avança. Perguntas opcionais têm "Pular esta pergunta"; as obrigatórias não.
3. **Pergunta final de NPS (0 a 10)**, única para todos os setores. Ao tocar na nota, ela é salva.
   - **Nota 7 a 10:** a avaliação é concluída na hora, sem campo de feedback.
   - **Nota 0 a 6:** aparece o **comentário opcional**. Sem texto, a pesquisa conclui normalmente. Com texto, vem a tela de **contato**: "Sim, quero receber retorno" (celular e consentimento obrigatórios; link do texto legal) ou "Não, prefiro me manter anônimo" (sem celular e sem consentimento). O consentimento só vale para o feedback.
4. **Confirmação**. Depois de concluída, a avaliação fica travada.

O botão **Voltar** (e o "voltar" do aparelho) leva à tela anterior com a resposta marcada; trocar a resposta **substitui** a anterior no banco (nunca duplica nem apaga).

Fechar a página no meio deixa a avaliação **incompleta**, com as respostas já salvas preservadas. Nada é apagado.

Mais de **5 cliques em 3 segundos** mostram um aviso temporário; não bloqueia nada.

## Validação: tela e servidor

A tela esconde o que não faz sentido (ex.: sem "Pular" nas obrigatórias), mas **o servidor valida tudo de novo**: alternativa válida, pergunta do setor e ativa, obrigatória não pulada, nota 0–6 para feedback, celular e consentimento, anonimato sem celular, data não futura, turno cadastrado. O banco ainda aplica as mesmas regras como última barreira.

## API pública (`/api/public`, sem cookie)

| Rota | O que faz |
|---|---|
| `GET /surveys/:slug` | Perguntas e alternativas ativas do setor, pergunta de NPS, turnos ativos e link legal. `404` se o setor não existe, está desativado ou não há NPS ativo (mesma resposta) |
| `POST /surveys/:slug/evaluations` | Inicia a avaliação (`visitDate` + `visitTime` e/ou `shiftId`). Devolve o `accessToken` **uma única vez** |
| `PUT /evaluations/:id/visit` | Corrige data/horário/turno enquanto em andamento |
| `PUT /evaluations/:id/answers/:questionId` | Salva ou corrige a resposta (`{ "value": 4 }` ou `{ "skipped": true }`) |
| `POST /evaluations/:id/finish` | Conclui. Opcional: `{ "feedback": { "type", "message", "contactRequested", "phone", "consent" } }` |

O respondente alcança **só a própria avaliação**: precisa do id **e** do token (cabeçalho `X-Evaluation-Token`; no banco fica apenas o SHA-256). Qualquer erro de id/token responde `404` igual. Não existe rota para listar ou consultar avaliações, respostas ou resultados, e nada disso abre a área privada. O token fica só na memória da página.

## Turno e equipe

- O **horário** informado define o turno cadastrado (inclusive virando a meia-noite); sem horário, vale o turno escolhido. Se divergirem, vale o horário.
- A **equipe** só é atribuída quando há **uma única** equipe ativa no setor e turno. Com Equipe A e B no mesmo turno, fica em branco, até o Super Admin definir a regra.

## Configuração (ainda por SQL)

Setores, turnos, perguntas, alternativas e a pergunta de NPS ainda não têm tela de cadastro. Para experimentar, use [`exemplo-configuracao-inicial.sql`](exemplo-configuracao-inicial.sql) no SQL Editor do Supabase (ajuste textos e **horários dos turnos**). O **link do texto legal** é definido pelo Super Admin:

```bash
# com o cookie de sessão do Super Admin (ver docs/autenticacao-e-permissoes.md)
curl -b cookies.txt -X PUT http://localhost:3001/api/admin/settings/privacy-policy-url \
  -H 'content-type: application/json' -H 'x-csrf-protection: 1' \
  -d '{"url":"https://exemplo.org/politica-de-privacidade"}'
```

Enquanto não houver link, a tela de contato mostra um aviso ao tocar em "Leia nossa política de privacidade".

## Testes

```bash
npm test             # sem banco (backend e frontend): turnos/equipe, aviso de cliques, senha, permissões
npm run survey:test  # fluxo completo da pesquisa contra o banco configurado (desfeito ao final)
npm run auth:test    # acesso à área privada (precisa de TEST_DATABASE_URL)
```

`survey:test` roda dentro de uma transação **desfeita no fim**: não fica nenhum dado de teste (dentro dela, os turnos e o NPS reais são desativados só para o cenário ser limpo; isso também é desfeito). Efeito colateral: a sequência dos códigos de atendimento (`OUV-…`) pula alguns números a cada execução. Rode com o sistema sem uso.

## Limites conhecidos

- **Sem limite de requisições** nas rotas públicas: qualquer pessoa com o endereço pode iniciar avaliações ou responder em volume. Vale avaliar um limite por IP antes de abrir ao público.
- Atualizar a página no meio da pesquisa **recomeça** (o token só existe na memória) e deixa a anterior incompleta; avaliações incompletas podem, por isso, ser maiores que o número de pessoas.
- Alterar perguntas obrigatórias ou desativar uma pergunta enquanto alguém responde pode causar um aviso de erro para essa pessoa, que então recomeça.
