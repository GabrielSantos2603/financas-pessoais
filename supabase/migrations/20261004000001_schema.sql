-- =====================================================================
-- Finanças — schema
-- Modelo: uma "casa" (household) compartilhada por 1..N usuários.
-- Invariantes importantes ficam no banco, não na aplicação:
--   * valores monetários em centavos inteiros (bigint) — nada de float;
--   * toda referência (pessoa/conta/categoria/fixo) deve ser da MESMA casa
--     (chaves estrangeiras compostas com household_id);
--   * um usuário pertence a no máximo uma casa.
-- =====================================================================

create type public.tx_kind     as enum ('income', 'expense');
create type public.tx_status   as enum ('pending', 'done');
create type public.account_kind as enum ('checking', 'card', 'cash', 'savings', 'investment');
create type public.member_role as enum ('owner', 'member');

-- Código de convite: 20 caracteres hex de um UUID v4 (CSPRNG do Postgres). O UUID v4 fixa 6 bits,
-- então restam ~74 bits de entropia; com o limite de tentativas em join_household() isso é inviável de adivinhar.
create function public.new_invite_code()
returns text language sql volatile
as $$ select substr(replace(gen_random_uuid()::text, '-', ''), 1, 20) $$;

create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  invite_code text not null unique default public.new_invite_code(),
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null unique references auth.users(id) on delete cascade, -- 1 casa por usuário
  role         public.member_role not null default 'member',
  email        text,
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Tentativas de entrar por código (rate limit). Sem policies: só funções SECURITY DEFINER acessam.
create table public.join_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index on public.join_attempts (user_id, attempted_at);

-- Pessoas = coluna "Nome" da planilha (não precisam ter login).
create table public.people (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  color        text not null default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (household_id, id)
);
create unique index people_name_unique on public.people (household_id, lower(btrim(name)));

create table public.accounts (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  kind         public.account_kind not null default 'checking',
  color        text not null default '#0ea5e9' check (color ~ '^#[0-9a-fA-F]{6}$'),
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (household_id, id)
);
create unique index accounts_name_unique on public.accounts (household_id, lower(btrim(name)));

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  kind         public.tx_kind not null,
  icon         text not null default 'tag',
  color        text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_savings   boolean not null default false, -- "Guardar": sai do caixa, mas não é gasto
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (household_id, id),
  check (not is_savings or kind = 'expense')
);
create unique index categories_name_unique on public.categories (household_id, kind, lower(btrim(name)));

-- Lançamentos fixos mensais (aluguel, contas, salário...)
create table public.recurring_rules (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind         public.tx_kind not null,
  description  text not null check (char_length(btrim(description)) between 1 and 200),
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  start_month  date not null check (extract(day from start_month) = 1),
  end_month    date check (end_month is null or (extract(day from end_month) = 1 and end_month >= start_month)),
  person_id    uuid,
  category_id  uuid,
  account_id   uuid,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, person_id)   references public.people(household_id, id)     on delete set null (person_id),
  foreign key (household_id, category_id) references public.categories(household_id, id) on delete set null (category_id),
  foreign key (household_id, account_id)  references public.accounts(household_id, id)   on delete set null (account_id)
);

create table public.transactions (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households(id) on delete cascade,
  kind               public.tx_kind not null,
  description        text not null check (char_length(btrim(description)) between 1 and 200),
  amount_cents       bigint not null check (amount_cents >= 0),
  due_date           date not null,
  status             public.tx_status not null default 'pending',
  settled_at         date,
  person_id          uuid,
  category_id        uuid,
  account_id         uuid,
  installment_group  uuid,
  installment_number smallint,
  installment_total  smallint,
  recurring_id       uuid,
  notes              text check (notes is null or char_length(notes) <= 1000),
  created_by         uuid references auth.users(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  check (status = 'done' or settled_at is null),
  check (
    (installment_group is null and installment_number is null and installment_total is null)
    or (installment_group is not null and installment_total between 2 and 120
        and installment_number between 1 and installment_total)
  ),
  foreign key (household_id, person_id)    references public.people(household_id, id)          on delete set null (person_id),
  foreign key (household_id, category_id)  references public.categories(household_id, id)      on delete set null (category_id),
  foreign key (household_id, account_id)   references public.accounts(household_id, id)        on delete set null (account_id),
  foreign key (household_id, recurring_id) references public.recurring_rules(household_id, id) on delete set null (recurring_id)
);
create index on public.transactions (household_id, due_date);
create index on public.transactions (installment_group) where installment_group is not null;
create unique index transactions_recurring_once
  on public.transactions (recurring_id, due_date) where recurring_id is not null;

create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id  uuid not null,
  month        date not null check (extract(day from month) = 1),
  amount_cents bigint not null check (amount_cents >= 0),
  unique (category_id, month),
  foreign key (household_id, category_id) references public.categories(household_id, id) on delete cascade
);
create index on public.budgets (household_id, month);
