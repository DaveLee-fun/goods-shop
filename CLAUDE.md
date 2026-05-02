# goods-shop — 입문자용 핵심 안내

작은 굿즈 판매 사이트. **GitHub Pages**(정적 호스팅) + **Supabase**(인증·DB·서버리스 함수) + **토스페이먼트 테스트 모드**.
프론트엔드는 **순수 HTML / CSS / JavaScript** 입니다 (빌드 도구 없음).

> 코드 구조 / 데이터 모델 / 결제 시퀀스 등 자세한 내용은 [ARCH.md](./ARCH.md) 를 보세요.

---

## 1. 빠른 실행 (로컬)

빌드 단계가 없어서 **그냥 정적 서버로 띄우면 끝**입니다.

```bash
# 프로젝트 루트에서:
python3 -m http.server 8000
# 또는
npx -y serve -l 8000 .
```

브라우저에서 `http://localhost:8000/` 열기.

> **포트 주의**: Edge Function 의 CORS 가 `localhost`/`127.0.0.1` 의 모든 포트를 허용해두었으니 어떤 포트든 OK.

---

## 2. 사이트 구조

| URL | 페이지 | 권한 |
|---|---|---|
| `index.html` | 상품 목록 (홈) | 누구나 |
| `login.html` | 로그인 | 누구나 |
| `signup.html` | 회원가입 | 누구나 |
| `checkout.html?productId=XXX` | 결제 (토스 위젯) | 로그인 필요 |
| `success.html?paymentKey=...&orderId=...&amount=...&productId=...` | 토스 성공 리다이렉트 | 로그인 필요 |
| `fail.html?code=...&message=...` | 토스 실패 리다이렉트 | 로그인 필요 |
| `my-orders.html` | 내 결제 내역 | 로그인 필요 |
| `admin.html` | 모든 사람 결제 내역 | admin 만 |

---

## 3. 미리 등록된 계정

| 이메일 | 비밀번호 | 권한 |
|---|---|---|
| `admin@admin.com` | `superadmin` | 관리자 |

새 계정은 `signup.html` 에서 즉시 만들 수 있어요 (이메일 인증 끔).

---

## 4. 토스 테스트 결제

- 카드 번호: `4330-1234-1234-1234`
- 만료일/CVC/비밀번호: 임의값
- 토스 docs 키 (test_gck_docs_*) 라 **실제 청구 안 됨** (토스 대시보드에도 안 잡힘)

---

## 5. 아키텍처 한눈에

```
[브라우저 (정적 HTML/JS, GitHub Pages)]
   │
   ├─ Auth, products SELECT, my orders SELECT  ──→  Supabase (RLS 적용)
   │
   ├─ Toss SDK 결제창 띄우기 (브라우저)
   │      └─ 성공 시 successUrl 리다이렉트
   │             │
   ▼             ▼
[success.html]  POST(JWT) → Supabase Edge Function `confirm-payment`
                                       │ (TOSS_SECRET_KEY 보유)
                                       ▼
                                   Toss API 결제 승인 + orders INSERT
```

**Edge Function 이 필요한 이유**: GitHub Pages 는 정적 파일만 호스팅 → 비밀키(토스 secret, supabase service_role)를 숨길 곳이 없음 → 비밀키가 필요한 작업은 Supabase Edge Function 안에서만.

---

## 6. 환경 / 설정 위치

**공개 값** (브라우저에 노출돼도 안전): `js/config.js` 에 직접 박혀있어요.
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (RLS 가 보호)
- `TOSS_CLIENT_KEY` (test_gck_docs_*)
- `CONFIRM_FUNCTION_URL`

**비밀 값** (Supabase Edge Function 환경변수로만):
- `TOSS_SECRET_KEY` — `supabase secrets set TOSS_SECRET_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase 가 자동 주입

---

## 7. 보안 핵심 (입문자가 꼭 알 것)

1. **anon key 는 브라우저에 노출 OK** — RLS 가 막아줌
2. **service_role / 토스 secret 은 절대 클라이언트에 두지 않음** — Edge Function 안에서만
3. **결제 금액은 서버에서 다시 검증** — 클라이언트가 보낸 amount 를 그대로 믿지 않고 DB 의 product.price 와 비교
4. **orders 테이블은 클라이언트가 INSERT 못 함** — RLS 에 INSERT 정책이 없음 → Edge Function (service_role) 만 가능

---

## 8. 자주 막히는 곳 (FAQ)

**Q. "상품 불러오는 중..." 에서 멈춰요**
A. 브라우저가 `supabase.co` 를 못 부르는 환경입니다. 12초 뒤 빨간 에러 박스가 떠요. 가능 원인:
- 광고 차단기 / uBlock / AdGuard 같은 확장 프로그램
- 회사·학교 방화벽
- VPN 또는 공공 Wi-Fi 의 트래픽 필터링

→ 시크릿 / InPrivate 창에서 같은 증상인지 확인 (같으면 네트워크, 다르면 확장 프로그램)

**Q. 토스 결제는 성공했는데 "결제 확인 실패" 에러가 떠요**
A. Edge Function 로그 확인:
```bash
supabase functions logs confirm-payment --project-ref sdpqzfwzbbafjosusjik
```
보통 CORS 또는 `TOSS_SECRET_KEY` 미설정이 원인.

**Q. "결제위젯 연동 키의 클라이언트 키로 SDK를 연동해주세요"**
A. 토스는 두 종류 키를 구분해요:
- `test_ck_*` / `test_sk_*` — API 직접 호출용
- `test_gck_*` / `test_gsk_*` — **결제위젯 SDK용** (이 프로젝트가 사용)
이 프로젝트는 `test_gck_docs_*` (클라이언트) + `test_gsk_docs_*` (시크릿) 사용 중.

**Q. 새로고침하면 페이지가 사라져요?**
A. 그럴 일 없어요. 모든 페이지가 진짜 `.html` 파일이라 새로고침해도 그대로 보입니다.

---

## 9. 배포

`main` 브랜치 push → GitHub Actions(`.github/workflows/deploy.yml`) 가 정적 파일 그대로 GitHub Pages 에 업로드. 빌드 단계 없음.

배포 주소: https://davelee-fun.github.io/goods-shop/
