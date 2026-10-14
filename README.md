# Sistema de avaliação e satisfação hospitalar (FHDOD)

Aplicação web para pesquisas de satisfação, cálculo de NPS, indicadores e acompanhamento de manifestações pela ouvidoria.

> **Estado atual: Etapa 1 (estrutura inicial).** Existem apenas a estrutura do projeto, a conexão com o banco e uma página/endpoint de verificação. Login, pesquisa, dashboards e ouvidoria serão implementados nas próximas etapas.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Banco de dados | PostgreSQL (Supabase, usado só como PostgreSQL gerenciado) |
| Backend | Node.js 20+ · Express 5 · `pg` · `dotenv` · `node-pg-migrate` |
| Frontend | React 19 · Vite · CSS próprio (tokens do Figma) · fonte Inter hospedada localmente |

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
│   │   ├── middlewares/     # tratamento de erros (e, depois, autenticação/autorização)
│   │   ├── validators/      # validação dos dados recebidos (próximas etapas)
│   │   ├── jobs/            # tarefas agendadas, como os dashboards de 8h (próximas etapas)
│   │   ├── scripts/         # utilitários (ex.: db:check)
│   │   ├── app.js           # montagem do Express
│   │   └── server.js        # inicialização do servidor
│   ├── migrations/          # migrações SQL versionadas
│   ├── test/                # testes automatizados
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/public/    # telas da pesquisa pública
│   │   ├── pages/admin/     # telas da área privada
│   │   ├── components/
│   │   ├── services/        # chamadas à API
│   │   ├── routes/          # rotas e proteção por perfil
│   │   ├── styles/          # tokens de design e estilos globais
│   │   └── assets/          # logo e imagens
│   └── .env.example
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

4. O frontend não precisa de configuração. `frontend/.env.example` só é necessário se o backend rodar em outro endereço.

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

## Migrações do banco

As migrações ficam em `backend/migrations/` (SQL). Ainda não existe nenhuma tabela: elas serão criadas a partir da Etapa 2.

```bash
npm --prefix backend run migrate:create nome-da-migracao   # cria um arquivo .sql
npm --prefix backend run migrate:up                        # aplica as pendentes
npm --prefix backend run migrate:down                      # desfaz a última
```

A primeira execução cria a tabela de controle `pgmigrations`. A CLI de migrações lê `DATABASE_URL` diretamente e não usa `DB_SSL`. Se o Supabase recusar a conexão por causa do SSL, execute o comando com `?sslmode=no-verify` no fim da URL, apenas naquele comando.

## Mapa de URLs (contrato do projeto)

Estes caminhos foram definidos na Etapa 1 e **não devem ser renomeados sem autorização expressa**. Os marcados como "reservado" ainda não estão implementados.

**Frontend**

| Caminho | Uso | Acesso |
|---|---|---|
| `/` | Verificação do sistema (temporária, será substituída) | Desenvolvimento |
| `/pesquisa/:slug` | Pesquisa pública de cada setor (reservado) | Público, sem login |
| `/login` | Login da área privada (reservado) | Público |
| `/trocar-senha` | Troca obrigatória de senha no primeiro acesso (reservado) | Autenticado |
| `/admin/*` | Área privada por perfil (reservado) | Autenticado + permissão |

**API**

| Caminho | Uso | Acesso |
|---|---|---|
| `/api/health`, `/api/health/db` | Verificação de funcionamento | Aberto nesta etapa |
| `/api/auth/*` | Login e sessão (reservado) | Conforme a rota |
| `/api/public/*` | Operações da pesquisa pública (reservado) | Público, só o necessário para responder |
| `/api/admin/*` | Operações da área privada (reservado) | Autenticação + autorização no backend |

## Regras de desenvolvimento

- Preservar as URLs acima e a separação entre rotas públicas e privadas.
- Toda rota privada exige autenticação e verificação de permissão **no backend**.
- Não excluir dados históricos: desativar em vez de apagar.
- Nenhum segredo no código; use sempre o `.env`.
- Implementar por etapas, sem alterar partes não relacionadas à tarefa.

## Git

O repositório já tem `.gitignore` (inclui `node_modules/` e `.env`) e `.gitattributes` (finais de linha consistentes entre Windows e Linux). Para o primeiro commit:

```bash
git add -A
git status          # confira que .env e node_modules NÃO aparecem
git commit -m "Etapa 1: estrutura inicial do projeto"
```
