# Autenticação e permissões (Etapa 4)

## Como funciona

- **Login** por usuário e senha (`POST /api/auth/login`). Não há e-mail, recuperação de senha por e-mail nem limite de tentativas (decisões do projeto).
- **Senhas** guardadas só como hash **argon2id**. O banco recusa qualquer valor que não seja um hash.
- **Sessão** em cookie `hnps_session`: `HttpOnly` (o JavaScript da página não enxerga), `SameSite=Lax` e `Secure` em produção. É um JWT assinado (HS256) com `JWT_SECRET`.
  - "Manter meu usuário neste dispositivo" marcado: dura **60 dias**. Sem marcar: cookie de sessão (some ao fechar o navegador), com limite de 12 horas.
- **A cada requisição** o usuário é relido do banco: desativar a conta, trocar/redefinir a senha ou mudar o setor valem **na hora**. Para isso existe `users.token_version`, incrementada nesses eventos; sessões emitidas antes caem.
- **Negado por padrão:** tudo sob `/api/admin` exige sessão válida e senha já trocada antes de qualquer rota. Uma rota nova adicionada ali nasce protegida.
- **CSRF:** operações que alteram dados exigem o cabeçalho `X-CSRF-Protection: 1` (o frontend envia sozinho).
- **Erros sem vazar contas:** usuário inexistente, senha errada e conta desativada recebem a mesma resposta (e tempo de resposta parecido). Setor fora do alcance do gestor responde "não encontrado", igual a um setor inexistente.
- O **respondente público** não tem conta nem sessão: nenhuma rota pública dá acesso à área privada. Ele só alcança a própria avaliação, com um token próprio (ver `docs/pesquisa-publica.md`).

## Permissões por perfil

Fonte única: `backend/src/config/permissions.js` (as rotas verificam permissões, não perfis).

| Permissão | Super Admin | Gestor | Ouvidoria |
|---|:-:|:-:|:-:|
| Gerenciar usuários internos e senhas temporárias (`users:manage`) | ✅ | | |
| Configurações, equipes e turnos, pergunta de NPS | ✅ | | |
| Setores: ver todos / ver só o próprio | todos | só o seu | todos |
| Perguntas: gerenciar de todos os setores / do próprio | todos | só o seu | |
| Resultados e respostas: todos os setores / só o próprio | todos | só o seu | todos |
| Ouvidoria: consultar (`ouvidoria:read`) | ✅ | | ✅ |
| Ouvidoria: registrar atendimento (`ouvidoria:handle`) | | | ✅ |

Em vigor: usuários, setores (leitura), configurações (link legal) e a proteção da área da ouvidoria. As demais permissões já estão definidas e serão aplicadas quando cada funcionalidade for construída.

## Rotas

Sem sessão, tudo abaixo (exceto login, logout e health) responde **401**.

| Rota | Quem acessa |
|---|---|
| `POST /api/auth/login` | Público |
| `POST /api/auth/logout` | Qualquer um (apaga o cookie) |
| `GET /api/auth/me` | Logado (mesmo com troca de senha pendente) |
| `POST /api/auth/change-password` | Logado (mesmo com troca pendente). Na troca obrigatória não pede a senha atual; nas demais, sim |
| `GET/POST /api/admin/users`, `GET/PATCH /api/admin/users/:id`, `POST /api/admin/users/:id/reset-password` | Somente Super Admin |
| `GET /api/admin/sectors`, `GET /api/admin/sectors/:id` | Super Admin e ouvidoria (todos); gestor (só o seu) |
| `GET /api/admin/settings`, `PUT /api/admin/settings/privacy-policy-url` | Somente Super Admin (link do texto legal da pesquisa) |
| `/api/admin/ouvidoria/*` | Super Admin e ouvidoria (sem endpoints ainda) |
| `/api/admin/*` (qualquer outra) | Exige login; hoje responde 404 |

Com **senha temporária pendente**, o usuário só alcança `me`, `change-password` e `logout`; o resto responde 403 (`PASSWORD_CHANGE_REQUIRED`).

## Regras de usuários e senhas

- Só o Super Admin cria usuários. A **senha temporária** (16 caracteres, aleatória) é mostrada **uma única vez** na resposta; no banco fica só o hash. O usuário é obrigado a trocá-la no primeiro acesso (vale para qualquer perfil).
- Nova senha: mínimo de 10 caracteres, letra maiúscula e minúscula, número e caractere especial; não pode repetir a senha atual/temporária.
- Gestor sempre tem setor; os demais perfis não. O perfil não muda por `PATCH`.
- O Super Admin não desativa a própria conta, não redefine a própria senha por essa rota e nunca fica sem outro Super Admin ativo.
- Trocar ou redefinir a senha derruba as sessões abertas daquele usuário.

## Primeiros passos

1. Gere um `JWT_SECRET` (mínimo de 32 caracteres) e coloque em `backend/.env`:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   Sem ele, o login responde 503.
2. Aplique as migrações: `npm run db:migrate`.
3. Crie o primeiro Super Admin (senha temporária aparece uma vez):
   `npm run user:create -- --username=admin --name="Seu Nome"`
4. Para criar um gestor é preciso existir um setor. O cadastro de setores pela interface virá em etapa futura; por ora, no SQL Editor do Supabase:
   `insert into sectors (name, slug) values ('Recepção', 'recepcao');`
   Depois: `npm run user:create -- --username=ana.gestora --name="Ana" --role=gestor --sector=recepcao`
5. Entre em `http://localhost:5173/login` e troque a senha temporária.

Exemplo de chamada à API (Git Bash), criando um usuário como Super Admin:

```bash
curl -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H 'content-type: application/json' -H 'x-csrf-protection: 1' \
  -d '{"username":"admin","password":"SENHA_ATUAL"}'

curl -b cookies.txt -X POST http://localhost:3001/api/admin/users \
  -H 'content-type: application/json' -H 'x-csrf-protection: 1' \
  -d '{"username":"joao.ouv","fullName":"João","role":"ouvidoria"}'
```

## Testes

```bash
npm test            # sem banco: política de senha, matriz de permissões, CSRF e sessão
npm run auth:test   # com banco de TESTE (TEST_DATABASE_URL): login e acessos permitidos/negados na API
```

`auth:test` cria e remove usuários/setores com prefixo `zz_test_` / `zz-test-`; use um banco de teste, de preferência separado do real.

## Limites conhecidos

- **Sem limite de tentativas de login** (decisão do projeto). Fica aberto a tentativas repetidas de adivinhar senha; vale reavaliar antes de colocar o sistema na internet.
- Sair apaga o cookie, mas não invalida o token em outros lugares; ele cai ao expirar (12 h ou 60 dias), ao trocar/redefinir a senha ou ao desativar a conta.
- Trocar o `JWT_SECRET` desconecta todos.
- Ainda não há telas de gestão de usuários: por ora, via comando (`user:create`) ou API.
