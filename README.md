# goods-shop

작은 굿즈 판매 데모 사이트. **GitHub Pages + Supabase + 토스페이먼트(테스트 모드)**.
프론트엔드는 **순수 HTML/CSS/JavaScript** (빌드 도구 없음).

🌐 **Live**: https://davelee-fun.github.io/goods-shop/

## 기능
- 회원가입 / 로그인 (Supabase Auth, 이메일 인증 OFF)
- 상품 목록 + 결제 (토스 위젯 v2)
- 내 결제 내역
- 관리자 — 모든 사람 결제 내역 (`admin@admin.com` / `superadmin`)

## 로컬 실행
```bash
python3 -m http.server 8000
# 브라우저 → http://localhost:8000/
```

## 더 보기
- [CLAUDE.md](./CLAUDE.md) — 입문자용 핵심 안내
- [ARCH.md](./ARCH.md) — 데이터 모델 / 결제 시퀀스 / RLS

## 라이선스
MIT (예제 프로젝트)
