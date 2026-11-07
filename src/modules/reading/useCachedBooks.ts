import { useEffect, useState } from 'react'
import { listCachedBooks, onBookCacheChange, type CachedBook } from '@/lib/book-cache'

/** Books stored on this device, kept current as books are downloaded or removed. */
export function useCachedBooks(): CachedBook[] {
  const [books, setBooks] = useState<CachedBook[]>([])

  useEffect(() => {
    let cancelled = false
    const load = () => void listCachedBooks().then((list) => !cancelled && setBooks(list))
    load()
    const unsubscribe = onBookCacheChange(load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return books
}
