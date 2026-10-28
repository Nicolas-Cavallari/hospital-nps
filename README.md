# Sistema de avaliação e satisfação hospitalar (FHDOD)

Aplicação web para pesquisas de satisfação, cálculo de NPS, indicadores e acompanhamento de manifestações pela ouvidoria.

> **Estado atual: Etapa 5 (pesquisa pública completa).** A pesquisa de cada setor funciona de ponta a ponta: lê a configuração do banco, grava cada resposta ao avançar, mantém avaliações interrompidas como incompletas, aplica o NPS único (0 a 10), o feedback opcional para notas de 0 a 6 com consentimento e o link legal configurado pelo Super Admin. Veja [`docs/pesquisa-publica.md`](docs/pesquisa-publica.md). O login e as permissões da área privada (Etapa 4) estão em [`docs/autenticacao-e-permissoes.md`](docs/autenticacao-e-permissoes.md). Dashboards, atendimento da ouvidoria e telas de cadastro (setores, perguntas, turnos) vêm nas próximas etapas.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Banco de dados | PostgreSQL (Supabase, usado só como PostgreSQL gerenciado) |
| Backend | Node.js 20+ · Express 5 · `pg` · `dotenv` · `node-pg-migrate` |
| Frontend | React 19 · Vite · React Router · `lucide-react` (ícones) · CSS próprio (tokens do Figma) · fonte Inter hospedada localmente |

## Estrutura de pastas

```
hospital-nps/
├── backend/
│   ├── src/
│   │   ├── config/          # variáveis de ambiente e conexão com o banco
│   │   ├── routes/          # definição dos endpoints
│   │   ├── controllers/     # tratamento de requisição/resposta
│   │   ├── services/        # regras de negócio
│   │   ├── repositories/    # acesso ao banco (SQL)
│   │   ├── middlewares/     # autenticação, autorização por permissão, CSRF e tratamento de erros
│   │   ├── validators/      # validação dos dados recebidos (próximas etapas)
│   │   ├── jobs/            # tarefas agendadas, como os dashboards de 8h (próximas etapas)
│   │   ├── scripts/         # utilitários (ex.: db:check)
│   │   ├── app.js           # montagem do Express
│   │   └── server.js        # inicialização do servidor
│   ├── migrations/          # migrações SQL versionadas (modelo de dados)
│   ├── test/                # testes automatizados
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/public/    # pesquisa pública (SurveyPage, screens/, survey/)
│   │   ├── pages/admin/     # login, troca de senha e tela inicial da área privada
│   │   ├── components/
│   │   │   ├── ui/          # Button, TextField, Checkbox, Alert, StrengthMeter
│   │   │   ├── survey/      # escala, NPS, chips, cartão de escolha, estrutura de tela
│   │   │   ├── layout/      # PublicLayout (pesquisa) e PrivateLayout (login)
│   │   │   └── brand/       # logo
│   │   ├── services/        # chamadas à API
│   │   ├── auth/            # estado de login (AuthContext) e guarda de rotas (RequireAuth)
│   │   ├── routes/          # rotas (AppRoutes)
│   │   ├── styles/          # tokens de design e estilos globais
│   │   └── assets/          # logo e imagens
│   └── .env.example
├── docs/                    # documentação (modelo de dados, autenticação e permissões)
├── package.json             # atalhos de comandos (raiz)
└── README.md
```

## Pré-requisitos

- Node.js 20 ou superior (`node -v`)
- Git
- Um projeto no Supabase (para o banco de dados)

## Instalação

Na raiz do projeto:

```bash
npm run install:all
```

## Configuração

1. Crie o arquivo de variáveis do backend a partir do modelo:

   ```bash
   cp backend/.env.example backend/.env
   ```

2. Edite `backend/.env` e preencha `DATABASE_URL` com a string de conexão do seu banco no Supabase. No painel do Supabase, abra o projeto e use a opção de conexão (botão **Connect**) para copiar a string no modo **Session pooler** (ou conexão direta), porta 5432, e substitua a senha. Os nomes no painel podem variar.

3. Mantenha `DB_SSL=true` (o Supabase exige SSL). Opcionalmente, baixe o certificado CA do Supabase e informe o caminho em `DB_SSL_CA_PATH` para que o servidor do banco seja verificado. Sem ele, a conexão é criptografada, mas o servidor não é verificado.

4. Defina o `JWT_SECRET` (mínimo de 32 caracteres) em `backend/.env`; ele assina as sessões de login. Para gerar um valor aleatório:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   Sem ele, o login responde 503. Trocar o valor desconecta todos os usuários.

5. O frontend não precisa de configuração. `frontend/.env.example` só é necessário se o backend rodar em outro endereço.

