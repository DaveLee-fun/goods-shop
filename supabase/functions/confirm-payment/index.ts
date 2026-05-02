// supabase/functions/confirm-payment/index.ts
// 토스페이먼트 결제 confirm + orders 기록 (서버사이드)
//
// 호출 형태:
//   POST {SUPABASE_URL}/functions/v1/confirm-payment
//   Headers: Authorization: Bearer {로그인 유저 JWT}
//   Body:    { paymentKey, orderId, amount, productId }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// 운영 origin + 로컬 개발 origin (localhost / 127.0.0.1 + 모든 포트) 허용
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin === "https://davelee-fun.github.io") return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

function corsHeaders(origin: string | null): HeadersInit {
  const allow = isAllowedOrigin(origin) ? origin! : "https://davelee-fun.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  // 1) 사용자 식별 (JWT)
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Missing Authorization" }, 401, origin);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
  const TOSS_SECRET  = Deno.env.get("TOSS_SECRET_KEY")!;

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Invalid token" }, 401, origin);
  const user = userData.user;

  // 2) 입력 파싱
  let body: { paymentKey?: string; orderId?: string; amount?: number; productId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }
  const { paymentKey, orderId, amount, productId } = body;
  if (!paymentKey || !orderId || typeof amount !== "number" || !productId) {
    return json({ error: "Missing required fields" }, 400, origin);
  }

  // 3) 금액 위변조 검증
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: product, error: prodErr } = await admin
    .from("products")
    .select("id, price")
    .eq("id", productId)
    .single();
  if (prodErr || !product) return json({ error: "Product not found" }, 404, origin);
  if (product.price !== amount) {
    return json({ error: "Amount mismatch" }, 400, origin);
  }

  // 4) 멱등성: 이미 처리된 toss_order_id 면 그대로 반환
  const { data: existing } = await admin
    .from("orders")
    .select("id, status")
    .eq("toss_order_id", orderId)
    .maybeSingle();
  if (existing && existing.status === "DONE") {
    return json({ ok: true, alreadyConfirmed: true, orderRowId: existing.id }, 200, origin);
  }

  // 5) 토스 confirm 호출
  const tossAuth = "Basic " + btoa(`${TOSS_SECRET}:`);
  const tossResp = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: { Authorization: tossAuth, "Content-Type": "application/json" },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const tossJson = await tossResp.json();

  if (!tossResp.ok) {
    await admin.from("orders").insert({
      user_id: user.id,
      product_id: productId,
      amount,
      status: "FAILED",
      toss_payment_key: paymentKey,
      toss_order_id: orderId,
      raw_response: tossJson,
    });
    return json({ error: "Toss confirm failed", detail: tossJson }, 400, origin);
  }

  // 6) orders 기록
  const { data: inserted, error: insErr } = await admin
    .from("orders")
    .insert({
      user_id: user.id,
      product_id: productId,
      amount,
      status: "DONE",
      toss_payment_key: paymentKey,
      toss_order_id: orderId,
      raw_response: tossJson,
    })
    .select("id")
    .single();
  if (insErr) return json({ error: "DB insert failed", detail: insErr.message }, 500, origin);

  return json({ ok: true, orderRowId: inserted.id, toss: tossJson }, 200, origin);
});
