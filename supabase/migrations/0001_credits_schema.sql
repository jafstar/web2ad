-- Genstock credits ledger — per mailbox/artifacts/gen-stock/genstock-credits-schema.md
-- Uses Supabase's built-in auth.users rather than a duplicate users table.
-- Decision: credits bank indefinitely, no expiry (no expires_at column).

create table if not exists credit_balances (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  balance    integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists purchases (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text not null unique, -- idempotency key: prevents double-crediting on webhook retry
  pack              text not null,        -- '$10' | '$20'
  credits_granted   integer not null,
  amount_cents      integer not null,
  status            text not null default 'completed', -- 'completed' | 'refunded'
  created_at        timestamptz not null default now()
);

create table if not exists credit_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null,    -- 'round' | 'export' | 'purchase' | 'free_grant'
  amount        integer not null, -- negative for debits, positive for credits
  api_cost_usd  numeric,
  round_tier    text,             -- 'low' | 'high', nullable
  created_at    timestamptz not null default now()
);

create index if not exists credit_transactions_user_id_idx on credit_transactions(user_id);
create index if not exists purchases_user_id_idx on purchases(user_id);

alter table credit_balances enable row level security;
alter table purchases enable row level security;
alter table credit_transactions enable row level security;

-- Users can read their own rows; all writes go through the service-role
-- key from server-side API routes (checkout, webhook, generate), never
-- directly from the browser — so no insert/update policies are needed.
create policy "read own balance" on credit_balances for select using (auth.uid() = user_id);
create policy "read own purchases" on purchases for select using (auth.uid() = user_id);
create policy "read own transactions" on credit_transactions for select using (auth.uid() = user_id);

-- New user gets a starting balance automatically (free_grant), no manual
-- provisioning step needed on sign-up.
--
-- Real bug, live-caught: this fired as part of GoTrue's own signup
-- transaction (auth.users insert), which runs as supabase_auth_admin —
-- a role with a deliberately restricted search_path that does NOT
-- include public by default (Supabase's own hardening against exactly
-- this "trigger on auth.users" pattern). SECURITY DEFINER alone doesn't
-- fix this: it runs with the DEFINER's privileges, but still resolves
-- unqualified names against the CALLER's search_path unless one is set
-- explicitly. Unqualified `credit_balances`/`credit_transactions` failed
-- to resolve, GoTrue wrapped the real Postgres error into a generic
-- "Database error saving new user" 500 — confirmed by testing signup
-- with the trigger dropped (worked) vs present (failed every time).
create or replace function grant_signup_credits()
returns trigger as $$
begin
  insert into public.credit_balances (user_id, balance) values (new.id, 3);
  insert into public.credit_transactions (user_id, type, amount) values (new.id, 'free_grant', 3);
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists on_auth_user_created_grant_credits on auth.users;
create trigger on_auth_user_created_grant_credits
  after insert on auth.users
  for each row execute function grant_signup_credits();

-- Atomic check-and-debit — per the schema doc's own warning: debiting
-- credit_balances and logging credit_transactions must happen in the same
-- DB transaction, or a failed generation after a debit (or vice versa)
-- leaves someone charged with nothing to show for it. A single plpgsql
-- function called via RPC is the real transaction boundary here — the
-- JS/REST client has no multi-statement transaction of its own.
create or replace function debit_credits(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_api_cost_usd numeric default null,
  p_round_tier text default null
)
returns integer as $$
declare
  v_balance integer;
begin
  select balance into v_balance from public.credit_balances where user_id = p_user_id for update;
  if v_balance is null then
    raise exception 'no credit_balances row for user %', p_user_id;
  end if;
  if v_balance < p_amount then
    raise exception 'insufficient_credits';
  end if;

  update public.credit_balances set balance = balance - p_amount, updated_at = now() where user_id = p_user_id;
  insert into public.credit_transactions (user_id, type, amount, api_cost_usd, round_tier)
    values (p_user_id, p_type, -p_amount, p_api_cost_usd, p_round_tier);

  return v_balance - p_amount;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Used by the Stripe webhook — credits a purchase and logs it, guarded by
-- purchases.stripe_session_id's unique constraint against webhook retries
-- (the insert itself fails on a duplicate session id, which the caller
-- treats as "already processed", not an error).
create or replace function credit_purchase(
  p_user_id uuid,
  p_stripe_session_id text,
  p_pack text,
  p_credits_granted integer,
  p_amount_cents integer
)
returns void as $$
begin
  insert into public.purchases (user_id, stripe_session_id, pack, credits_granted, amount_cents)
    values (p_user_id, p_stripe_session_id, p_pack, p_credits_granted, p_amount_cents);

  insert into public.credit_balances (user_id, balance) values (p_user_id, p_credits_granted)
    on conflict (user_id) do update set balance = public.credit_balances.balance + p_credits_granted, updated_at = now();

  insert into public.credit_transactions (user_id, type, amount, api_cost_usd)
    values (p_user_id, 'purchase', p_credits_granted, p_amount_cents / 100.0);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
