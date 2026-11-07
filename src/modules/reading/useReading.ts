import { useCallback, useMemo } from 'react'
import { newSyncable, touch } from '@/domain/merge'
import { useAttachments } from '@/storage/useAttachments'
import { useCollection } from '@/storage/useCollection'
import { BOOK_MAX_BYTES, EPUB_MIME, fileFormat, titleFromFileName, type Book, type BookProgress, type ReadingData } from './types'

const EMPTY: ReadingData = { books: [] }

export function useReading() {
  const { data, loading, save } = useCollection('reading', EMPTY)
  const { upload, trash } = useAttachments('reading', BOOK_MAX_BYTES)

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
        // Some systems pick .epub files with no type; Drive should still store them as EPUB.
        const normalized = format === 'epub' && file.type !== EPUB_MIME ? new File([file], file.name, { type: EPUB_MIME }) : file
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
      return save({ books: created })
    },
    [upload, save],
  )

  const updateDetails = useCallback(
    (book: Book, details: Pick<Book, 'title' | 'author'>) => save({ books: [touch(book, details)] }),
    [save],
  )

  const saveProgress = useCallback(
    (book: Book, progress: BookProgress) =>
      save({ books: [touch(book, { ...progress, lastReadAt: new Date().toISOString() })] }),
    [save],
  )

  const deleteBook = useCallback(
    async (book: Book) => {
      const ok = await save({ books: [touch(book, { deleted: true })] })
      if (ok) await trash([book.file])
      return ok
    },
    [trash, save],
  )

  return { books, loading, addBooks, updateDetails, saveProgress, deleteBook }
}

export type ReadingState = ReturnType<typeof useReading>
