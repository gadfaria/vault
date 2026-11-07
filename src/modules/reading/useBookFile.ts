import { useEffect, useState } from 'react'
import { readCachedBook, storeBook } from '@/lib/book-cache'
import { useVaultContext } from '@/storage/context'
import type { Book } from './types'

export type BookFileState =
  | { status: 'loading'; downloading: boolean }
  | { status: 'ready'; file: Blob }
  | { status: 'offline' }
  | { status: 'error' }

/** The book's file: the copy on this device, or downloaded from Drive once and kept here. */
export function useBookFile(book: Pick<Book, 'file'>): BookFileState {
  const { vault, reportError } = useVaultContext()
  const fileId = book.file.id
  const [state, setState] = useState<BookFileState>({ status: 'loading', downloading: false })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = await readCachedBook(fileId)
      if (cancelled) return
      if (cached) return setState({ status: 'ready', file: cached })
      if (!navigator.onLine) return setState({ status: 'offline' })
      setState({ status: 'loading', downloading: true })
      const blob = await vault.downloadAttachment(fileId)
      if (cancelled) return
      // Read from the stored copy when possible: it stays on disk instead of in memory.
      const stored = await storeBook(fileId, blob)
      if (!cancelled) setState({ status: 'ready', file: stored ?? blob })
    })().catch((err: unknown) => {
      if (cancelled) return
      if (err instanceof TypeError) setState({ status: 'offline' })
      else {
        reportError(err)
        setState({ status: 'error' })
      }
    })
    return () => {
      cancelled = true
    }
  }, [vault, fileId, reportError])

  return state
}
