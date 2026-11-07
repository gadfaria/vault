import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { clearBookCache } from '@/lib/book-cache'
import { clearOffline } from '@/lib/offline-store'
import { AuthContext } from './context'
import {
  clearSession,
  isExpired,
  isStandalone,
  loadSession,
  SessionExpiredError,
  signIn as googleSignIn,
  signInWithRedirect,
  type Session,
} from './google'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState(loadSession)
  const [expired, setExpired] = useState(() => (session ? isExpired(session) : false))
  // Mirrors `session` so getAccessToken stays stable and never reads a stale value.
  const sessionRef = useRef<Session | null>(session)

  const setSession = useCallback((next: Session | null) => {
    sessionRef.current = next
    setSessionState(next)
  }, [])

  const signIn = useCallback(async () => {
    if (isStandalone()) {
      // The page leaves for Google; the session is picked up on return (see completeRedirectSignIn).
      signInWithRedirect(sessionRef.current?.email)
      return new Promise<void>(() => {})
    }
    setSession(await googleSignIn(sessionRef.current?.email))
    setExpired(false)
  }, [setSession])

  const signOut = useCallback(() => {
    clearSession()
    // Offline copies (notes, the reading library, downloaded books) belong to this account: never leave them on the device.
    void clearOffline()
    void clearBookCache()
    setSession(null)
    setExpired(false)
  }, [setSession])

  const markExpired = useCallback(() => setExpired(true), [])

  const getAccessToken = useCallback(async () => {
    const current = sessionRef.current
    if (!current || isExpired(current)) {
      setExpired(true)
      throw new SessionExpiredError()
    }
    return current.accessToken
  }, [])

  const value = useMemo(
    () => ({ session, expired, signIn, signOut, markExpired, getAccessToken }),
    [session, expired, signIn, signOut, markExpired, getAccessToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
