// js/admin.js
import { supabase } from './supabase.js'
import { withTimeout } from './config.js'
import { requireAdmin } from './auth.js'
import { escapeHtml } from './header.js'

const area = document.getElementById('admin-area')

;(async () => {
  const session = await requireAdmin()
  if (!session) return

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('orders')
        .select('id, user_id, amount, status, toss_order_id, created_at, product:products(name), profile:profiles(email)')
        .order('created_at', { ascending: false }),
      12000, '관리자 주문 조회'
    )
    if (error) throw error
    render(data ?? [])
  } catch (e) {
    area.innerHTML = `<div class="alert alert-error"><strong>주문 조회 실패</strong><div>${escapeHtml(e?.message ?? String(e))}</div></div>`
  }
})()

function render(orders) {
  const total = orders.filter(o => o.status === 'DONE').reduce((s, o) => s + o.amount, 0)
  area.innerHTML = `
    <p class="admin-summary">완료 합계: <strong>${total.toLocaleString()}원</strong> · 총 ${orders.length}건</p>
    <div class="table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>일시</th>
            <th>사용자</th>
            <th>상품</th>
            <th class="right">금액</th>
            <th>상태</th>
            <th>orderId</th>
          </tr>
        </thead>
        <tbody>
          ${orders.length === 0
            ? '<tr><td colspan="6" class="empty">결제 내역이 없습니다.</td></tr>'
            : orders.map(o => `
              <tr>
                <td>${new Date(o.created_at).toLocaleString('ko-KR')}</td>
                <td>${escapeHtml(o.profile?.email ?? o.user_id.slice(0,8))}</td>
                <td>${escapeHtml(o.product?.name ?? '-')}</td>
                <td class="right">${o.amount.toLocaleString()}원</td>
                <td><span class="status-badge status-${o.status}">${o.status}</span></td>
                <td class="order-id">${escapeHtml(o.toss_order_id ?? '')}</td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    </div>
  `
}
