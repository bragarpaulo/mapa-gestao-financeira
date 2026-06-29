-- 0010_seat_limit.sql — Enforça o limite de membros de equipe (seats) por plano.
-- Espelha enforce_company_limit/user_max_companies (0001). max_seats = nº de MEMBROS além do dono.

-- Quantos membros o dono pode ter (default 1 se não houver assinatura ativa com plano).
create or replace function public.user_max_seats(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select pl.max_seats from public.subscriptions s
                   join public.plans pl on pl.code = s.plan_code
                   where s.owner_id = uid and s.status in ('active','trialing') limit 1), 1);
$$;
revoke all on function public.user_max_seats(uuid) from anon;

-- Bloqueia inserir membro acima do limite do plano do DONO da conta (vale p/ admin e p/ o próprio dono).
create or replace function public.enforce_seat_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare usados int; lim int;
begin
  lim := public.user_max_seats(new.account_owner_id);
  select count(*) into usados from public.members
    where account_owner_id = new.account_owner_id and member_id <> new.member_id;  -- re-add do mesmo membro não conta
  if usados >= lim then
    raise exception 'Limite de % membro(s) de equipe do plano atingido. Faça upgrade do plano.', lim
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;
drop trigger if exists trg_seat_limit on public.members;
create trigger trg_seat_limit before insert on public.members
  for each row execute function public.enforce_seat_limit();
