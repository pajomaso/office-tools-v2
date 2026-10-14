# Office tools v2 — Office 42, Braga

Uma reimplementação da ferramenta de gestão do escritório (salas, tags de acesso, issues, mensagens, métricas), feita a partir do documento
**"Office Tool — Changes for Rui (Oct 2026)"** do Notion. Está **testada localmente com dados falsos e não foi publicada em lado nenhum**.

## O que é (e o que não é)
- É uma versão feita rapidamente, **sem a estrutura e o cuidado da app original** que está online (office-8mijw.ondigitalocean.app, TanStack + better-auth). Precisa de **revisão** por alguém que conheça a app original.
- Não é o código da app online e não se encaixa por cima dela: tem outra stack (Express + Vite/React + Postgres/Drizzle) e outra base de dados. Serve como **referência do comportamento pretendido** ou como base nova, à escolha de quem reveja.
- Este repositório ainda contém as apps antigas do monorepo de onde partiu (`office-engine`, `check-in`, `mockup-sandbox`). **A v2 são só** `artifacts/portal`, `artifacts/api-server/src/routes/portal*` e `lib/db/src/schema/portal.ts`.

## Onde está cada coisa
| O quê | Onde |
|---|---|
| Interface (React) | `artifacts/portal` |
| API (Express) | `artifacts/api-server/src/routes/portal*.ts` |
| Base de dados (tabelas `portal_*`) | `lib/db/src/schema/portal.ts` |
| Dados falsos | `scripts/src/seed-v2.ts` |
| Verificação do documento, ponto a ponto (107 testes) | `scripts/spec-check.py`, resultados em **SPEC-CHECK.md** |
| Regras de trabalho e como correr | **CLAUDE.md** |
| Perguntas em aberto | **QUESTIONS-FOR-DAVIDE.md** |

## Correr localmente
Ver `CLAUDE.md` (Postgres local, Node 24, `pnpm`). Resumo: `pnpm install`, criar a base de dados local, `pnpm --filter @workspace/db run push`,
`pnpm --filter @workspace/scripts run seed:v2`, e arrancar `artifacts/api-server` (porta 8080) e `artifacts/portal` (porta 5174).
Entrar com `admin1@example.test` (o link de entrada aparece no ecrã fora de produção).

## O que falta antes de ir para produção
Ver **SPEC-CHECK.md** (secção "What deploying safely would need"). O essencial:
- **Envio de emails** (não há serviço ligado; links de entrada e email de boas-vindas só aparecem no ecrã).
- **Importação** das tags e dos códigos reais do Notion ("Access Control"), com os códigos fora do repositório.
- Textos em falta (`[add …]`), as respostas em QUESTIONS-FOR-DAVIDE.md.

Já preparado (não publicado): definição da app no DigitalOcean (`.do/app.yaml`), migrações (`lib/db/migrations`), script para criar os admins reais (`setup:real`), cabeçalhos de segurança e limites ao pedido de links de entrada.
- Nunca usar a chave local de cifra dos códigos: em produção é obrigatório definir `PORTAL_CODE_KEY`, `PORTAL_URL` e `DATABASE_URL`.

## Limites conhecidos
Não foi testado com pessoas reais, Bitwarden, telemóveis reais, nem sob carga. Detalhes em SPEC-CHECK.md.
