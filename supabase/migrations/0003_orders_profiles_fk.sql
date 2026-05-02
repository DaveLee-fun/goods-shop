-- ============================================================
-- 0003_orders_profiles_fk.sql
-- orders.user_id 가 auth.users 만 참조하면 PostgREST 가 orders ↔ profiles join 을 못한다.
-- profiles.id 도 함께 참조하도록 FK 추가 (profiles.id = auth.users.id 라 의미상 동일).
-- ============================================================
alter table public.orders
  add constraint orders_user_id_profiles_fk
  foreign key (user_id) references public.profiles(id) on delete cascade;