**Segurança:** o arquivo `.env` está no `.gitignore` e nunca deve ser versionado nem compartilhado. Se a senha do banco vazar, redefina-a no painel do Supabase.

## Execução

Use dois terminais, ambos na raiz do projeto:

```bash
# Terminal 1 — backend (http://localhost:3001)
npm run dev:backend

# Terminal 2 — frontend (http://localhost:5173)
npm run dev:frontend
```

## Como verificar que tudo funciona

1. **Backend:** abra `http://localhost:3001/api/health`. Deve responder `{"status":"ok", ...}`.
2. **Banco de dados:** rode `npm run db:check`. Deve imprimir `Banco de dados: OK`. Também é possível abrir `http://localhost:3001/api/health/db`, que responde `{"status":"ok","database":"ok"}`. Se `DATABASE_URL` não estiver preenchida, responde 503 com `"database":"not_configured"`; se não conseguir conectar, 503 com `"database":"unreachable"`.
3. **Frontend + comunicação:** abra `http://localhost:5173`. A página "Verificação do sistema" mostra o estado da interface, da API e do banco. O frontend acessa a API pelo próprio endereço (`/api/...`), que o Vite repassa ao backend.
4. **Testes automatizados do backend:** `npm test`.

## Pesquisa pública (Etapa 5)

Para experimentar a pesquisa é preciso ter setor, turnos, perguntas e a pergunta de NPS no banco. Como ainda não há telas de cadastro, use o exemplo [`docs/exemplo-configuracao-inicial.sql`](docs/exemplo-configuracao-inicial.sql) no SQL Editor do Supabase (ajuste os horários dos turnos) e abra `http://localhost:5173/pesquisa/recepcao`. O fluxo, a API pública e as regras estão em [`docs/pesquisa-publica.md`](docs/pesquisa-publica.md).

```bash
npm test             # sem banco: regras de turno/equipe, aviso de cliques, senha, permissões
npm run survey:test  # fluxo completo da pesquisa no banco configurado (desfeito ao final)
```

## Login e usuários (Etapa 4)

Depois de configurar o `JWT_SECRET` e aplicar as migrações (`npm run db:migrate`):

```bash
# cria o primeiro Super Admin; a senha temporária aparece uma única vez
npm run user:create -- --username=admin --name="Seu Nome"
```

Entre em `http://localhost:5173/login`; o sistema pede a troca da senha temporária. Os demais usuários são criados pelo Super Admin (API `POST /api/admin/users`) ou pelo mesmo comando, com `--role=gestor --sector=<slug>` ou `--role=ouvidoria`. Setores ainda não têm tela de cadastro: crie pelo SQL Editor do Supabase, por exemplo `insert into sectors (name, slug) values ('Recepção', 'recepcao');`. Detalhes, permissões por perfil e rotas em [`docs/autenticacao-e-permissoes.md`](docs/autenticacao-e-permissoes.md).

**Testes de acesso** (login e permissões, autorizados e não autorizados):

```bash
npm test             # sem banco: senha, permissões, CSRF e sessão
npm run auth:test    # com banco de TESTE: defina TEST_DATABASE_URL antes
```

O `auth:test` cria e remove usuários e setores de teste (prefixo `zz_test_`). Use um banco de teste, de preferência separado do real (outro projeto gratuito no Supabase, por exemplo).

## Telas e responsividade (Etapa 2)

Com o frontend rodando (`npm run dev:frontend`), abra a página `http://localhost:5173` e use os atalhos da seção "Telas da Etapa 2", ou acesse direto:

| Tela | Endereço |
|---|---|
| Pesquisa pública (fluxo completo) | `http://localhost:5173/pesquisa/exemplo` |
| Login | `http://localhost:5173/login` |
| Troca de senha | `http://localhost:5173/trocar-senha` |

`exemplo` não é um setor real: enquanto não há API, a pesquisa usa conteúdo de demonstração (`frontend/src/pages/public/survey/demoSurvey.js`), com os textos das telas do Figma.

**Testar em diferentes larguras:** no Chrome ou Edge, abra as ferramentas do desenvolvedor (F12) e ative a barra de dispositivos (Ctrl+Shift+M). Use "Dimensions: Responsive" e teste, por exemplo:

| Aparelho | Tamanho |
|---|---|
| Celular | 390 × 844 |
| Tablet de 10" em retrato | 800 × 1280 |
| Tablet de 10" em paisagem | 1280 × 800 |

Teste também a rotação, o botão Voltar do navegador e, para a pesquisa, os dois caminhos: nota 0–6 (comentário e contato) e nota 7–10 (vai direto à confirmação).

