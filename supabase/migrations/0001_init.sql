-- ============================================================
-- 0001_init.sql
-- profiles / products / orders 테이블 + RLS + 신규 가입 트리거
-- ============================================================

-- profiles: auth.users 와 1:1 (가입 시 트리거로 자동 생성)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- products: 판매 상품
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  price       integer not null check (price >= 0),
  image_url   text,
  stock       integer not null default 0 check (stock >= 0),
  created_at  timestamptz not null default now()
);

-- orders: 결제 내역
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  product_id       uuid not null references public.products(id),
  amount           integer not null check (amount >= 0),
  status           text not null check (status in ('PENDING','DONE','FAILED')),
  toss_payment_key text,
  toss_order_id    text unique,
  raw_response     jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists orders_user_id_idx    on public.orders(user_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);

-- ============================================================
-- 신규 가입 → profiles 자동 생성 트리거
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS 활성화
-- ============================================================
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders   enable row level security;

-- 어드민 여부 체크 헬퍼 (RLS 정책 안에서 재귀 호출 회피용)
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false)
$$;

-- profiles 정책
drop policy if exists "profiles select own or admin" on public.profiles;
create policy "profiles select own or admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- products 정책: 누구나 SELECT (비로그인 포함). 쓰기는 service_role만.
drop policy if exists "products read all" on public.products;
create policy "products read all"
  on public.products for select
  to anon, authenticated
  using (true);

-- orders 정책: 본인 것 또는 admin만 SELECT. INSERT/UPDATE는 Edge Function(service_role)만.
drop policy if exists "orders select own or admin" on public.orders;
create policy "orders select own or admin"
  on public.orders for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
