# ARCH.md — 세부 아키텍처

빠른 시작은 [CLAUDE.md](./CLAUDE.md). 이 문서는 코드 구조 / 데이터 모델 / 결제 시퀀스 / RLS 정책을 자세히 다룹니다.

---

## 1. 시스템 다이어그램

```
┌──────────────────────────────────────────────────────────────────┐
│  브라우저 (HTML/CSS/JS, GitHub Pages 정적 호스팅)                │
│                                                                   │
│   ┌────────────┐  Auth, SELECT          ┌──────────────────────┐ │
│   │ HTML pages │ ─────────────────────► │ Supabase Postgres    │ │
│   │   + JS     │  (anon JWT)            │  + RLS               │ │
│   │  modules   │                        │ profiles/products/   │ │
│   └────────────┘                        │ orders               │ │
│        │                                └──────────────────────┘ │
│        │ Toss SDK <script>                                        │
│        ▼                                                          │
│   ┌────────────┐ requestPayment      ┌────────────┐               │
│   │ Toss SDK   │ ──────────────────► │ Toss 결제창│               │
│   └────────────┘                     └────────────┘               │
│                                              │                    │
│                                              │ successUrl         │
│                                              ▼                    │
│   ┌────────────────────┐  POST + JWT                              │
│   │ success.html       │ ────────────┐                            │
│   └────────────────────┘             │                            │
└──────────────────────────────────────┼────────────────────────────┘
                                       │
                                       ▼
                ┌────────────────────────────────────┐
                │ Supabase Edge Function             │
                │   confirm-payment (Deno)           │
                │     - JWT 검증 (auth.getUser)      │
                │     - amount 위변조 체크           │
                │     - Toss /v1/payments/confirm    │
                │     - orders INSERT (service_role) │
                └────────────────────────────────────┘
                                       │
                                       ▼
                              ┌────────────────┐
                              │ Toss API       │
                              └────────────────┘
```

---

## 2. 파일 / 폴더 역할

```
goods-shop/
├── CLAUDE.md             # 입문자 안내 (실행, 보안, FAQ)
├── ARCH.md               # 본 문서
├── README.md             # GitHub 첫 화면 짧은 소개
├── .gitignore
├── .nojekyll             # GitHub Pages 가 Jekyll 처리하지 않도록
│
├── index.html            # 상품 목록 (홈)
├── login.html
├── signup.html
├── checkout.html         # 토스 위젯 결제창
├── success.html          # 토스 성공 리다이렉트 → confirm-payment 호출
├── fail.html             # 토스 실패 리다이렉트
├── my-orders.html
├── admin.html
├── 404.html
│
├── css/
│   └── styles.css        # 전체 페이지 공통 스타일
│
├── js/                   # ES Module 들
│   ├── config.js         # 공개 키/URL + withTimeout helper
│   ├── supabase.js       # createClient (esm.sh)
│   ├── auth.js           # getSession / requireAuth / requireAdmin
│   ├── header.js         # 모든 페이지 상단 헤더 렌더링 + escapeHtml
│   ├── home.js           # index.html 용
│   ├── login.js
│   ├── signup.js
│   ├── checkout.js       # 토스 widgets() 마운트 + requestPayment
│   ├── success.js        # query param → confirm-payment 호출
│   ├── fail.js
│   ├── my-orders.js
│   └── admin.js
│
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init.sql                # 테이블 + RLS + 트리거 + is_admin 함수
│   │   ├── 0002_seed.sql                # 샘플 상품 5개
│   │   └── 0003_orders_profiles_fk.sql  # orders.user_id → profiles.id FK
│   └── functions/
│       └── confirm-payment/index.ts     # Deno 런타임
│
└── .github/
    └── workflows/
        └── deploy.yml    # main push → GitHub Pages 정적 업로드
```

---

## 3. 데이터 모델

### 테이블

| 테이블 | 핵심 컬럼 | 비고 |
|---|---|---|
| `public.profiles` | `id (FK auth.users)`, `email`, `is_admin`, `created_at` | 가입 시 트리거로 자동 생성 |
| `public.products` | `id`, `name`, `description`, `price`, `image_url`, `stock`, `created_at` | 상품 마스터 |
| `public.orders` | `id`, `user_id`, `product_id`, `amount`, `status` (`PENDING`/`DONE`/`FAILED`), `toss_payment_key`, `toss_order_id` (UNIQUE), `raw_response`, `created_at` | 결제 1건 = 1행. `toss_order_id` 가 멱등성 키 |

### 트리거 — `handle_new_user`
`auth.users` INSERT 시 `profiles` 행 자동 생성.

### 헬퍼 — `is_admin(uid uuid) → boolean`
RLS 정책 안에서 안전하게 admin 체크. `security definer + set search_path = public` 으로 RLS 우회.

---

## 4. RLS 정책

| 테이블 | 액션 | anon | authenticated 일반 | authenticated admin | service_role |
|---|---|---|---|---|---|
| `products` | SELECT | ✅ | ✅ | ✅ | ✅ |
| `products` | INS/UPD/DEL | ❌ | ❌ | ❌ | ✅ |
| `profiles` | SELECT | ❌ | 본인만 | 전체 | ✅ |
| `profiles` | UPDATE | ❌ | 본인만 | 본인만 | ✅ |
| `orders` | SELECT | ❌ | 본인만 | 전체 | ✅ |
| `orders` | INSERT | ❌ | ❌ | ❌ | ✅ (Edge Function 만) |

