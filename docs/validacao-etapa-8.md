# Etapa 8 — revisão e validação

Data: 12/11/2026. Ambiente: Windows/PowerShell, Node 24.14.0, npm 11.9.0.

**O sistema não está totalmente validado.** Há funcionalidades ausentes, uma migração de ouvidoria pendente no banco consultado e verificações de interface/autenticação ainda não executadas.

## Execuções e resultados

| Verificação executada | Resultado |
|---|---|
| `npm.cmd test`, com acesso de rede ao PostgreSQL configurado | Backend: 83 aprovações, 0 falhas, 0 cancelamentos, 1 teste ignorado pelo runner; a suíte completa de autenticação foi omitida por falta de `TEST_DATABASE_URL`. Frontend: 12 testes aprovados, incluindo os 3 novos testes de conclusão do NPS. |
| `node --test test/final-access.test.js test/dashboard-schedule.test.js`, na pasta backend, após acrescentar esses arquivos | 4 testes aprovados, 0 falhas/omissões; banco simulado no teste de dashboard. |
| `npm.cmd run build:frontend`, após a correção | Aprovado: Vite compilou 1.997 módulos. |
| API Express iniciada pelos testes, com requisições HTTP reais em porta temporária | Health 200; recurso inexistente 404; pesquisa e ouvidoria exercitadas com banco. Não equivale a validar a implantação em produção. |
| Consulta somente de leitura ao catálogo do banco | Tabela `dashboard_snapshots` presente; gatilho `ombudsman_close_after_three_attempts_trg` ausente. |
| `git diff --check` | Sem erros de whitespace. |
| Inspeção de arquivos versionados para chaves privadas, credenciais PostgreSQL, tokens GitHub e chaves AWS com padrões conhecidos | Única ocorrência: URL fictícia comentada em `backend/.env.example`, com `[SENHA]`. Nenhum segredo real identificado por esses padrões; não é auditoria completa nem varredura do histórico Git. |

Os números das duas execuções de backend são separados: a execução completa ocorreu antes da criação dos dois novos arquivos de teste de backend. Ambos foram executados depois, isoladamente. Não houve uma segunda execução integral após adicioná-los.

A primeira tentativa com `npm` foi impedida pela política de execução de `npm.ps1`; usou-se `npm.cmd`, sem mudar a política do Windows. A primeira suíte no sandbox não conectou ao banco (`EACCES`): 59 testes ficaram cancelados na preparação. A repetição com acesso à rede concluiu sem falhas. Esses cancelamentos iniciais não foram tratados como defeitos funcionais.

## Requisitos revisados

