import { CloudCheckIcon, CloudOffIcon, Loader2Icon } from 'lucide-react'
import type { SyncStatus } from './useReading'

const STATES = {
  syncing: {
    icon: <Loader2Icon className="size-4 animate-spin" />,
    label: 'Sincronizando…',
    title: 'Sincronizando a leitura com o Google Drive',
  },
  pending: {
    icon: <CloudOffIcon className="size-4" />,
    label: 'Salvo no aparelho',
    title: 'Sem conexão: a posição de leitura fica no aparelho e vai para o Drive quando a internet voltar',
  },
  synced: {
    icon: <CloudCheckIcon className="size-4" />,
    label: 'Sincronizado',
    title: 'Leitura salva no Google Drive',
  },
} as const

/** Header badge for the reading sync; on phones only the icon shows. */
export function SyncIndicator({ status }: { status: SyncStatus }) {
  // Always rendered, so screen readers announce each change in the live region.
  const state = status === 'idle' ? null : STATES[status]
  return (
    <span role="status" aria-live="polite" title={state?.title} className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {state?.icon}
      {state && <span className="sr-only sm:not-sr-only">{state.label}</span>}
    </span>
  )
}
