// js/home.js
import { supabase } from './supabase.js'
import { withTimeout } from './config.js'
import { getCurrentUser } from './auth.js'
import { escapeHtml } from './header.js'

const area = document.getElementById('products-area')
const notice = document.getElementById('login-notice')

async function load() {
  area.innerHTML = '<p class="loading">상품 불러오는 중... <span class="text-sm muted">(최대 12초)</span></p>'

  // 로그인 안 했으면 안내
  const user = await getCurrentUser()
  if (!user) {
    notice.innerHTML = `<div class="alert alert-info">결제하려면 먼저 <a href="login.html">로그인</a>해주세요.</div>`
  } else {
    notice.innerHTML = ''
  }

  try {
    const { data, error } = await withTimeout(
      supabase.from('products').select('*').order('created_at', { ascending: true }),
      12000, '상품 목록 조회'
    )
    if (error) throw error
    if (!data || data.length === 0) {
      area.innerHTML = '<p class="empty">등록된 상품이 없어요.</p>'
      return
    }
    renderProducts(data, !!user)
  } catch (e) {
    area.innerHTML = renderErrorBox('상품 조회 실패', e?.message ?? String(e))
    bindRetry()
  }
}

function renderProducts(products, isLoggedIn) {
  area.innerHTML = `
    <div class="products">
      ${products.map(p => `
        <article class="product">
          ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy" />` : ''}
          <div class="body">
            <h3>${escapeHtml(p.name)}</h3>
            <p class="desc">${escapeHtml(p.description ?? '')}</p>
            <p class="price">${p.price.toLocaleString()}원</p>
            <p class="stock">재고 ${p.stock}개</p>
            ${isLoggedIn
              ? `<a class="btn btn-primary" href="checkout.html?productId=${encodeURIComponent(p.id)}">결제하기</a>`
              : `<a class="btn btn-outline" href="login.html">로그인 후 결제</a>`}
          </div>
        </article>
      `).join('')}
    </div>
  `
}

function renderErrorBox(title, msg) {
  return `
    <div class="alert alert-error">
      <strong>${escapeHtml(title)}</strong>
      <div>${escapeHtml(msg)}</div>
      <div class="diag">진단: SUPABASE URL <code>${location.host}</code> 에서 <code>sdpqzfwzbbafjosusjik.supabase.co</code> 로의 fetch 가 차단되었을 수 있어요.</div>
      <button id="retry-btn" class="btn btn-danger mt-3">다시 시도</button>
    </div>
  `
}
function bindRetry() {
  document.getElementById('retry-btn')?.addEventListener('click', load)
}

load()
