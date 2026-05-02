// js/auth.js
// 페이지 단위로 호출하는 인증 가드 + 사용자 정보 헬퍼.
import { supabase } from './supabase.js'

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) console.warn('getSession error:', error)
  return data.session ?? null
}

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user ?? null
}

export async function isAdminUser(userId) {
  if (!userId) return false
  const { data, error } = await supabase
    .from('profiles').select('is_admin').eq('id', userId).maybeSingle()
  if (error) { console.warn('isAdmin query error:', error); return false }
  return !!data?.is_admin
}

// 로그인 필수 페이지에서 호출. 없으면 login.html 으로 보냄.
export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    location.href = 'login.html'
    return null
  }
  return session
}

// 관리자 전용 페이지에서 호출.
export async function requireAdmin() {
  const session = await requireAuth()
  if (!session) return null
  const isAdmin = await isAdminUser(session.user.id)
  if (!isAdmin) {
    alert('관리자만 접근 가능합니다.')
    location.href = 'index.html'
    return null
  }
  return session
}
