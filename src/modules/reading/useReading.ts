import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/auth/context'
import { mergeById, newSyncable, touch } from '@/domain/merge'
import { useOnline } from '@/hooks/use-online'
import { keepOnlyBooks, removeCachedBook } from '@/lib/book-cache'
import { getOffline, setOffline } from '@/lib/offline-store'
import { useAttachments } from '@/storage/useAttachments'
import { useVaultContext } from '@/storage/context'
import { BOOK_MAX_BYTES, EPUB_MIME, fileFormat, titleFromFileName, type Book, type BookProgress, type ReadingData } from './types'

const EMPTY: ReadingData = { books: [] }
/** Books are only ever read by the readers, never opened as a page, so EPUBs are safe to accept. */
const BOOK_TYPES = [EPUB_MIME]

/**
 * Offline copy of reading.json, tagged with the account so another sign-in never sees it.
 * `pending` lists books whose position changed offline and still has to reach Drive.
 */
const INDEX_KEY = 'reading:index'

interface CachedIndex {
  owner: string
  data: ReadingData
  pending: string[]
}

/** fetch() rejects with a TypeError when there is no connection at all. */
const isNetworkError = (err: unknown) => err instanceof TypeError

/** How long "Sincronizado" stays visible after a write reaches Drive. */
const SYNCED_FLASH_MS = 2500

/**
 * - `syncing`: loading the library from Drive or writing to it
 * - `pending`: positions saved on the device, waiting for a connection to reach Drive
 * - `synced`: a write just reached Drive (shown briefly)
 * - `idle`: nothing to show
 */
export type SyncStatus = 'syncing' | 'pending' | 'synced' | 'idle'

/**
 * The library (data/reading.json). It is also kept on the device, so books downloaded
 * here can be opened and read offline; the reading position is then saved on the device
 * and sent to Drive on the next load with a connection. Other changes need a connection.
 */
