# Office tools v2 — Office 42, Braga

Ferramenta de gestão do escritório (salas, tags de acesso, issues e pedidos, mensagens, fornecedores, métricas), feita a partir do documento
**"Office Tool — Changes for Rui (Oct 2026)"** do Notion. Está **testada localmente com dados falsos e não foi publicada em lado nenhum**.

## O que é (e o que não é)
- Foi feita rapidamente pelo Paulo com o Claude (assistente de IA), **sem a estrutura e o cuidado da app original** que está online (office-8mijw.ondigitalocean.app, TanStack + better-auth). Precisa de **revisão**.
- Não é o código da app online e não se encaixa por cima dela: outra stack e outra base de dados. Serve como **referência do comportamento pretendido** ou como base nova, à escolha de quem reveja.

## Onde está cada coisa
| O quê | Onde |
|---|---|
| Interface (React + Vite + Tailwind) | `artifacts/portal` |
| API (Express 5) | `artifacts/api-server/src/routes/portal*.ts`, `artifacts/api-server/src/security.ts` |
| Base de dados (Postgres + Drizzle, tabelas `portal_*`) | `lib/db/src/schema/portal.ts`, migrações em `lib/db/migrations` |
| Dados falsos para desenvolvimento | `scripts/src/seed-v2.ts` |
| Dados reais iniciais (admins, empresas, salas) | `scripts/src/setup-real.ts` + `scripts/setup.example.json` |
| Verificação do documento, ponto a ponto (115 testes contra a API) | `scripts/spec-check.py`, resultados em **SPEC-CHECK.md** |
| Publicação (preparada, não usada) | `.do/app.yaml` |
| Regras de trabalho e como correr | **CLAUDE.md** |
| Perguntas em aberto | **QUESTIONS-FOR-DAVIDE.md** |

## Correr localmente
Postgres 16 local, Node 24, pnpm 10. Detalhes em `CLAUDE.md`.
```
pnpm install
pnpm --filter @workspace/db run push          # cria as tabelas na base local (DATABASE_URL no .env)
pnpm --filter @workspace/scripts run seed:v2  # dados falsos (recusa correr fora de localhost)
pnpm run dev                                  # API em :8080, interface em :5174
```
Entrar com `admin1@example.test` (fora de produção o link de entrada aparece no ecrã). Testes: `pnpm run test` e, com a API a correr, `python3 scripts/spec-check.py`.

---

## Notas para o Davide

Obrigado por reveres. Isto é o que acho que mais precisa de olhos experientes, e as decisões que deixei tomadas.

### Arquitetura em 30 segundos
- Monorepo pnpm: `artifacts/portal` (SPA React, wouter, react-query), `artifacts/api-server` (Express 5, tudo em `/api/portal/*`), `lib/db` (Drizzle + node-postgres).
- Em produção **um só serviço** serve a SPA e a API no mesmo endereço (`PORTAL_STATIC_DIR`), por isso o cookie é first-party e o CORS está desligado.
- Hora: todas as regras e o que se mostra usam **Europe/Lisbon** (`portal-time.ts` e `lib/time.ts`), com testes corridos em 3 fusos horários da máquina.

### Segurança: onde olhar primeiro
| Ficheiro | O quê |
|---|---|
| `routes/portal.ts` | Login por link mágico (15 min, uso único) e palavra-passe opcional (scrypt, bloqueio ao fim de 5 erros por 15 min). Sessões em BD, 30 dias, cookie `HttpOnly; SameSite=Lax; Secure`. Limites: 5 links por email / 15 min, 30 por IP / hora. Pessoas desativadas não entram. |
| `routes/portal-crypto.ts` | Links, sessões e convites guardados como **SHA-256**. Códigos das portas cifrados com **AES-256-GCM** (`PORTAL_CODE_KEY`) e um HMAC para garantir que não há dois iguais. |
| `routes/portal-supplier.ts`, `routes/portal-tags.ts` | Página do fornecedor (Ricardo) sem conta: o link secreto (32 bytes, 14 dias, revogável) é a credencial. Uma tag só muda quando a linha é marcada como feita, e só se ainda estiver no estado esperado. |
| `routes/portal-config.ts` | O servidor **recusa arrancar** em produção sem `PORTAL_URL` (https), `PORTAL_CODE_KEY` (32 bytes) e `DATABASE_URL`. Os links usam sempre `PORTAL_URL`, nunca o pedido. |
| `security.ts` | Cabeçalhos (CSP, HSTS, X-Frame-Options…) e servir a SPA. |

### Decisões que gostava que confirmasses
1. **Sem token CSRF.** A proteção vem de `SameSite=Lax` e de não haver CORS. Chega, ou preferes um token?
2. **Limites de pedidos em memória**: só funcionam com **uma instância** (`instance_count: 1`). Se escalar, têm de passar para a BD ou para Redis.
3. **Bloqueio da palavra-passe**: qualquer pessoa pode bloquear a conta de outra durante 15 min. Aceitei-o porque o link por email continua a funcionar.
4. **Fotos (salas e guias) guardadas na BD** (`bytea`, até 2 MB e 5 MB). É simples, mas incha os backups. Object storage (Spaces) seria a alternativa.
5. **Sessões não são renovadas** e duram 30 dias. Ao desativar alguém, as sessões dessa pessoa são apagadas.
6. **Migrações**: `0000_baseline` foi gerada do schema. Em desenvolvimento ainda uso `drizzle-kit push`. Para BD novas só `pnpm --filter @workspace/db run migrate` (tabela `__portal_migrations`).

### O que não está feito
- **Email**: `routes/portal-mail.ts` só regista no log (nunca o link). Falta escolher o serviço, ligá-lo e testar o SPF/DKIM.
- **Importação das tags e códigos** do Notion: o Paulo tem o ficheiro. Os códigos desconhecidos ficam vazios e a própria pessoa pode registá-los uma vez.
- **Testes de interface automáticos**: não há. O `spec-check.py` testa a API e os ecrãs foram vistos à mão (e com axe para a acessibilidade).
- O `.do/app.yaml` **não foi validado** com `doctl` nem publicado. Precisa da DB gerida `office-tools-v2-db` criada antes e de acesso do DigitalOcean a este repositório.

### Publicar (quando decidido)
1. Criar a DB gerida (PostgreSQL 16, backups) e a app a partir de `.do/app.yaml`. Preencher `PORTAL_URL` e `PORTAL_CODE_KEY` como segredos e guardar uma cópia da chave no cofre de palavras-passe.
2. O job `migrate` corre antes de cada publicação.
3. `DATABASE_URL=… pnpm --filter @workspace/scripts run setup:real -- setup.json` mostra o que vai fazer; com `--apply`, cria os admins, as empresas e as salas.
4. Importar as tags (script por fazer) e ligar o email.
