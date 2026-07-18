-- Real bug fix, live-caught: grant_signup_credits fired as part of
-- GoTrue's own auth.users insert (role supabase_auth_admin, a
-- deliberately restricted search_path that excludes public by default —
-- Supabase's own hardening against this exact "trigger on auth.users"
-- pattern). SECURITY DEFINER alone doesn't fix unqualified-name
-- resolution; it runs with the DEFINER's privileges but still resolves
-- names against the CALLER's search_path unless one is set explicitly.
-- Confirmed by testing signup with the trigger dropped (200 OK) vs
-- present (500 "Database error saving new user") every time.
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

-- Not currently broken (service_role's search_path includes public), but
-- the same defense-in-depth fix for consistency — every SECURITY DEFINER
-- function here should be immune to caller search_path regardless.
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