export function useReading() {
  const { vault, reportError } = useVaultContext()
  const owner = useAuth().session?.email ?? ''
  const online = useOnline()
  const { upload, trash } = useAttachments('reading', BOOK_MAX_BYTES, BOOK_TYPES)
  const [data, setData] = useState<ReadingData | null>(null)
  const [settled, setSettled] = useState(false)
  const latest = useRef<CachedIndex>({ owner, data: EMPTY, pending: [] })
  const [pendingCount, setPendingCount] = useState(0)
  // Drive requests in flight (the first load and every write), and the brief "synced" flash after them.
  const [inFlight, setInFlight] = useState(0)
  const [justSynced, setJustSynced] = useState(false)
  const flashTimer = useRef<number | undefined>(undefined)

  const keep = useCallback(
    (next: ReadingData, pending: string[]) => {
      latest.current = { owner, data: next, pending }
      setData(next)
      setPendingCount(pending.length)
      void setOffline(INDEX_KEY, latest.current)
    },
    [owner],
  )

  /** Runs a Drive request while the header shows it syncing. */
  const track = useCallback(async <T,>(request: () => Promise<T>): Promise<T> => {
    setInFlight((n) => n + 1)
    try {
      return await request()
    } finally {
      setInFlight((n) => n - 1)
    }
  }, [])

  /** Briefly shows "synced" after something was saved to Drive (not after a plain load). */
  const flashSynced = useCallback(() => {
    window.clearTimeout(flashTimer.current)
    setJustSynced(true)
    flashTimer.current = window.setTimeout(() => setJustSynced(false), SYNCED_FLASH_MS)
  }, [])

  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  useEffect(() => {
    let cancelled = false
    const cached = getOffline<CachedIndex>(INDEX_KEY).then((entry) => {
      if (entry?.owner !== owner) return undefined
      if (!cancelled) {
        latest.current = entry
        setData((current) => current ?? entry.data)
        setPendingCount(entry.pending.length)
      }
      return entry
    })
    if (!online) {
      void cached.then(() => !cancelled && setSettled(true))
      return () => {
        cancelled = true
      }
    }
    void track(async () => {
      const entry = await cached
      await vault.open()
      // Positions saved offline go up first; merging keeps whichever reading is newer.
      const offline = entry?.data.books.filter((b) => entry.pending.includes(b.id)) ?? []
      const loaded = offline.length ? await vault.save('reading', EMPTY, { books: offline }) : await vault.load('reading', EMPTY)
      if (cancelled) return
      keep(loaded, [])
      if (offline.length) flashSynced()
      void keepOnlyBooks(new Set(loaded.books.filter((b) => !b.deleted).map((b) => b.file.id)))
    })
      .catch((err: unknown) => {
        if (!cancelled && !isNetworkError(err)) reportError(err)
      })
      .finally(() => !cancelled && setSettled(true))
    return () => {
      cancelled = true
    }
  }, [vault, owner, online, keep, track, flashSynced, reportError])

  /**
   * Writes to Drive together with any positions still waiting from offline reading, so the
   * copy on the device never gets replaced by an older one from Drive before they go up.
   */
  const push = useCallback(
    async (books: Book[]) => {
      const { data: current, pending } = latest.current
      const waiting = current.books.filter((b) => pending.includes(b.id))
      keep(await track(() => vault.save('reading', EMPTY, { books: mergeById(waiting, books) })), [])
      flashSynced()
    },
    [vault, keep, track, flashSynced],
  )

  const save = useCallback(
    async (books: Book[]): Promise<boolean> => {
      try {
        await push(books)
        return true
      } catch (err) {
        reportError(err)
        return false
      }
    },
    [push, reportError],
  )

  // Most recently read first; never-opened books after them, newest first.
  const books = useMemo(
    () =>
      (data?.books ?? [])
        .filter((b) => !b.deleted)
        .sort((a, b) => (b.lastReadAt ?? '').localeCompare(a.lastReadAt ?? '') || b.createdAt.localeCompare(a.createdAt)),
    [data],
  )

  /** Uploads PDFs and EPUBs; any other file is skipped. */
  const addBooks = useCallback(
    async (files: File[]): Promise<boolean> => {
      const typed = files.flatMap((file) => {
        const format = fileFormat(file)
        if (!format) return []
        // Some systems pick books with no type; Drive should still store them as PDF or EPUB.
        const type = format === 'epub' ? EPUB_MIME : 'application/pdf'
        const normalized = file.type === type ? file : new File([file], file.name, { type })
        return [{ file: normalized, format }]
      })
      if (!typed.length) return false
      const uploaded = await upload(typed.map((t) => t.file))
      if (!uploaded) return false
      const created: Book[] = uploaded.map((file, i) => ({
        ...newSyncable(),
        title: titleFromFileName(file.name),
        format: typed[i].format,
        file,
      }))
      return save(created)
    },
    [upload, save],
  )

  const updateDetails = useCallback(
    (book: Book, details: Pick<Book, 'title' | 'author'>) => save([touch(book, details)]),
    [save],
  )

  /** Saved on the device first when there is no connection, then sent to Drive on the next load. */
  const saveProgress = useCallback(
    async (book: Book, progress: BookProgress): Promise<boolean> => {
      const updated = touch(book, { ...progress, lastReadAt: new Date().toISOString() })
      const keepOnDevice = () => {
        const { data: current, pending } = latest.current
        keep({ books: mergeById(current.books, [updated]) }, [...new Set([...pending, book.id])])
        return true
      }
      if (!navigator.onLine) return keepOnDevice()
      try {
        await push([updated])
        return true
      } catch (err) {
        if (isNetworkError(err)) return keepOnDevice()
        reportError(err)
        return false
      }
    },
    [push, keep, reportError],
  )

  const deleteBook = useCallback(
    async (book: Book) => {
      const ok = await save([touch(book, { deleted: true })])
      if (ok) {
        await removeCachedBook(book.file.id)
        await trash([book.file])
      }
      return ok
    },
    [trash, save],
  )

  const sync: SyncStatus = inFlight > 0 ? 'syncing' : pendingCount > 0 ? 'pending' : justSynced ? 'synced' : 'idle'

  return {
    books,
    sync,
    loading: !data && !settled,
    /** Offline with no copy of the library on this device yet */
    unavailable: !data && settled,
    online,
    addBooks,
    updateDetails,
    saveProgress,
    deleteBook,
  }
}

export type ReadingState = ReturnType<typeof useReading>
