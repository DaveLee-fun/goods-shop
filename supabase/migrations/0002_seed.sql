-- ============================================================
-- 0002_seed.sql
-- 샘플 굿즈 상품
-- ============================================================
insert into public.products (name, description, price, image_url, stock) values
  ('잔재미코딩 머그컵',     '개발자를 위한 따뜻한 한 잔. 350ml 세라믹.',         12000, 'https://picsum.photos/seed/mug/600/600',     50),
  ('잔재미코딩 후드티',     '부드러운 면 100% 후드티. 블랙 / S~XL.',              39000, 'https://picsum.photos/seed/hoodie/600/600',  30),
  ('잔재미코딩 스티커팩',   '노트북에 붙이는 굿즈 스티커 12종 세트.',             5000,  'https://picsum.photos/seed/stickers/600/600',100),
  ('잔재미코딩 에코백',     '튼튼한 캔버스 에코백. 책 5권 거뜬.',                 15000, 'https://picsum.photos/seed/ecobag/600/600',  40),
  ('잔재미코딩 키링',       '메탈 키링 + 미니 LED. 가방 포인트 굿즈.',            7000,  'https://picsum.photos/seed/keyring/600/600', 80)
on conflict do nothing;
