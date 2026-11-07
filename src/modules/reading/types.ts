import type { Attachment, Syncable } from '@/domain/types'

export type BookFormat = 'pdf' | 'epub'

/** A book in the library: a file in attachments/ plus where reading stopped. */
export interface Book extends Syncable {
  title: string
  author?: string
  /** Missing on books saved before EPUB support, which are all PDFs */
  format?: BookFormat
  file: Attachment
  /** Reading position as an EPUB CFI (for PDFs, one that points at a page); missing until first opened */
  cfi?: string
  /** How far into the book, 0–1 */
  fraction?: number
  /** RFC 3339, set whenever the position changes */
  lastReadAt?: string
}

export type ReadingData = {
  books: Book[]
}

/** What the readers report as the reading position. */
export type BookProgress = Required<Pick<Book, 'cfi' | 'fraction'>>

/** Books can be much bigger than other attachments. */
export const BOOK_MAX_BYTES = 200 * 1024 * 1024

export const EPUB_MIME = 'application/epub+zip'
export const BOOK_ACCEPT = `application/pdf,${EPUB_MIME},.pdf,.epub`

export function bookFormat(book: Pick<Book, 'format'>): BookFormat {
  return book.format ?? 'pdf'
}

/** The format of a picked file, or null when it is neither PDF nor EPUB. */
export function fileFormat(file: Pick<File, 'name' | 'type'>): BookFormat | null {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf'
  if (file.type === EPUB_MIME || /\.epub$/i.test(file.name)) return 'epub'
  return null
}

export function bookHref(book: Pick<Book, 'id'>): string {
  return `#/reading/${book.id}`
}

/** "manual_v2.pdf" → "manual v2" */
export function titleFromFileName(name: string): string {
  return name.replace(/\.(pdf|epub)$/i, '').replace(/_+/g, ' ').trim() || name
}

/** 0–100, or null before the book was ever opened. */
export function readingPercent(book: Pick<Book, 'fraction'>): number | null {
  return book.fraction === undefined ? null : Math.round(book.fraction * 100)
}
