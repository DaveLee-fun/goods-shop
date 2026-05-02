// js/signup.js
import { supabase } from './supabase.js'
import { escapeHtml } from './header.js'

const form = document.getElementById('signup-form')
const alertEl = document.getElementById('alert')
const submit = document.getElementById('submit')

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  alertEl.innerHTML = ''
  submit.disabled = true; submit.textContent = '가입 중...'

  const fd = new FormData(form)
  const email = String(fd.get('email') || '').trim()
  const password = String(fd.get('password') || '')

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) {
    alertEl.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`
    submit.disabled = false; submit.textContent = '가입하기'
    return
  }
  // 이메일 인증을 꺼놨으므로 즉시 session 발급됨 → 바로 홈으로
  if (data.session) {
    location.href = 'index.html'
  } else {
    alertEl.innerHTML = `<div class="alert alert-success">가입 요청이 접수되었습니다. 잠시 후 <a href="login.html">로그인</a>해 주세요.</div>`
    submit.disabled = false; submit.textContent = '가입하기'
  }
})
