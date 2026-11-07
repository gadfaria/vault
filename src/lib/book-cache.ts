/**
 * Books downloaded from Drive, kept on the device in the Origin Private File System so each
 * one is downloaded once per device and opens offline. Attachments are never overwritten
 * on Drive (a new file gets a new id), so a copy keyed by file id is never stale.
 *
 * Files read back are disk-backed `File`s: the readers slice them as needed instead of
 * holding the whole book in memory. Every call fails soft: without OPFS (old browsers,
 * private windows) books are simply downloaded each time.
 */
import { getOffline, persistOffline, setOffline } from './offline-store'

const DIR = 'books'
/** When the files on the device go past this, the least recently opened ones are removed. */
export const BOOK_CACHE_LIMIT = 1024 * 1024 * 1024
const OPENED_KEY = 'reading:opened'

export interface CachedBook {
  fileId: string
  size: number
}

const changes = new EventTarget()
const notify = () => changes.dispatchEvent(new Event('change'))

/** Calls `listener` whenever a book is stored or removed. */
export function onBookCacheChange(listener: () => void): () => void {
  changes.addEventListener('change', listener)
  return () => changes.removeEventListener('change', listener)
}

async function booksDir(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const root = await navigator.storage.getDirectory()
    return await root.getDirectoryHandle(DIR, { create: true })
  } catch {
    return null
  }
}

/** When each file was last opened (ISO strings), to pick what to remove first. */
async function openedTimes(): Promise<Record<string, string>> {
  return (await getOffline<Record<string, string>>(OPENED_KEY)) ?? {}
}

async function markOpened(fileId: string): Promise<void> {
  const times = await openedTimes()
  times[fileId] = new Date().toISOString()
  await setOffline(OPENED_KEY, times)
}

export async function listCachedBooks(): Promise<CachedBook[]> {
  const dir = await booksDir()
  if (!dir) return []
  const books: CachedBook[] = []
  try {
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'file') books.push({ fileId: name, size: (await handle.getFile()).size })
    }
  } catch {
    // Whatever was listed so far is still right.
  }
  return books
}

/** The book's copy on this device, or null when it was never downloaded here. */
export async function readCachedBook(fileId: string): Promise<File | null> {
  const dir = await booksDir()
  if (!dir) return null
  try {
    const file = await (await dir.getFileHandle(fileId)).getFile()
    void markOpened(fileId)
    return file
  } catch {
    return null
  }
}

/** Removes the least recently opened books until `incoming` more bytes fit under the limit. */
async function makeRoom(dir: FileSystemDirectoryHandle, incoming: number, keep: string): Promise<void> {
  const books = await listCachedBooks()
  let total = books.reduce((sum, b) => sum + b.size, 0) + incoming
  if (total <= BOOK_CACHE_LIMIT) return
  const times = await openedTimes()
  const oldestFirst = books
    .filter((b) => b.fileId !== keep)
    .sort((a, b) => (times[a.fileId] ?? '').localeCompare(times[b.fileId] ?? ''))
  for (const book of oldestFirst) {
    if (total <= BOOK_CACHE_LIMIT) break
    await dir.removeEntry(book.fileId).catch(() => {})
    total -= book.size
  }
}

/**
 * Keeps a downloaded book on the device and returns the stored copy, or null when it
 * can't be stored (no OPFS, no space, or a browser without createWritable, like older Safari).
 */
export async function storeBook(fileId: string, blob: Blob): Promise<File | null> {
  const dir = await booksDir()
  if (!dir) return null
  let handle: FileSystemFileHandle | undefined
  try {
    await makeRoom(dir, blob.size, fileId)
    handle = await dir.getFileHandle(fileId, { create: true })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    persistOffline()
    void markOpened(fileId)
    notify()
    return await handle.getFile()
  } catch {
    // A half-written file would open as a broken book next time.
    if (handle) await dir.removeEntry(fileId).catch(() => {})
    return null
  }
}

export async function removeCachedBook(fileId: string): Promise<void> {
  const dir = await booksDir()
  if (!dir) return
  await dir.removeEntry(fileId).catch(() => {})
  notify()
}

/** Removes copies of books no longer in the library, e.g. removed on another device. */
export async function keepOnlyBooks(fileIds: Set<string>): Promise<void> {
  const dir = await booksDir()
  if (!dir) return
  const stale = (await listCachedBooks()).filter((b) => !fileIds.has(b.fileId))
  for (const book of stale) await dir.removeEntry(book.fileId).catch(() => {})
  if (stale.length) notify()
}

/** Wipes every book on the device, e.g. on sign-out. */
export async function clearBookCache(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry(DIR, { recursive: true })
  } catch {
    // Nothing stored, or no OPFS at all.
  }
  notify()
}
