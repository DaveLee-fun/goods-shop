// js/config.js
// 모두 클라이언트에 노출되어도 안전한 공개 값들이다.
// - SUPABASE_ANON_KEY: anon은 RLS로 보호됨 (브라우저 노출 OK)
// - TOSS_CLIENT_KEY: 토스가 공개한 docs용 결제위젯 클라이언트 키
// - 비밀 값(SUPABASE_SERVICE_ROLE_KEY, TOSS_SECRET_KEY)은 절대 여기 두지 않는다.
//   그것들은 Supabase Edge Function 안에서만 사용한다.

export const CONFIG = {
  SUPABASE_URL: 'https://sdpqzfwzbbafjosusjik.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkcHF6Znd6YmJhZmpvc3VzamlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MDAwMDAsImV4cCI6MjA5MzI3NjAwMH0.0WvLMvegyeMByH5bk8PDodBms95ciWK93khXnLXP2tc',
  TOSS_CLIENT_KEY: 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm',
  CONFIRM_FUNCTION_URL: 'https://sdpqzfwzbbafjosusjik.supabase.co/functions/v1/confirm-payment',
}

// 현재 페이지의 폴더 경로(파일명 제외) — 토스 successUrl/failUrl 만들 때 사용
export function getBaseUrl() {
  return location.origin + location.pathname.replace(/[^/]*$/, '')
}

// fetch가 무한 대기에 빠지지 않게 timeout
export function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(
      `${label}이(가) ${ms / 1000}초 내에 응답하지 않았습니다. ` +
      `광고 차단기, 사내 방화벽, 또는 네트워크가 'supabase.co' 도메인을 막고 있을 수 있습니다. ` +
      `시크릿/InPrivate 창에서 동일 증상인지 확인해보세요.`
    )), ms)
    Promise.resolve(promise).then(
      v => { clearTimeout(t); resolve(v) },
      e => { clearTimeout(t); reject(e) },
    )
  })
}
