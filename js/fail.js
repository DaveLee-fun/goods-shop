// js/fail.js
import { escapeHtml } from './header.js'

const params = new URLSearchParams(location.search)
const code = params.get('code')
const message = params.get('message')

if (message) document.getElementById('msg').textContent = message
if (code) document.getElementById('code').textContent = `코드: ${code}`
