// js/checkout.js
import { supabase } from './supabase.js'
import { CONFIG, withTimeout, getBaseUrl } from './config.js'
import { requireAuth } from './auth.js'
import { escapeHtml } from './header.js'

const area = document.getElementById('checkout-area')

;(async () => {
  const session = await requireAuth()
  if (!session) return // requireAuth가 이미 redirect

  // 1) productId 파싱
  const params = new URLSearchParams(location.search)
  const productId = params.get('productId')
  if (!productId) { showError('잘못된 접근', 'productId가 없습니다.'); return }

  // 2) 상품 로드
  let product
  try {
    const { data, error } = await withTimeout(
      supabase.from('products').select('*').eq('id', productId).single(),
      12000, '상품 조회'
    )
    if (error) throw error
    product = data
  } catch (e) {
    showError('상품 조회 실패', e?.message ?? String(e))
    return
  }

  renderForm(product, session.user.email)

  // 3) Toss 위젯 마운트
  let widgets
  try {
    if (typeof window.TossPayments !== 'function') {
      throw new Error('Toss SDK 로드 실패. 네트워크나 광고 차단기를 확인해주세요.')
    }
    const tossPayments = window.TossPayments(CONFIG.TOSS_CLIENT_KEY)
    widgets = tossPayments.widgets({ customerKey: 'ANONYMOUS' })
    await widgets.setAmount({ currency: 'KRW', value: product.price })
    await Promise.all([
      widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
      widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' }),
    ])
    document.getElementById('widget-status').textContent = ''
    const payBtn = document.getElementById('pay-btn')
    payBtn.disabled = false
  } catch (e) {
    showError('결제창 로드 실패', e?.message ?? String(e))
    return
  }

  // 4) 결제 클릭
  document.getElementById('pay-btn').addEventListener('click', async () => {
    const payBtn = document.getElementById('pay-btn')
    payBtn.disabled = true
    payBtn.textContent = '결제창 여는 중...'
    try {
      const orderId = `order_${product.id}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
      const base = getBaseUrl()
      const successUrl = `${base}success.html?productId=${encodeURIComponent(product.id)}`
      const failUrl    = `${base}fail.html`
      await widgets.requestPayment({
        orderId,
        orderName: product.name,
        successUrl,
        failUrl,
        customerEmail: session.user.email,
      })
    } catch (e) {
      showError('결제 요청 실패', e?.message ?? String(e))
    }
  })
})()

function renderForm(product, email) {
  area.innerHTML = `
    <div class="checkout-card">
      <div class="summary">
        ${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}"/>` : ''}
        <div class="info">
          <div class="name">${escapeHtml(product.name)}</div>
          <div class="muted text-sm">${escapeHtml(product.description ?? '')}</div>
          <div class="price">${product.price.toLocaleString()}원</div>
          <div class="muted text-sm">결제자: ${escapeHtml(email)}</div>
        </div>
      </div>
      <p id="widget-status" class="muted text-sm">결제창 준비 중... <span class="text-sm muted">(최대 15초)</span></p>
      <div id="payment-method"></div>
      <div id="agreement"></div>
      <button id="pay-btn" disabled class="btn btn-blue btn-block">${product.price.toLocaleString()}원 결제하기</button>
      <p class="note">※ 토스 테스트 모드입니다. 결제 정보는 실제로 청구되지 않아요.</p>
    </div>
  `
}

function showError(title, msg) {
  area.innerHTML = `
    <div class="alert alert-error">
      <strong>${escapeHtml(title)}</strong>
      <div>${escapeHtml(msg)}</div>
    </div>
    <p class="mt-3"><a href="index.html" class="btn btn-outline">홈으로</a></p>
  `
}