| Nº | Requisito | Evidência e limite |
|---|---|---|
| 1 | Execução e compilação | Build aprovado; API iniciada nos testes HTTP. Os processos de desenvolvimento e a implantação final não foram validados em navegador. |
| 2 | Login e permissões por perfil | Passaram testes de senha, JWT, cookies, matriz de permissões e acesso HTTP da ouvidoria com os três perfis. A pesquisa testa login de admin/gestor para configurações. A suíte dedicada `auth.test.js` não rodou; login da ouvidoria, troca obrigatória e revogação completa de sessões continuam pendentes nessa suíte. |
| 3 | Acesso público limitado | Passaram testes contra listagem pública de avaliações, respostas, resultados, usuários e ouvidoria, além do isolamento por token de avaliação. Existem exceções públicas atuais: `/`, `/login`, `/api/auth/login`, logout e health. Confirmar se a restrição pretendida permite esses caminhos operacionais; não foram removidos nem renomeados. |
| 4 | Rotas privadas sem autenticação | Novo teste HTTP percorre 15 combinações de método/rota, sem cookie e com cookie adulterado, exigindo 401. CSRF é enviado para garantir que o bloqueio observado seja de autenticação. |
| 5 | Gestor limitado ao setor | Teste de rejeição de outro setor e novo teste de filtragem de linhas, tendências, setores, turnos e equipes aprovados. A filtragem positiva usa banco simulado; o acesso do gestor à ouvidoria foi negado com banco real. |
| 6 | Cadastro, edição e desativação de perguntas | **Não atendido pela aplicação:** não há rotas administrativas, serviço de gestão nem telas de perguntas. O modelo SQL existe, mas não substitui esse fluxo. Implementar o módulo exige trabalho funcional adicional; não foi acrescentado nesta revisão. |
| 7 | Histórico de perguntas desativadas | Teste real de esquema aprovado: pergunta respondida não pode ser apagada e sua desativação preserva respostas. |
| 8 | Salvamento progressivo | Testes reais aprovados: gravação individual e correção por substituição, com uma linha por pergunta. |
| 9 | Avaliações interrompidas | Testes reais aprovados: respostas persistem, avaliação fica incompleta e feedback não enviado não gera atendimento. Reabertura da aba não retoma a sessão: o token fica em memória, conforme implementação atual. |
| 10 | Obrigatórias e possibilidade de pular | Testes reais aprovados para perguntas opcionais, obrigatórias e NPS; conclusão sem resposta obrigatória é recusada. |
| 11 | Cálculo NPS | Testes unitários aprovados para faixas 0–6/7–8/9–10, fórmula, extremos e ausência de respostas válidas. Banco sincroniza nota com resposta. Agregações visuais do dashboard foram inspecionadas, sem teste de renderização. |
| 12 | Feedback condicional | Backend recusa feedback em notas 7–10 e aceita em 0–6. Novo teste de continuação cobre todas as notas e erros; renderização efetiva dos campos em navegador ainda não foi testada. |
| 13 | Envio opcional à ouvidoria | Testes reais aprovados: concluir sem mensagem, mensagem anônima, retorno com celular/consentimento e transação sem gravação parcial em caso de erro. O envio é criação de atendimento no banco; não foi testado envio externo por e-mail. |
| 14 | Tentativas e encerramento na terceira sem resposta | Testes aprovados **com migração aplicada temporariamente na transação da suíte**. Banco atual não possui o gatilho: requisito pendente na configuração persistente. A regra implementada conta três tentativas sem resposta totais, mesmo com contato atendido entre elas. |
| 15 | Proibição de reabrir encerrados | Testes reais de serviço/API e esquema aprovados: encerrados não aceitam alterações, novas tentativas nem reabertura. |
| 16 | Dashboards a cada oito horas | Novo teste com banco e temporizador simulados confirma atualização inicial, intervalo exato de oito horas, ausência de job duplicado e parada. Não se aguardaram oito horas reais nem se executou refresh de snapshot real. A página aberta só busca dados ao montar ou mudar filtros; não possui polling automático. Confirmar se a exigência inclui atualizar uma tela mantida aberta. |
| 17 | Responsividade | CSS possui breakpoints e tratamento de overflow. **Apenas inspeção de código**: não foram executados testes visuais em celular/tablet, rotação ou toque. |
| 18 | URLs preservadas | Nenhuma definição de rota foi modificada. Rotas existentes mantidas; deep links e fallback do servidor de hospedagem não foram testados. |
| 19 | Senhas, tokens e segredos | Passaram testes de Argon2, hash do token de avaliação, cookies e ausência de dados internos na pesquisa. `.env` real não é versionado; modelos têm campos vazios. Mapeadores de usuários não retornam hash/versão de sessão. Certificado do banco não é verificado no ambiente atual porque falta `DB_SSL_CA_PATH`. Segurança de deploy, logs, histórico Git e dependências não foi auditada integralmente. |
| 20 | Integridade dos dados | Testes reais de constraints, imutabilidade e histórico aprovados. Pesquisa, esquema e ouvidoria usam transações externas com rollback; nenhuma migração persistente foi aplicada nesta revisão. Não houve comparação de backup ou auditoria de todos os registros existentes. |

## Problema corrigido

Após salvar NPS 7–10, a interface conserva a nota mesmo se o pedido de finalização falhar. Antes, o botão “Continuar” avançava diretamente para agradecimento e marcava o fluxo local como finalizado, embora a avaliação pudesse continuar incompleta no banco.

Agora “Continuar” repete a finalização no servidor para notas 7–10. Somente a resposta bem-sucedida abre o agradecimento; falhas seguem pelo tratamento existente. Notas 0–6 continuam para o feedback opcional. Foram acrescentados três testes de regressão de lógica para falha, repetição, limites e nota ausente. Não houve mudança de esquema nem de URLs.

Se a finalização tiver sido efetivada e apenas a resposta de rede se perder, o servidor ainda responde 409 à repetição. Isso evita a confirmação falsa, mas a recuperação amigável desse caso permanece pendente; não há endpoint público de consulta de conclusão.

## Testes reprovados e problemas pendentes

Nenhum teste automatizado concluído apresentou falha funcional. Isso não elimina os seguintes achados:

