# Etapa 7 — Ouvidoria

## Fluxos implementados

- A pesquisa pública continua criando um único atendimento somente quando há feedback voluntário válido. Nota baixa sem mensagem não gera reclamação. Mantidos o índice único por avaliação e o conteúdo original imutável.
- Em `/admin/ouvidoria`, Super Admin e ouvidoria consultam os atendimentos abertos e encerrados, com código, data de recebimento, data do atendimento, setor, turno, feedback e telefone mascarado. A listagem usa páginas de 50 registros.
- Em `/admin/ouvidoria/:id`, os mesmos perfis consultam o feedback original, telefone disponível, contatos, providências, autores e datas. O Super Admin somente consulta, conforme a matriz de permissões existente.
- A ouvidoria registra tentativa sem resposta ou atendida. Quando atendida, informa se a pessoa deseja continuar; observações são opcionais. A escolha de não continuar é preservada, e o operador pode concluir o atendimento pelo botão de encerramento.
- A ouvidoria registra descrição das providências e do andamento, sem criar novas etapas ou estados.
- A terceira tentativa **sem resposta no total**, mesmo intercalada com chamadas atendidas, encerra automaticamente como contato sem sucesso. Esta é a interpretação adotada porque o prompt não exige tentativas consecutivas. Chamadas atendidas não incrementam essa contagem.
- Feedback anônimo admite providências e conclusão, sem tentativas de contato.
- O encerramento manual registra conclusão; a interface pede confirmação. Não exige motivo ou outro campo adicional. O encerramento automático registra contato sem sucesso. Ambos mantêm o histórico consultável e impedem novos contatos, ações e reabertura.

## Estados e integridade

Mantidos `status = open / closed` e `closure_reason = resolved / contact_failed`, já existentes. Na interface: “Em aberto”, “Concluído” e “Contato sem sucesso”. Não foi criado novo estado.

O serviço bloqueia a linha do atendimento em cada operação. A numeração das tentativas continua sendo feita pelo banco. A nova migração adiciona um gatilho de encerramento após a inclusão da terceira tentativa sem resposta, na mesma transação; os gatilhos existentes preservam o histórico e impedem alteração ou reabertura. Não modifica retroativamente atendimentos antigos nem cria dados fictícios.

Autenticação, troca obrigatória de senha, permissões e CSRF são verificados no servidor. Respostas do módulo usam `Cache-Control: no-store`. Não existem endpoints para editar ou excluir registros históricos ou reabrir atendimentos.

## Executar

API privada:

| Método e caminho | Acesso | Conteúdo |
|---|---|---|
| `GET /api/admin/ouvidoria?page=1` | Super Admin e ouvidoria | Lista de 50 registros por página, telefone mascarado |
| `GET /api/admin/ouvidoria/:id` | Super Admin e ouvidoria | Atendimento, telefone disponível e histórico |
| `POST /api/admin/ouvidoria/:id/attempts` | Ouvidoria | `outcome` (`answered` ou `no_answer`), `wantsToContinue` somente quando atendida, `notes` opcionais |
| `POST /api/admin/ouvidoria/:id/actions` | Ouvidoria | `description` da providência ou andamento |
| `POST /api/admin/ouvidoria/:id/close` | Ouvidoria | Corpo `{}`, encerra como concluído |

Sem dependências novas. Aplicar a nova migração antes de usar o módulo:

```bash
npm run db:migrate
npm run dev:backend
npm run dev:frontend
```

No PowerShell que bloqueia `npm.ps1`, usar `npm.cmd` nos mesmos comandos.

## Testes

```bash
npm run ouvidoria:test
npm test
npm run build:frontend
```

`backend/test/ombudsman.test.js` cobre validação; consulta e telefone mascarado; bloqueio de anônimo/gestor; Super Admin sem escrita; CSRF; interesse em continuar; autoria e histórico; conclusão manual; terceira tentativa sem resposta total; anonimato; unicidade por avaliação; rejeição de ações, contatos e reabertura após encerramento, incluindo alterações diretas no banco. A suíte da pesquisa pública cobre ausência de atendimento sem feedback voluntário.

Os testes da ouvidoria usam uma transação desfeita ao final e exercitam a nova migração temporariamente se ainda não estiver aplicada. Exigem `DATABASE_URL` e as migrações anteriores. Sequências de códigos podem avançar mesmo com rollback. A execução geral do backend é sequencial para evitar que suítes transacionais disputem os mesmos registros e bloqueios de migração. Não é um teste de concorrência entre conexões reais.

## Interface e limites de verificação

Verificação realizada nesta entrega: 7 testes da ouvidoria e 16 do modelo passaram no PostgreSQL configurado, com rollback; os 37 testes da pesquisa pública passaram na regressão; os 9 testes do frontend e o build de produção passaram. A primeira execução geral expôs conflito do NPS existente na preparação dos testes do modelo; após corrigir a preparação, a suíte do modelo foi executada novamente e passou integralmente. Os testes dedicados de autenticação não foram executados porque `TEST_DATABASE_URL` não estava configurada; a autorização do módulo foi verificada na própria suíte da ouvidoria. Não foi aplicada migração permanente ao banco.

A interface utiliza os tokens e os componentes existentes e segue as imagens do Figma fornecidas posteriormente: estrutura administrativa compartilhada em `components/layout/AdminLayout`, estilos administrativos em `styles/admin.css` e estilos específicos junto da página da ouvidoria. Inclui carregamento, erro, ausência de registros e bloqueio de permissão. A conferência visual no navegador não foi concluída por indisponibilidade da automação; o uso em tablet real permanece pendente de validação. A prévia temporária foi removida do projeto.

## Arquivos da etapa

- `backend/migrations/1792180100000_ouvidoria-tres-tentativas.sql`
- `backend/src/controllers/ombudsman.controller.js`
- `backend/src/repositories/ombudsman.repository.js`
- `backend/src/services/ombudsman.service.js`
- `backend/src/validators/ombudsman.validator.js`
- `backend/src/routes/admin.routes.js`
- `backend/test/ombudsman.test.js`
- `backend/test/schema.test.js` (isolamento do NPS já cadastrado na preparação dos testes)
- `backend/package.json` e `package.json`
- `frontend/src/pages/admin/OmbudsmanPage.jsx` e `ombudsman.css`
- `frontend/src/pages/admin/DashboardPage.jsx`
- `frontend/src/pages/admin/dashboard.css`
- `frontend/src/components/layout/AdminLayout.jsx` e `AdminLayout.css`
- `frontend/src/styles/admin.css` e `tokens.css`
- `frontend/src/routes/AppRoutes.jsx`
- `docs/ouvidoria.md`
- `README.md`
