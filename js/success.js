// js/success.js
import { supabase } from './supabase.js'
import { CONFIG } from './config.js'
import { requireAuth } from './auth.js'
import { escapeHtml } from './header.js'

const area = document.getElementById('result-area')

;(async () => {
  const session = await requireAuth()
  if (!session) return

  const params = new URLSearchParams(location.search)
  const paymentKey = params.get('paymentKey') ?? ''
  const orderId    = params.get('orderId') ?? ''
  const amountStr  = params.get('amount') ?? ''
  const productId  = params.get('productId') ?? ''
  const amount = Number(amountStr)

  if (!paymentKey || !orderId || !amount || !productId) {
    return renderError('필수 파라미터 누락',
      `paymentKey/orderId/amount/productId 중 하나가 비어있어요. 현재 query: ${location.search}`)
  }

  try {
    const resp = await fetch(CONFIG.CONFIRM_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ paymentKey, orderId, amount, productId }),
    })
    const result = await resp.json()
    if (!resp.ok || !result.ok) {
      return renderError('결제 확인 실패', JSON.stringify(result, null, 2))
    }
    renderOk(result.orderRowId)
  } catch (e) {
    renderError('결제 확인 통신 실패', e?.message ?? String(e))
  }
})()

function renderOk(orderRowId) {
  area.innerHTML = `
    <div class="icon">✅</div>
    <h1>결제 완료!</h1>
    <p>주문 번호: <code>${escapeHtml(orderRowId)}</code></p>
    <p class="mt-3"><a href="my-orders.html" class="btn btn-primary">내 결제 내역으로</a></p>
  `
}
function renderError(title, msg) {
  area.innerHTML = `
    <div class="icon">⚠️</div>
    <h1>${escapeHtml(title)}</h1>
    <pre class="alert alert-error" style="text-align:left;white-space:pre-wrap;">${escapeHtml(msg)}</pre>
    <p class="mt-3"><a href="index.html" class="btn btn-outline">홈으로</a></p>
  `
}
