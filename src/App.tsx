import { Suspense, useEffect, useState } from 'react'
import { useAuth } from '@/auth/context'
import { AppLayout } from '@/components/app-layout'
import { ErrorBoundary } from '@/components/error-boundary'
import { useOnline } from '@/hooks/use-online'
import { MODULES } from '@/modules'
import { useValuesHidden } from '@/lib/privacy'
import { LoginScreen } from '@/screens/LoginScreen'
import { VaultProvider } from '@/storage/VaultProvider'

/** A hand-typed hash like "#/%" isn't valid percent-encoding: keep the segment as it is instead of throwing. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/** Hash routing (#/finance): works on any static host and keeps the phone's back button. */
function useRoute(): string[] {
  const [hash, setHash] = useState(() => location.hash)
  useEffect(() => {
    const onChange = () => {
      setHash(location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map(decodeSegment)
}

export default function App() {
  const { session, expired } = useAuth()
  const [moduleId, ...path] = useRoute()
  const online = useOnline()
  // Subscribed here so the whole tree re-renders, and every formatMoney masks or unmasks, on toggle.
  useValuesHidden()
  // Offline, signing in again is impossible anyway: keep the app open so notes can be read
  // from the device. Back online, an expired session goes to the sign-in screen as usual.
  if (!session || (expired && online)) return <LoginScreen />

  // Unknown routes (and "/") land on the first module.
  const active = MODULES.find((m) => m.id === moduleId)
  const Screen = (active ?? MODULES[0]).Screen
  return (
    <VaultProvider>
      <AppLayout activeId={(active ?? MODULES[0]).id}>
        {/* Keyed by module so a crash (or a screen that failed to download) clears when navigating away. */}
        <ErrorBoundary key={(active ?? MODULES[0]).id}>
          <Suspense fallback={null}>
            <Screen path={active ? path : []} />
          </Suspense>
        </ErrorBoundary>
      </AppLayout>
    </VaultProvider>
  )
}
