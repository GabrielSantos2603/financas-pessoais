# Finanças

Controle financeiro pessoal / do casal. Next.js 16 (App Router) + Supabase + Tailwind v4. Responsivo (PC e celular), com tema claro/escuro e instalável como app (PWA).

## Funcionalidades

- **Visão geral**: sobra prevista, em caixa agora, receitas/despesas/guardado com progresso, pendentes do mês, gastos por categoria, últimos 6 meses, despesas por pessoa, parcelas em aberto.
- **Lançamentos**: navegação por mês, busca, filtros (tipo, status, pessoa, categoria), marcar pago/recebido com 1 toque (com "desfazer"), edição rápida.
- **Parcelamento** (ex.: "Notebook 8/10") e **fixos mensais** (aluguel, salário...) gerados automaticamente a cada mês.
- **Orçamento** por categoria com barra de consumo e "copiar mês anterior".
- **Relatórios** de 3/6/12 meses.
- **Compartilhamento**: o casal usa o mesmo espaço via código de convite (trocável); o dono gerencia membros.
- **Importar a planilha** `.xlsx` (abas JUL26, AGO26...) direto pelo app, de forma atômica e sem duplicar.

## Configuração

### 1. Supabase
1. Crie um projeto em https://supabase.com.
2. Em **SQL Editor**, execute **na ordem** os arquivos de `supabase/migrations/`:
   `20261004000001_schema.sql` → `20261004000002_access.sql` → `20261004000003_operations.sql`.
   (Ou, com a CLI: `npx supabase init && npx supabase link && npx supabase db push`.)
3. Em **Authentication → URL Configuration**, defina o *Site URL* (a URL da Vercel) e adicione `https://SEU-APP.vercel.app/auth/callback` e `http://localhost:3000/auth/callback` em *Redirect URLs*.
4. (Opcional, mais prático para uso pessoal) Em **Authentication → Providers → Email**, desative "Confirm email".
5. Em **Project Settings → API**, copie a *Project URL* e a chave *anon public*.

### 2. Local
```bash
cp .env.example .env.local   # preencha as duas variáveis (o app valida na inicialização)
npm install
npm run dev
```

### 3. Deploy na Vercel
Suba o repositório no GitHub, importe na Vercel, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`, e ajuste o *Site URL* do Supabase para a URL final.

## Desenvolvimento

| Comando | O que faz |
|---|---|
| `npm run check` | lint + tipos + testes + tipos do banco em dia (o mesmo que o CI roda) |
| `npm test` | testes unitários **e** de banco (Postgres 18 embutido via PGlite, com RLS real) — não precisa de Docker nem de internet |
| `npm run db:types` | regenera `src/types/database.ts` a partir das migrations |
| `npm run db:types:check` | falha se esse arquivo estiver desatualizado |

**Mudou o banco?** Crie uma nova migration em `supabase/migrations/` (nunca edite uma já aplicada), rode `npm run db:types` e `npm test`.

## Arquitetura

```
supabase/migrations/   schema + RLS + funções SQL (a fonte da verdade dos dados e das regras de integridade)
src/domain/            regras puras em TypeScript (dinheiro, parcelas, resumo, validação, importador) — sem React, sem Supabase
src/services/          TODO acesso ao Supabase (tipado, erros traduzidos); recebe o cliente por parâmetro
src/hooks/             React Query: queries.ts (leitura), mutations.ts (escrita), keys.ts (cache)
src/components/, app/  interface; só fala com hooks, nunca com o Supabase direto
src/types/database.ts  GERADO do schema real — src/types/db.ts deriva dele
tests/unit, tests/db   regras puras; e SQL/RLS/atomicidade contra Postgres embutido
```

Princípios:
- **Dinheiro em centavos inteiros** (`bigint` no banco, `number` inteiro no app). Nunca ponto flutuante.
- **Integridade no banco, não na tela**: chaves estrangeiras compostas `(household_id, id)` impedem referenciar dados de outra casa; checks validam valores; um usuário só pertence a uma casa.
- **Operações com várias linhas são funções SQL atômicas** (`create_installments`, `create_recurring`, `update_transaction`, `import_transactions`...): ou tudo acontece, ou nada.
- **Agregações no banco** (`period_summary`, `category_totals`, `person_totals`, `installment_groups`): o navegador não baixa meses de lançamentos para somar.
- **Segurança**: RLS em todas as tabelas; `anon` sem acesso; convite com ~74 bits de entropia, limite de 5 tentativas inválidas/15 min, trocável pelo dono; cabeçalhos HTTP de segurança.
- **Regra duplicada em TS e SQL** (divisão de parcelas, resumo) tem teste que compara as duas implementações.

## Importando a planilha
**Configurações → Importar planilha do Excel.** Cada aba de mês precisa ter: receitas à esquerda (`Data | Descrição | Valor | Nome | Status`) e despesas à direita (`Data | Descrição | Parcela | Total Parcelas | Valor | Nome | Status`). O mês vem do nome da aba; o dia, da coluna Data. Linhas sem valor são ignoradas. Rodar de novo não duplica lançamentos idênticos.

## Limitações conhecidas
- Sem Content-Security-Policy (o Next injeta scripts inline; um CSP com nonce está pendente).
- Sem testes de interface/E2E no navegador; a UI passa por tipos, lint e build, mas ainda não foi exercitada de ponta a ponta contra um Supabase real.
- Os testes de banco usam PGlite com um stub de `auth.uid()`; não exercitam GoTrue/PostgREST reais.
- Observabilidade: `src/lib/observability.ts` é o ponto de integração (ex.: Sentry); por padrão só loga no console.
