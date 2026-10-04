-- =====================================================================
-- Finanças — acesso: funções de membership, RLS e permissões
-- =====================================================================

-- Casa do usuário logado (SECURITY DEFINER evita recursão de RLS).
create function public.current_household()
returns uuid
language sql stable security definer set search_path = public
as $$
  select household_id from public.household_members where user_id = auth.uid()
$$;

create function public.is_member(h uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select h is not null and h = public.current_household()
$$;

-- Cria a casa do usuário com categorias padrão e uma pessoa com o nome dele.
create function public.create_household(p_name text, p_person text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  h uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'Você já participa de um espaço';
  end if;

  insert into households (name) values (coalesce(nullif(btrim(p_name), ''), 'Minha casa'))
    returning id into h;
  insert into household_members (household_id, user_id, role, email)
    values (h, auth.uid(), 'owner', (select email from auth.users where id = auth.uid()));
  insert into people (household_id, name, color)
    values (h, coalesce(nullif(btrim(p_person), ''), 'Eu'), '#6366f1');
  insert into accounts (household_id, name, kind, color) values
    (h, 'Conta principal',    'checking', '#0ea5e9'),
    (h, 'Cartão de crédito',  'card',     '#a855f7'),
    (h, 'Dinheiro',           'cash',     '#22c55e');

  insert into categories (household_id, name, kind, icon, color, is_savings) values
    (h, 'Salário',               'income',  'briefcase',      '#10b981', false),
    (h, 'Extras',                'income',  'sparkles',       '#14b8a6', false),
    (h, 'Empréstimos',           'income',  'hand-coins',     '#06b6d4', false),
    (h, 'Outras receitas',       'income',  'circle-plus',    '#84cc16', false),
    (h, 'Moradia',               'expense', 'home',           '#6366f1', false),
    (h, 'Contas da casa',        'expense', 'plug-zap',       '#0ea5e9', false),
    (h, 'Mercado',               'expense', 'shopping-cart',  '#f59e0b', false),
    (h, 'Alimentação fora',      'expense', 'utensils',       '#f97316', false),
    (h, 'Transporte',            'expense', 'car',            '#64748b', false),
    (h, 'Saúde',                 'expense', 'heart-pulse',    '#ef4444', false),
    (h, 'Educação',              'expense', 'graduation-cap', '#8b5cf6', false),
    (h, 'Filhos & Pets',         'expense', 'baby',           '#ec4899', false),
    (h, 'Lazer & Viagem',        'expense', 'plane',          '#d946ef', false),
    (h, 'Compras',               'expense', 'shopping-bag',   '#a855f7', false),
    (h, 'Cartão de crédito',     'expense', 'credit-card',    '#7c3aed', false),
    (h, 'Dívidas & Empréstimos', 'expense', 'landmark',       '#dc2626', false),
    (h, 'Impostos & Taxas',      'expense', 'receipt',        '#78716c', false),
    (h, 'Trabalho & Empresa',    'expense', 'building-2',     '#0d9488', false),
    (h, 'Guardar',               'expense', 'piggy-bank',     '#16a34a', true),
    (h, 'Outras despesas',       'expense', 'ellipsis',       '#94a3b8', false);

  return h;
end;
$$;

-- Entra em uma casa pelo código de convite. Retorna NULL se o código for inválido.
-- Limite: 5 tentativas inválidas a cada 15 minutos por usuário.
create function public.join_household(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  h uuid;
  attempts int;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'Você já participa de um espaço';
  end if;

  delete from join_attempts where attempted_at < now() - interval '1 day';
  select count(*) into attempts from join_attempts
   where user_id = auth.uid() and attempted_at > now() - interval '15 minutes';
  if attempts >= 5 then
    raise exception 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  end if;

  select id into h from households where invite_code = lower(btrim(p_code));
  if h is null then
    -- não levanta exceção: o INSERT precisa sobreviver ao rollback
    insert into join_attempts (user_id) values (auth.uid());
    return null;
  end if;

  insert into household_members (household_id, user_id, role, email)
    values (h, auth.uid(), 'member', (select email from auth.users where id = auth.uid()));
  return h;
end;
$$;

-- Troca o código de convite (só o dono). O código antigo deixa de funcionar.
create function public.rotate_invite_code()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  code text := public.new_invite_code();
begin
  if not exists (select 1 from household_members where user_id = auth.uid() and role = 'owner') then
    raise exception 'Somente o dono do espaço pode trocar o código';
  end if;
  update households set invite_code = code where id = public.current_household();
  return code;
end;
$$;

-- Remove um membro (só o dono; não pode remover a si mesmo).
create function public.remove_member(p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from household_members where user_id = auth.uid() and role = 'owner') then
    raise exception 'Somente o dono do espaço pode remover membros';
  end if;
  if p_user = auth.uid() then raise exception 'Use "Sair do espaço" para sair'; end if;
  delete from household_members where user_id = p_user and household_id = public.current_household();
  if not found then raise exception 'Membro não encontrado'; end if;
end;
$$;

-- Sai do espaço. O dono só sai se for o último membro (aí o espaço e os dados são apagados).
create function public.leave_household()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  h uuid := public.current_household();
  my_role public.member_role;
  others int;
begin
  if h is null then raise exception 'Você não participa de nenhum espaço'; end if;
  select role into my_role from household_members where user_id = auth.uid();
  select count(*) into others from household_members where household_id = h and user_id <> auth.uid();
  if my_role = 'owner' and others > 0 then
    raise exception 'O dono não pode sair enquanto houver outros membros. Remova-os antes.';
  end if;
  delete from household_members where user_id = auth.uid();
  if others = 0 then delete from households where id = h; end if;
end;
$$;

-- Gera os lançamentos fixos de um mês (idempotente). Respeita RLS: só as regras da casa do usuário.
create function public.materialize_recurring(p_month date)
returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  m date := date_trunc('month', p_month)::date;
  last_day int := extract(day from (m + interval '1 month - 1 day'))::int;
  n int;
begin
  insert into transactions
    (household_id, kind, description, amount_cents, due_date, status,
     person_id, category_id, account_id, recurring_id)
  select r.household_id, r.kind, r.description, r.amount_cents,
         m + (least(r.day_of_month, last_day) - 1),
         'pending', r.person_id, r.category_id, r.account_id, r.id
  from recurring_rules r
  where r.active
    and r.start_month <= m
    and (r.end_month is null or r.end_month >= m)
  on conflict (recurring_id, due_date) where recurring_id is not null do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------- RLS --------------------------------------------------------

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.join_attempts     enable row level security;
alter table public.people            enable row level security;
alter table public.accounts          enable row level security;
alter table public.categories        enable row level security;
alter table public.recurring_rules   enable row level security;
alter table public.transactions      enable row level security;
alter table public.budgets           enable row level security;

create policy households_select on public.households
  for select using (id = (select public.current_household()));
create policy households_update on public.households
  for update using (id = (select public.current_household()))
  with check (id = (select public.current_household()));
-- Só o nome é editável direto; o código muda por rotate_invite_code().
revoke update on public.households from anon, authenticated;
grant  update (name) on public.households to authenticated;

-- household_members: leitura apenas (escrita só via funções acima)
create policy members_select on public.household_members
  for select using (household_id = (select public.current_household()));
revoke insert, update, delete on public.household_members from anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['people','accounts','categories','recurring_rules','transactions','budgets']
  loop
    execute format(
      'create policy %I on public.%I for all
         using (household_id = (select public.current_household()))
         with check (household_id = (select public.current_household()))',
      t || '_member_all', t);
  end loop;
end $$;

-- anon não enxerga nada
revoke all on all tables in schema public from anon;

-- ---------- Permissões das funções ------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'create_household(text, text)', 'join_household(text)', 'rotate_invite_code()',
    'remove_member(uuid)', 'leave_household()', 'materialize_recurring(date)',
    'current_household()', 'is_member(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Gerador interno de código: usado só pelos defaults/funções SECURITY DEFINER, não exposto à API.
revoke all on function public.new_invite_code() from public, anon, authenticated;
