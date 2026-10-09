# Perguntas para o Davide — Office tool v2

A nova versão está pronta e testada localmente (branch `office-tool-v2`, nada publicado). Antes de a pôr online preciso de:

## 1. Onde está a app atual?
1. A app atual (office-8mijw.ondigitalocean.app) é publicada a partir de que repositório e que branch? (No DigitalOcean: Apps → a app → Settings → o componente → Source.)
2. Posso ter acesso de leitura a esse repositório?
3. A nova versão não se encaixa por cima da atual (não é o mesmo código). Concordas em criar uma **app nova e uma base de dados nova** no DigitalOcean, ao lado da atual, e só trocar o endereço quando estiver tudo validado? A atual fica como plano B.

## 2. Email
4. Que serviço de email usamos para enviar os links de entrada e o email de boas-vindas (por exemplo Postmark, Resend, Amazon SES, o do Google)?
5. Desde que endereço enviamos (por exemplo office@subvisual.co)? Alguém pode configurar o domínio (SPF/DKIM)?

## 3. Dados reais
6. Emails reais dos 3 administradores. O Notion diz `paulo.sousa@subvisual.co`, `catarina@subvisual.co` e `laura@subvisual.co`; o Paulo entra com `paulo@subvisual.co`. Qual é o correto?
7. Quantos lugares tem a sala Bravo? (O Notion diz "4 ou 2", ficou 4.)
8. Como passamos as tags e os códigos atuais (base "Access Control" do Notion) para a nova app sem os códigos passarem por chats ou pelo repositório?

## 4. Segurança e produção
9. Quem guarda a chave que cifra os códigos das portas (`PORTAL_CODE_KEY`)? Se se perder, os códigos guardados ficam ilegíveis. Sugestão: cofre de passwords da empresa.
10. A base de dados nova deve ser uma "managed database" do DigitalOcean com cópias de segurança diárias. Concordas?
11. Que endereço final queremos (por exemplo office.subvisual.co)?

## 5. Textos que faltam (Paulo/Rui)
12. Guias (porta, app, registo), WiFi, e a parte do email de boas-vindas sobre café, frigorífico, micro-ondas e como pedir equipamento.

---
Detalhes técnicos e o plano de publicação: `SPEC-CHECK.md`.
