// js/my-orders.js
import { supabase } from './supabase.js'
import { withTimeout } from './config.js'
import { requireAuth } from './auth.js'
import { escapeHtml } from './header.js'

const area = document.getElementById('orders-area')

;(async () => {
  const session = await requireAuth()
  if (!session) return

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('orders')
        .select('id, amount, status, toss_order_id, created_at, product:products(name, image_url)')
        .order('created_at', { ascending: false }),
      12000, '내 주문 조회'
    )
    if (error) throw error
    render(data ?? [])
  } catch (e) {
    area.innerHTML = `<div class="alert alert-error"><strong>주문 조회 실패</strong><div>${escapeHtml(e?.message ?? String(e))}</div></div>`
  }
})()

function render(orders) {
  if (orders.length === 0) {
    area.innerHTML = '<p class="empty">아직 결제 내역이 없어요.</p>'
    return
  }
  area.innerHTML = `
    <div class="orders-list">
      ${orders.map(o => `
        <div class="row">
          ${o.product?.image_url ? `<img src="${escapeHtml(o.product.image_url)}" alt=""/>` : ''}
          <div class="info">
            <div class="name">${escapeHtml(o.product?.name ?? '(상품 정보 없음)')}</div>
            <div class="meta">${new Date(o.created_at).toLocaleString('ko-KR')}</div>
            <div class="meta order-id">${escapeHtml(o.toss_order_id ?? '')}</div>
          </div>
          <div class="right">
            <div class="amount">${o.amount.toLocaleString()}원</div>
            <span class="status-badge status-${o.status}">${o.status}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `
}