**Navegação da pesquisa:** tocar em um número responde e avança; "Voltar" volta à tela anterior com a resposta marcada. Os campos de data e hora seguem o idioma do navegador.

## Banco de dados e migrações (Etapa 3)

O modelo de dados está descrito em [`docs/modelo-de-dados.md`](docs/modelo-de-dados.md) (diagrama, tabelas e regras garantidas pelo banco). As migrações ficam em `backend/migrations/` e são aplicadas em ordem:

| Migração | Conteúdo |
|---|---|
| `…_funcoes-base` | Funções auxiliares (atualização de `updated_at`, bloqueio de exclusão/alteração) |
| `…_organizacao-usuarios-setores-turnos-equipes` | `sectors`, `shifts`, `teams`, `users` |
| `…_pesquisa-perguntas-avaliacoes-respostas` | `questions`, `question_options`, `evaluations`, `answers` |
| `…_ouvidoria-atendimentos` | `ombudsman_cases`, `ombudsman_contact_attempts`, `ombudsman_case_actions` |
| `…_seguranca-rls` | RLS ativado em todas as tabelas e API pública do Supabase fechada |
| `…_equipe-atribuivel-depois` | Permite definir a equipe de avaliações já finalizadas quando a regra de atribuição existir (única exceção à trava) |

**Aplicar no banco** (usa a `DATABASE_URL` de `backend/.env`):

```bash
npm run db:migrate
```

As migrações só **criam** objetos novos; não alteram nem apagam dados existentes. Reexecutar o comando é seguro (as já aplicadas são ignoradas). Os trechos "Down Migration" apagam tabelas e servem **apenas para desenvolvimento**; nunca os execute com dados reais.

A CLI de migrações lê `DATABASE_URL` diretamente e não usa `DB_SSL`. Se o Supabase recusar a conexão por causa do SSL, execute o comando com `?sslmode=no-verify` no fim da URL, apenas naquele comando.

**Validar a persistência:**

```bash
npm run db:test
```

Roda 16 verificações no banco configurado (senha só como hash, respostas gravadas e corrigidas por substituição, perguntas desativadas sem perder histórico, avaliação finalizada imutável, atendimento encerrado que não reabre, RLS ativo etc.). Tudo acontece dentro de uma transação **desfeita ao final**: nenhum dado é gravado, então é seguro rodar também no Supabase.

Outros comandos úteis:

```bash
npm --prefix backend run migrate:create nome-da-migracao   # cria um arquivo .sql
npm --prefix backend run migrate:down                      # desfaz a última (só desenvolvimento)
```

## Mapa de URLs (contrato do projeto)

Estes caminhos foram definidos na Etapa 1 e **não devem ser renomeados sem autorização expressa**. Os marcados como "reservado" ainda não estão implementados.

**Frontend**

| Caminho | Uso | Acesso |
|---|---|---|
| `/` | Verificação do sistema e atalhos das telas (temporária, será substituída) | Desenvolvimento |
| `/pesquisa/:slug` | Pesquisa pública de cada setor | Público, sem login |
| `/login` | Login da área privada | Público |
| `/trocar-senha` | Troca obrigatória de senha no primeiro acesso | Autenticado |
| `/admin` | Tela inicial da área privada (as telas de cada perfil virão depois) | Autenticado |
| `/admin/*` | Demais telas da área privada (reservado) | Autenticado + permissão |

**API**

| Caminho | Uso | Acesso |
|---|---|---|
| `/api/health`, `/api/health/db` | Verificação de funcionamento | Aberto nesta etapa |
| `/api/auth/*` | Login, sessão e troca de senha | `login` e `logout` abertos; `me` e `change-password` com sessão |
| `/api/public/*` | Operações da pesquisa pública (ver o contrato em `docs/pesquisa-publica.md`) | Público, só o necessário para responder; token próprio por avaliação |
| `/api/admin/*` | Operações da área privada (usuários, setores, configurações; ouvidoria protegida) | Autenticação + autorização no backend |

## Regras de desenvolvimento

- Preservar as URLs acima e a separação entre rotas públicas e privadas.
- Toda rota privada exige autenticação e verificação de permissão **no backend**.
- Não excluir dados históricos: desativar em vez de apagar (o banco também impede).
- Nenhum segredo no código; use sempre o `.env`.
- Implementar por etapas, sem alterar partes não relacionadas à tarefa.

## Git

O repositório já tem `.gitignore` (inclui `node_modules/` e `.env`) e `.gitattributes` (finais de linha consistentes entre Windows e Linux). Para o primeiro commit:

```bash
git add -A
git status          # confira que .env e node_modules NÃO aparecem
git commit -m "Etapa 1: estrutura inicial do projeto"
```