- Gestão administrativa de perguntas ausente (requisito 6).
- Gatilho de encerramento após três tentativas ausente no banco consultado (requisito 14). A migração existente é `1792180100000_ouvidoria-tres-tentativas.sql`. Sua instalação na suíte é temporária e não comprova a instalação na aplicação em uso.
- Suíte completa de autenticação pendente por ausência de `TEST_DATABASE_URL`.
- Validação visual e interativa, inclusive responsividade, pendente.
- Atualização de dashboard com a página aberta, sem interação, ausente; confirmar o alcance do requisito 16.
- Recuperação após conclusão persistida com resposta perdida ainda retorna conflito à repetição.
- Verificação TLS do servidor PostgreSQL não configurada neste ambiente.

Não foi aplicado `migrate:up` ao banco real: altera permanentemente o esquema e pode aplicar outras migrações pendentes. Primeiro é necessário confirmar o banco de destino e revisar o estado das migrações. A suíte de autenticação cria e remove registros com prefixos próprios e deve usar banco de teste separado.

## Arquivos modificados ou criados nesta revisão

- `frontend/src/pages/public/SurveyPage.jsx`: correção do botão Continuar do NPS.
- `frontend/src/pages/public/survey/continueNps.js`: decisão de continuação com confirmação do servidor.
- `frontend/src/pages/public/survey/continueNps.test.js`: três testes de regressão.
- `backend/test/final-access.test.js`: bloqueio HTTP e ausência de consultas públicas.
- `backend/test/dashboard-schedule.test.js`: periodicidade e isolamento dos dados/opções do gestor.
- `docs/validacao-etapa-8.md`: este relatório.

Os artefatos de build em `frontend/dist` foram regenerados e são ignorados pelo Git. Nenhuma alteração persistente de dados ou arquivo de migração integra a revisão.

## Como executar e validar

No PowerShell, usar `npm.cmd` evita a restrição a scripts `.ps1`:

```powershell
# Instalação, quando as dependências ainda não estiverem disponíveis
npm.cmd run install:all

# Configurar backend/.env com DATABASE_URL, JWT_SECRET e SSL
# Somente no banco de destino confirmado e após revisar migrações pendentes:
npm.cmd run db:migrate
npm.cmd run db:check

# Terminal 1
npm.cmd run dev:backend
# Terminal 2
npm.cmd run dev:frontend

# Compilação e suíte completa
npm.cmd run build:frontend
npm.cmd test

# Novos testes de backend sem acesso ao banco real
node --test backend/test/final-access.test.js backend/test/dashboard-schedule.test.js
```

Os testes de integração exigem banco acessível e migrações compatíveis. Sem configuração, algumas suítes são omitidas; verificar os totais e os motivos no resultado, além do código de saída.

Para autenticação, configurar `TEST_DATABASE_URL` no ambiente do processo com um banco de teste separado e migrado, sem publicar a URL, e executar `npm.cmd run auth:test`. Os testes modificam registros de teste; não apontar essa variável para produção.

No navegador, abrir `/login` e testar os três perfis, senha temporária, logout, desativação e troca de setor com sessão já aberta. Abrir `/pesquisa/<slug-existente>` e testar notas 0, 6, 7 e 10; perguntas obrigatórias/opcionais; feedback anônimo/com retorno; interrupção e falha de rede na finalização. Confirmar o estado no banco, não apenas a tela de agradecimento.

Testes visuais recomendados, **não executados**: 390×844, 800×1280 e 1280×800; rotação, teclado virtual, tabelas, navegação Voltar, foco e toque. Validar deep links `/pesquisa/:slug`, `/admin`, `/admin/ouvidoria/:id` e `/trocar-senha` no servidor final.

Depois de instalar a migração de ouvidoria no destino correto, confirmar a existência do gatilho fora da transação dos testes e testar um atendimento de homologação. Verificar também atendimentos já abertos com três ou mais tentativas sem resposta: a migração cria um gatilho para novas inclusões, sem corrigir retroativamente esses registros.

## Confirmações ainda necessárias

1. Banco de destino para aplicar as migrações pendentes e eventual tratamento de atendimentos antigos com três tentativas sem resposta.
2. Escopo/entrega da interface e API de gestão de perguntas.
3. Se as oito horas dizem respeito ao snapshot, à tela aberta ou a ambos; disponibilidade contínua do processo backend em produção.
4. Se os caminhos públicos operacionais existentes podem permanecer acessíveis.
5. Aprovação funcional da regra de três tentativas totais sem resposta e do feedback apenas para notas 0–6.
6. Execução da suíte completa de autenticação e homologação visual dos perfis/dispositivos.
