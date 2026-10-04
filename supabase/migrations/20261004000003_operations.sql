-- =====================================================================
-- Finanças — operações atômicas e relatórios
-- Toda operação que mexe em mais de uma linha/tabela vive aqui, dentro de UMA
-- transação do Postgres: ou tudo acontece, ou nada. Todas são SECURITY INVOKER,
-- então a RLS e as chaves compostas continuam valendo.
-- =====================================================================

create function public.require_household()
returns uuid
language plpgsql stable security invoker set search_path = public
as $$
declare h uuid := public.current_household();
begin
  if h is null then raise exception 'Você não participa de nenhum espaço'; end if;
  return h;
end;
$$;

-- ---------- Parcelamento ----------------------------------------------
-- Divide em centavos inteiros: os "centavos que sobram" vão para as primeiras parcelas.
-- p_current permite começar de uma parcela já em andamento (ex.: 8/10).
create function public.create_installments(
  p_kind public.tx_kind, p_description text,
  p_amount_cents bigint, p_amount_is_total boolean,
  p_first_due date, p_total smallint, p_current smallint,
  p_person_id uuid, p_category_id uuid, p_account_id uuid, p_notes text,
  p_first_done boolean, p_today date
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  h uuid := public.require_household();
  gid uuid := gen_random_uuid();
  total_cents bigint;
  base bigint;
  rem bigint;
begin
  if p_total < 2 or p_total > 120 or p_current < 1 or p_current > p_total then
    raise exception 'Número de parcelas inválido';
  end if;
  total_cents := case when p_amount_is_total then p_amount_cents else p_amount_cents * p_total end;
  base := total_cents / p_total;
  rem  := total_cents % p_total;

  insert into transactions
    (household_id, kind, description, amount_cents, due_date, status, settled_at,
     person_id, category_id, account_id, notes,
     installment_group, installment_number, installment_total)
  select h, p_kind, btrim(p_description),
         base + case when k <= rem then 1 else 0 end,
         (p_first_due + ((k - p_current) * interval '1 month'))::date,
         case when k = p_current and p_first_done then 'done'::public.tx_status else 'pending'::public.tx_status end,
         case when k = p_current and p_first_done then coalesce(p_today, current_date) end,
         p_person_id, p_category_id, p_account_id, nullif(btrim(p_notes), ''),
         gid, k, p_total
  from generate_series(p_current::int, p_total::int) k;

  return gid;
end;
$$;

-- ---------- Fixos mensais ---------------------------------------------
create function public.create_recurring(
  p_kind public.tx_kind, p_description text, p_amount_cents bigint, p_day smallint,
  p_start_month date, p_person_id uuid, p_category_id uuid, p_account_id uuid,
  p_first_done boolean, p_today date
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  h uuid := public.require_household();
  m date := date_trunc('month', p_start_month)::date;
  rid uuid;
begin
  insert into recurring_rules
    (household_id, kind, description, amount_cents, day_of_month, start_month, person_id, category_id, account_id)
  values (h, p_kind, btrim(p_description), p_amount_cents, p_day, m, p_person_id, p_category_id, p_account_id)
  returning id into rid;

  perform public.materialize_recurring(m);

  if p_first_done then
    update transactions
       set status = 'done', settled_at = coalesce(p_today, current_date)
     where recurring_id = rid and due_date >= m and due_date < (m + interval '1 month')::date;
  end if;
  return rid;
end;
$$;

-- Edita a regra e propaga para os meses ainda pendentes a partir de p_from_month.
create function public.update_recurring(
  p_id uuid, p_description text, p_amount_cents bigint, p_day smallint,
  p_person_id uuid, p_category_id uuid, p_account_id uuid, p_active boolean, p_from_month date
) returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  from_m date := date_trunc('month', p_from_month)::date;
  n int;
begin
  update recurring_rules
     set description = btrim(p_description), amount_cents = p_amount_cents, day_of_month = p_day,
         person_id = p_person_id, category_id = p_category_id, account_id = p_account_id, active = p_active
   where id = p_id;
  if not found then raise exception 'Lançamento fixo não encontrado'; end if;

  update transactions t
     set description = btrim(p_description), amount_cents = p_amount_cents,
         person_id = p_person_id, category_id = p_category_id, account_id = p_account_id,
         due_date = date_trunc('month', t.due_date)::date
                    + (least(p_day, extract(day from (date_trunc('month', t.due_date) + interval '1 month - 1 day'))::int) - 1)
   where t.recurring_id = p_id and t.status = 'pending' and t.due_date >= from_m;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Remove a regra e os meses futuros ainda pendentes; o histórico pago é mantido.
create function public.delete_recurring(p_id uuid, p_from date)
returns integer
language plpgsql security invoker set search_path = public
as $$
declare n int;
begin
  delete from transactions where recurring_id = p_id and status = 'pending' and due_date >= p_from;
  get diagnostics n = row_count;
  delete from recurring_rules where id = p_id;
  if not found then raise exception 'Lançamento fixo não encontrado'; end if;
  return n;
end;
$$;

-- ---------- Edição / exclusão com escopo ------------------------------
-- p_scope = 'one'       → só este lançamento
-- p_scope = 'following' → este + as parcelas seguintes do mesmo parcelamento
-- Campos comuns (tipo, descrição, valor, pessoa, categoria, conta, nota) valem para todos
-- do escopo; data e situação (pago/pendente) valem apenas para o lançamento editado.
create function public.update_transaction(
  p_id uuid, p_scope text, p_kind public.tx_kind, p_description text, p_amount_cents bigint,
  p_due_date date, p_done boolean, p_person_id uuid, p_category_id uuid, p_account_id uuid,
  p_notes text, p_today date
) returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  t transactions;
  n int := 0;
begin
  if p_scope not in ('one', 'following') then raise exception 'Escopo inválido'; end if;
  select * into t from transactions where id = p_id;
  if not found then raise exception 'Lançamento não encontrado'; end if;

  if p_scope = 'following' and t.installment_group is not null then
    update transactions
       set kind = p_kind, description = btrim(p_description), amount_cents = p_amount_cents,
           person_id = p_person_id, category_id = p_category_id, account_id = p_account_id,
           notes = nullif(btrim(p_notes), '')
     where installment_group = t.installment_group
       and installment_number > t.installment_number;
    get diagnostics n = row_count;
  end if;

  update transactions
     set kind = p_kind, description = btrim(p_description), amount_cents = p_amount_cents,
         due_date = p_due_date,
         status = case when p_done then 'done'::public.tx_status else 'pending'::public.tx_status end,
         settled_at = case when p_done then coalesce(t.settled_at, p_today, current_date) end,
         person_id = p_person_id, category_id = p_category_id, account_id = p_account_id,
         notes = nullif(btrim(p_notes), '')
   where id = p_id;
  return n + 1;
end;
$$;

create function public.delete_transactions(p_id uuid, p_scope text)
returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  t transactions;
  n int;
begin
  if p_scope not in ('one', 'following') then raise exception 'Escopo inválido'; end if;
  select * into t from transactions where id = p_id;
  if not found then raise exception 'Lançamento não encontrado'; end if;

  if p_scope = 'following' and t.installment_group is not null then
    delete from transactions
     where installment_group = t.installment_group and installment_number >= t.installment_number;
  else
    delete from transactions where id = p_id;
  end if;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------- Orçamento --------------------------------------------------
-- Copia os limites de um mês para outro (idempotente: sobrescreve o destino).
create function public.copy_budgets(p_from date, p_to date)
returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  h uuid := public.require_household();
  n int;
begin
  insert into budgets (household_id, category_id, month, amount_cents)
  select h, b.category_id, date_trunc('month', p_to)::date, b.amount_cents
  from budgets b
  where b.month = date_trunc('month', p_from)::date
  on conflict (category_id, month) do update set amount_cents = excluded.amount_cents;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------- Importação em lote (atômica) ------------------------------
-- p_rows: [{kind, description, amount_cents, due_date, status, person, category,
--           group_key, installment_number, installment_total}]
-- Cria pessoas que faltam, resolve categoria por nome, liga parcelas pela group_key e
-- ignora lançamentos idênticos (mesmo tipo, descrição, valor e data) que já existem.
create function public.import_transactions(p_rows jsonb)
returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  h uuid := public.require_household();
  palette text[] := array['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6'];
  existing_people bigint;
  total int;
  inserted int;
begin
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Formato de importação inválido'; end if;
  total := jsonb_array_length(p_rows);
  if total > 5000 then raise exception 'Arquivo grande demais (máximo de 5000 linhas)'; end if;

  select count(*) into existing_people from people;
  insert into people (household_id, name, color)
  select h, n.name, palette[1 + ((row_number() over (order by n.name) + existing_people) % 5)::int]
  from (
    select distinct on (lower(btrim(x.person))) btrim(x.person) as name
    from jsonb_to_recordset(p_rows) as x(person text)
    where nullif(btrim(x.person), '') is not null
  ) n
  on conflict do nothing;

  with src as (
    select * from jsonb_to_recordset(p_rows) as x(
      kind public.tx_kind, description text, amount_cents bigint, due_date date,
      status public.tx_status, person text, category text, group_key text,
      installment_number smallint, installment_total smallint)
  ), groups as (
    select g.group_key, gen_random_uuid() as gid
    from (select distinct group_key from src where group_key is not null) g
  )
  insert into transactions
    (household_id, kind, description, amount_cents, due_date, status, settled_at,
     person_id, category_id, installment_group, installment_number, installment_total)
  select h, s.kind, btrim(s.description), s.amount_cents, s.due_date, s.status,
         case when s.status = 'done' then s.due_date end,
         p.id, c.id, g.gid,
         case when g.gid is not null then s.installment_number end,
         case when g.gid is not null then s.installment_total end
  from src s
  left join people p     on p.household_id = h and lower(btrim(p.name)) = lower(btrim(s.person))
  left join categories c on c.household_id = h and c.kind = s.kind and lower(btrim(c.name)) = lower(btrim(s.category))
  left join groups g     on g.group_key = s.group_key
  where not exists (
    select 1 from transactions t
    where t.kind = s.kind and lower(t.description) = lower(btrim(s.description))
      and t.amount_cents = s.amount_cents and t.due_date = s.due_date
  );
  get diagnostics inserted = row_count;

  return jsonb_build_object('inserted', inserted, 'duplicates', total - inserted);
end;
$$;

-- ---------- Relatórios (agregação no banco) ---------------------------
-- "Guardar" (categorias is_savings) é separado de despesa.
create function public.period_summary(p_from date, p_to date)
returns table (
  month date,
  income_cents bigint, income_done_cents bigint,
  expense_cents bigint, expense_done_cents bigint,
  saved_cents bigint, saved_done_cents bigint
)
language sql stable security invoker set search_path = public
as $$
  select m::date,
    coalesce(sum(t.amount_cents) filter (where t.kind = 'income'), 0)::bigint,
    coalesce(sum(t.amount_cents) filter (where t.kind = 'income' and t.status = 'done'), 0)::bigint,
    coalesce(sum(t.amount_cents) filter (where t.kind = 'expense' and not coalesce(c.is_savings, false)), 0)::bigint,
    coalesce(sum(t.amount_cents) filter (where t.kind = 'expense' and not coalesce(c.is_savings, false) and t.status = 'done'), 0)::bigint,
    coalesce(sum(t.amount_cents) filter (where t.kind = 'expense' and coalesce(c.is_savings, false)), 0)::bigint,
    coalesce(sum(t.amount_cents) filter (where t.kind = 'expense' and coalesce(c.is_savings, false) and t.status = 'done'), 0)::bigint
  from generate_series(date_trunc('month', p_from), date_trunc('month', least(p_to, p_from + interval '60 months')), interval '1 month') m
  left join transactions t on t.due_date >= m::date and t.due_date < (m + interval '1 month')::date
  left join categories c on c.id = t.category_id
  group by m
  order by m
$$;

create function public.category_totals(p_from date, p_to date)
returns table (category_id uuid, total_cents bigint)
language sql stable security invoker set search_path = public
as $$
  select t.category_id, sum(t.amount_cents)::bigint
  from transactions t
  left join categories c on c.id = t.category_id
  where t.kind = 'expense' and not coalesce(c.is_savings, false) and t.due_date between p_from and p_to
  group by t.category_id
  order by 2 desc
$$;

create function public.person_totals(p_from date, p_to date)
returns table (person_id uuid, total_cents bigint)
language sql stable security invoker set search_path = public
as $$
  select t.person_id, sum(t.amount_cents)::bigint
  from transactions t
  left join categories c on c.id = t.category_id
  where t.kind = 'expense' and not coalesce(c.is_savings, false) and t.due_date between p_from and p_to
  group by t.person_id
  order by 2 desc
$$;

-- Uma linha por compra parcelada. `focus` = próxima parcela pendente (ou a última, se quitada).
create function public.installment_groups()
returns table (
  group_id uuid, description text, category_id uuid, person_id uuid,
  total smallint, paid_count integer, pending_count integer,
  remaining_cents bigint, last_due date, focus jsonb
)
language sql stable security invoker set search_path = public
as $$
  with g as (
    select installment_group as gid,
           max(installment_total) as total,
           (count(*) filter (where status = 'done'))::int as paid_count,
           (count(*) filter (where status = 'pending'))::int as pending_count,
           coalesce(sum(amount_cents) filter (where status = 'pending'), 0)::bigint as remaining_cents,
           max(due_date) as last_due
    from transactions where installment_group is not null
    group by installment_group
  )
  select g.gid, f.description, f.category_id, f.person_id, g.total, g.paid_count, g.pending_count,
         g.remaining_cents, g.last_due, to_jsonb(f)
  from g
  cross join lateral (
    select t.* from transactions t
    where t.installment_group = g.gid
    order by (t.status = 'done'),
             case when t.status = 'pending' then t.installment_number end asc,
             t.installment_number desc
    limit 1
  ) f
  order by g.remaining_cents desc, f.description
$$;

-- ---------- Permissões ------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'require_household()',
    'create_installments(public.tx_kind, text, bigint, boolean, date, smallint, smallint, uuid, uuid, uuid, text, boolean, date)',
    'create_recurring(public.tx_kind, text, bigint, smallint, date, uuid, uuid, uuid, boolean, date)',
    'update_recurring(uuid, text, bigint, smallint, uuid, uuid, uuid, boolean, date)',
    'delete_recurring(uuid, date)',
    'update_transaction(uuid, text, public.tx_kind, text, bigint, date, boolean, uuid, uuid, uuid, text, date)',
    'delete_transactions(uuid, text)',
    'import_transactions(jsonb)', 'copy_budgets(date, date)',
    'period_summary(date, date)', 'category_totals(date, date)', 'person_totals(date, date)',
    'installment_groups()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
