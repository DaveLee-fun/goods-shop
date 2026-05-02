// js/header.js
// 모든 페이지 공통 상단 헤더 렌더링. <div id="header"></div> 에 마운트.
import { supabase } from './supabase.js'
import { getSession, isAdminUser } from './auth.js'

export async function renderHeader() {
  const root = document.getElementById('header')
  if (!root) return

  const session = await getSession()
  const isAdmin = session ? await isAdminUser(session.user.id) : false

  // 현재 페이지 파일명으로 active 표시
  const here = location.pathname.split('/').pop() || 'index.html'

  function navLink(href, label, extraClass = '') {
    const cls = (here === href ? 'active' : '') + (extraClass ? ' ' + extraClass : '')
    return `<a href="${href}" class="${cls}">${label}</a>`
  }

  root.innerHTML = `
    <div class="header-inner">
      <a href="index.html" class="logo">🛒 굿즈샵</a>
      <nav>
        ${navLink('index.html', '상품')}
        ${session ? navLink('my-orders.html', '내 결제 내역') : ''}
        ${isAdmin ? navLink('admin.html', '관리자', 'admin') : ''}
      </nav>
      <div class="user">
        ${session
          ? `<span class="email">${escapeHtml(session.user.email || '')}</span>
             <button id="logout-btn" class="btn btn-outline">로그아웃</button>`
          : `<a href="login.html" class="btn btn-outline">로그인</a>
             <a href="signup.html" class="btn btn-primary">회원가입</a>`}
      </div>
    </div>
  `

  const btn = document.getElementById('logout-btn')
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true
      await supabase.auth.signOut()
      location.href = 'index.html'
    })
  }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

// auto-mount on page load
renderHeader()
