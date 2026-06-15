const SF_CLIENT_ID = import.meta.env.VITE_SF_CLIENT_ID
const SF_LOGIN_URL = import.meta.env.VITE_SF_LOGIN_URL
const REDIRECT_URI = window.location.origin + '/BankerPOC'

const generateCodeVerifier = () => {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

const generateCodeChallenge = async (verifier) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export const initiateLogin = async () => {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  sessionStorage.setItem('pkce_verifier', verifier)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SF_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  window.location.href = `${SF_LOGIN_URL}/services/oauth2/authorize?${params}`
}

export const handleCallback = async (code) => {
  const verifier = sessionStorage.getItem('pkce_verifier')
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: SF_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code,
    code_verifier: verifier,
  })
  const response = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  const data = await response.json()
  if (data.access_token) {
    sessionStorage.setItem('sf_access_token', data.access_token)
    sessionStorage.setItem('sf_instance_url', data.instance_url)
    sessionStorage.removeItem('pkce_verifier')
    return data
  }
  throw new Error(data.error_description || 'Token exchange failed')
}

export const getToken = () => sessionStorage.getItem('sf_access_token')
export const getInstanceUrl = () => sessionStorage.getItem('sf_instance_url')
export const isAuthenticated = () => !!getToken()
export const logout = () => {
  sessionStorage.removeItem('sf_access_token')
  sessionStorage.removeItem('sf_instance_url')
}