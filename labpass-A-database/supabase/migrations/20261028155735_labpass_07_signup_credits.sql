-- New students get the weekly sponsored budget straight away, instead of waiting for the next
-- Monday top-up (otherwise a new sign-up has 0 credits and cannot book anything).
-- The grant goes through the ledger, so it is audited like every other credit change.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.email)
  on conflict (id) do nothing;
  if found then
    perform private._audit('signup_credits', 'Starting sponsored credits');
    perform private._credit(new.id, private._cfg('weekly_credit_budget')::int, 'Starting sponsored credits', null);
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