핵심 인사이트: orders INSERT 정책을 **일부러 만들지 않음** → 클라이언트는 INSERT 불가 → Edge Function (service_role) 만 가능 → 위변조 검증된 결제만 기록됨.

---

## 5. 결제 시퀀스

```
사용자       checkout.html         Toss SDK            Toss API     Edge Function     Postgres
  │              │                   │                    │              │             │
  │ 결제 클릭    │                   │                    │              │             │
  ├─────────────►│                   │                    │              │             │
  │              │ requestPayment    │                    │              │             │
  │              ├──────────────────►│                    │              │             │
  │              │                   │ 결제창 띄움        │              │             │
  │ 카드 입력 ─────────────────────►│                    │              │             │
  │              │                   │ 인증/결제 완료     │              │             │
  │              │                   │  successUrl 리다이렉트            │             │
  │ ◄────────────┴───────────────────┘                    │              │             │
  │  success.html?paymentKey=X&orderId=Y&amount=Z&productId=P            │             │
  │              │                   │                    │              │             │
  │  success.js 마운트                                    │              │             │
  │       │ getSession() → access_token                   │              │             │
  │       │ POST /functions/v1/confirm-payment   { paymentKey, orderId, amount, productId }
  │       ├────────────────────────────────────────────────────────────►│             │
  │       │                                              │              │ auth.getUser │
  │       │                                              │              ├─► JWT 검증   │
  │       │                                              │              │              │
  │       │                                              │              │ products SEL │
  │       │                                              │              ├─────────────►│
  │       │                                              │              │ amount 비교  │
  │       │                                              │              │              │
  │       │                                              │ POST /v1/payments/confirm    │
  │       │                                              │ ◄────────────┤ Basic auth   │
  │       │                                              │ 결제 승인 응답│              │
  │       │                                              │ ────────────►│              │
  │       │                                              │              │ orders INS   │
  │       │                                              │              ├─────────────►│
  │       │ ◄────────────────────────────────────────────│ {ok,orderRowId}             │
  │  ✅ 결제 완료 화면                                    │              │              │
```

---

## 6. URL 구조

| URL | 페이지 |
|---|---|
| `/index.html` (또는 `/`) | 상품 목록 |
| `/login.html` | 로그인 |
| `/signup.html` | 회원가입 |
| `/checkout.html?productId=UUID` | 결제 |
| `/success.html?paymentKey=...&orderId=...&amount=...&productId=...` | 결제 성공 |
| `/fail.html?code=...&message=...` | 결제 실패 |
| `/my-orders.html` | 내 결제 내역 |
| `/admin.html` | 관리자 |

GitHub Pages 배포 시 prefix 가 `/goods-shop/` 라 실제 URL 은 `https://davelee-fun.github.io/goods-shop/index.html` 등.

---

## 7. Toss 결제 페이로드

### requestPayment (checkout.js)
```js
await widgets.requestPayment({
  orderId,                    // 우리가 생성하는 unique ID
  orderName: product.name,
  successUrl: `${baseUrl}success.html?productId=${product.id}`,
  failUrl:    `${baseUrl}fail.html`,
  customerEmail: session.user.email,
})
```

### confirm-payment 요청 body
```json
{
  "paymentKey": "...",
  "orderId":    "...",
  "amount":     12000,
  "productId":  "uuid"
}
```

### 응답
- 성공: `{ "ok": true, "orderRowId": "uuid", "toss": { ... } }`
- 멱등 처리(이미 confirmed): `{ "ok": true, "alreadyConfirmed": true, "orderRowId": "uuid" }`
- 실패: `{ "error": "...", "detail": ... }` (4xx/5xx)

---

## 8. 환경변수 흐름

```
[클라이언트]
  js/config.js 에 공개 값 직접 박힘 (SUPABASE_URL, ANON_KEY, TOSS_CLIENT_KEY, CONFIRM_FUNCTION_URL)
       │
       └─→ js/supabase.js → createClient
       └─→ js/checkout.js → window.TossPayments(CONFIG.TOSS_CLIENT_KEY)
       └─→ js/success.js → fetch(CONFIG.CONFIRM_FUNCTION_URL, ...)

[Edge Function]
  Supabase Dashboard / supabase secrets set 에서 TOSS_SECRET_KEY 설정
  SUPABASE_URL / SERVICE_ROLE_KEY / ANON_KEY 는 런타임 자동 주입
       │
       └─→ Deno.env.get('TOSS_SECRET_KEY') 등으로 사용
```

---

## 9. 운영 / 디버깅 명령

```bash
# Edge Function 로그
supabase functions logs confirm-payment --project-ref sdpqzfwzbbafjosusjik

# Edge Function 재배포
supabase functions deploy confirm-payment --project-ref sdpqzfwzbbafjosusjik

# 시크릿 추가/갱신
supabase secrets set TOSS_SECRET_KEY=test_gsk_docs_... --project-ref sdpqzfwzbbafjosusjik

# DB 쿼리 (Dashboard SQL Editor 또는 psql)
select * from public.orders order by created_at desc limit 20;
```

---

## 10. 향후 확장 아이디어

- **재고 차감**: Edge Function 안에서 결제 성공 시 `update products set stock = stock - 1 where id = ... and stock > 0` 트랜잭션
- **장바구니**: cart 테이블 추가, Checkout 시 합계 amount 로 결제
- **이미지 업로드**: Supabase Storage 버킷 + 관리자 UI
- **결제 취소/환불**: Toss `payments/{paymentKey}/cancel` 별도 Edge Function
- **알림 메일**: Resend, Postmark 등 외부 서비스로 결제 완료 이메일
