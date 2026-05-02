// js/login.js
import { supabase } from './supabase.js'
import { escapeHtml } from './header.js'

const form = document.getElementById('login-form')
const alertEl = document.getElementById('alert')
const submit = document.getElementById('submit')

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  alertEl.innerHTML = ''
  submit.disabled = true; submit.textContent = '로그인 중...'

  const fd = new FormData(form)
  const email = String(fd.get('email') || '').trim()
  const password = String(fd.get('password') || '')

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    alertEl.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`
    submit.disabled = false; submit.textContent = '로그인'
    return
  }

  location.href = 'index.html'
})
