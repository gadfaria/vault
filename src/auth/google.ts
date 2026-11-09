export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const SCOPES = ['openid', 'email', 'profile', DRIVE_SCOPE].join(' ')
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const STORAGE_KEY = 'vault.session'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

export interface Session {
  accessToken: string
  expiresAt: number
  email: string
  name: string
  picture?: string
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Sua sessão expirou.')
    this.name = 'SessionExpiredError'
  }
}

let gisLoading: Promise<void> | undefined

function loadGis(): Promise<void> {
  gisLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      gisLoading = undefined
      reject(new Error('Não foi possível carregar o login do Google.'))
    }
    document.head.appendChild(script)
  })
  return gisLoading
}

function requestToken(loginHint?: string): Promise<google.accounts.oauth2.TokenResponse> {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID!,
      scope: SCOPES,
      login_hint: loginHint,
      prompt: loginHint ? '' : undefined,
      callback: (response) => {
        if (response.error) reject(new Error(response.error_description || response.error))
        else resolve(response)
      },
      error_callback: (error) => reject(new Error(error.message || error.type)),
    })
    client.requestAccessToken()
  })
}

/** Opens the Google popup. Must be called from a user gesture (click) or browsers block it. */
export async function signIn(loginHint?: string): Promise<Session> {
  if (!GOOGLE_CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID não configurado.')
  await loadGis()
  const token = await requestToken(loginHint)

  // With granular consent the user can uncheck Drive access on the consent screen.
  if (!google.accounts.oauth2.hasGrantedAllScopes(token, DRIVE_SCOPE)) {
    throw new Error(MISSING_DRIVE)
  }
  return createSession(token.access_token, Number(token.expires_in))
}

const MISSING_DRIVE = 'O acesso ao Google Drive é necessário para guardar seus dados.'

/** Reads the profile for a fresh access token and stores the session. */
async function createSession(accessToken: string, expiresIn: number): Promise<Session> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Não foi possível ler seu perfil do Google.')
  const profile = (await res.json()) as { email: string; name: string; picture?: string }

  const session: Session = {
    accessToken,
    // Renew a minute early so a request never goes out with a token about to expire.
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
  }
  saveSession(session)
  return session
}

const REDIRECT_KEY = 'vault.oauth'
let redirectError: string | null = null

/** True when running as an installed app (opened from the home screen, full screen). */
export function isStandalone(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Sign-in for the installed app: the Google popup is unreliable in standalone mode
 * (especially on iOS), so the whole page goes to Google and comes back with the token
 * in the URL hash. Needs `<origin>/` as an authorized redirect URI on the OAuth client.
 */
export function signInWithRedirect(loginHint?: string): void {
  if (!GOOGLE_CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID não configurado.')
  const state = crypto.randomUUID()
  try {
    sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ state, returnTo: location.hash }))
  } catch {
    // Without storage the state can't be checked on return; the sign-in will be rejected.
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${location.origin}/`,
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
    state,
    ...(loginHint ? { login_hint: loginHint } : { prompt: 'select_account' }),
  })
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}

/**
 * Finishes a redirect sign-in. Runs before the app renders: when the URL hash carries
 * Google's response it stores the session, restores the previous route and removes the
 * token from the address bar. Problems are kept for the sign-in screen to show.
 */
export async function completeRedirectSignIn(): Promise<void> {
  const hash = location.hash.slice(1)
  if (!/(^|&)(access_token|error)=/.test(hash)) return
  const params = new URLSearchParams(hash)

  let pending: { state: string; returnTo: string } | null = null
  try {
    pending = JSON.parse(sessionStorage.getItem(REDIRECT_KEY) ?? 'null')
    sessionStorage.removeItem(REDIRECT_KEY)
  } catch {
    pending = null
  }
  history.replaceState(null, '', `${location.pathname}${location.search}${pending?.returnTo ?? ''}`)

  if (!pending || params.get('state') !== pending.state) {
    redirectError = 'Não foi possível confirmar o login. Tente de novo.'
  } else if (params.get('error')) {
    redirectError = params.get('error') === 'access_denied' ? 'Login cancelado.' : `Erro do Google: ${params.get('error')}`
  } else if (!(params.get('scope') ?? '').split(' ').includes(DRIVE_SCOPE)) {
    redirectError = MISSING_DRIVE
  } else {
    try {
      await createSession(params.get('access_token')!, Number(params.get('expires_in')))
    } catch (err) {
      redirectError = err instanceof Error ? err.message : String(err)
    }
  }
}

/** The redirect sign-in problem, if any, once (the sign-in screen shows it). */
export function takeRedirectError(): string | null {
  const error = redirectError
  redirectError = null
  return error
}

export function isExpired(session: Session): boolean {
  return Date.now() >= session.expiresAt
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function saveSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Storage unavailable (private mode): the session just won't survive a reload.
  }
}

/**
 * Asks Google to invalidate the session's token, so a copy of it stops working at sign-out
 * instead of up to an hour later. This withdraws the app's access for the account: other
 * devices are asked to sign in again. Best effort: offline, the token just expires on its own.
 */
export function revokeSession(session: Session): void {
  if (isExpired(session)) return
  // The endpoint sends no CORS headers; a form post needs none, as long as the answer isn't read.
  void fetch(REVOKE_URL, {
    method: 'POST',
    mode: 'no-cors',
    body: new URLSearchParams({ token: session.accessToken }),
    keepalive: true,
  }).catch(() => {})
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
