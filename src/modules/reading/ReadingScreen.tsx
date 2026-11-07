import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { BookOpenIcon, EllipsisVerticalIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { PageBody } from '@/components/app-layout'
import { SiteHeader } from '@/components/site-header'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBytes } from '@/lib/format'
import type { ModuleScreenProps } from '..'
import { useAttachmentUrl } from '@/storage/useAttachments'
import { ReaderMessage } from './ReaderMessage'
import type { BookDetails } from './BookViewer'
import { BOOK_ACCEPT, bookFormat, bookHref, fileFormat, readingPercent, titleFromFileName, type Book, type BookProgress } from './types'
import { useReading, type ReadingState } from './useReading'

// foliate-js (and pdf.js, for PDFs) are large, so they load only when a book is opened.
const BookViewer = lazy(() => import('./BookViewer'))

/** Progress is written to Drive at most this often while reading. */
const SAVE_DELAY_MS = 2000

export function ReadingScreen({ path }: ModuleScreenProps) {
  const reading = useReading()
  const [bookId] = path

  if (bookId) {
    const book = reading.books.find((b) => b.id === bookId)
    return (
      <>
        <SiteHeader title={[{ label: 'Leitura', href: '#/reading' }, { label: book?.title ?? 'Livro' }]} />
        {reading.loading ? (
          <ReaderMessage spinner>Carregando…</ReaderMessage>
        ) : book ? (
          <BookReader key={book.id} book={book} saveProgress={reading.saveProgress} updateDetails={reading.updateDetails} />
        ) : (
          <ReaderMessage>
            Este livro não está mais na biblioteca.{' '}
            <a href="#/reading" className="underline underline-offset-4">
              Voltar para Leitura
            </a>
          </ReaderMessage>
        )}
      </>
    )
  }

  return <Library reading={reading} />
}

function BookReader({
  book,
  saveProgress,
  updateDetails,
}: {
  book: Book
  saveProgress: ReadingState['saveProgress']
  updateDetails: ReadingState['updateDetails']
}) {
  const url = useAttachmentUrl(book.file.id)
  const latest = useRef(book)
  useEffect(() => {
    latest.current = book
  }, [book])
  const pending = useRef<BookProgress | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    const next = pending.current
    pending.current = null
    const current = latest.current
    const changed = next && (Object.keys(next) as (keyof BookProgress)[]).some((key) => next[key] !== current[key])
    if (next && changed) void saveProgress(current, next)
  }, [saveProgress])

  const report = useCallback(
    (progress: BookProgress) => {
      pending.current = progress
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, SAVE_DELAY_MS)
    },
    [flush],
  )

  // Books usually know their own title and author: use them while the book still has its file name as title.
  const onDetails = useCallback(
    ({ title, author }: BookDetails) => {
      const current = latest.current
      if (!title || current.title !== titleFromFileName(current.file.name)) return
      if (title !== current.title || author !== current.author) void updateDetails(current, { title, author })
    },
    [updateDetails],
  )

  // Save right away when leaving the book or hiding the tab, so the last position isn't lost.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  if (!url) return <ReaderMessage spinner>Baixando do Drive ({formatBytes(book.file.size)})…</ReaderMessage>
  return (
    <Suspense fallback={<ReaderMessage spinner>Abrindo o leitor…</ReaderMessage>}>
      <BookViewer
        url={url}
        fileName={book.file.name}
        format={bookFormat(book)}
        initialCfi={book.cfi}
        onRelocate={report}
        onDetails={onDetails}
      />
    </Suspense>
  )
}

function Library({ reading }: { reading: ReadingState }) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [renaming, setRenaming] = useState<Book | null>(null)
  const [confirm, setConfirm] = useState<Book | null>(null)

  async function add(files: File[]) {
    const books = files.filter((f) => fileFormat(f))
    if (books.length < files.length) toast.error('Só dá para adicionar arquivos PDF ou EPUB.')
    if (!books.length) return
    setUploading(true)
    await reading.addBooks(books)
    setUploading(false)
  }

  return (
    <>
      <SiteHeader title="Leitura" />
      <PageBody>
        <div className="flex items-center justify-between px-4 lg:px-6">
          <h2 className="text-sm font-medium">Biblioteca</h2>
          <input
            ref={input}
            type="file"
            multiple
            accept={BOOK_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              e.target.value = ''
              void add(files)
            }}
          />
          <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={reading.loading || uploading}>
            {uploading ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            {uploading ? 'Enviando…' : 'Adicionar livro'}
          </Button>
        </div>

        <div className="px-4 lg:px-6">
          {reading.loading ? (
            <div className="grid grid-cols-2 gap-4 @xl/main:grid-cols-3 @4xl/main:grid-cols-4 @6xl/main:grid-cols-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="aspect-[3/4] w-full" />
              ))}
            </div>
          ) : reading.books.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
              <BookOpenIcon className="size-6 text-muted-foreground" />
              <p className="text-sm">Nenhum livro ainda</p>
              <p className="text-sm text-muted-foreground">Adicione um PDF ou EPUB para ler aqui. O ponto onde você parou fica salvo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 @xl/main:grid-cols-3 @4xl/main:grid-cols-4 @6xl/main:grid-cols-5">
              {reading.books.map((book) => (
                <BookCard key={book.id} book={book} onRename={() => setRenaming(book)} onDelete={() => setConfirm(book)} />
              ))}
            </div>
          )}
        </div>
      </PageBody>

      <RenameDialog book={renaming} onClose={() => setRenaming(null)} onSubmit={(book, title) => reading.updateDetails(book, { title, author: book.author })} />
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover livro?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.title} sai da biblioteca e o arquivo vai para a lixeira do Drive (recuperável por 30 dias).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (confirm) await reading.deleteBook(confirm)
                setConfirm(null)
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function BookCard({ book, onRename, onDelete }: { book: Book; onRename: () => void; onDelete: () => void }) {
  const percent = readingPercent(book)

  return (
    <div className="group relative flex min-w-0 flex-col gap-2">
      <a
        href={bookHref(book)}
        className="relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-md border bg-gradient-to-br from-muted to-muted/40 p-3 transition hover:ring-2 hover:ring-foreground/20"
      >
        <span className="flex items-center justify-between text-muted-foreground">
          <BookOpenIcon className="size-5" />
          <span className="text-[10px] font-medium tracking-wide uppercase">{bookFormat(book)}</span>
        </span>
        <span className="flex flex-col gap-1">
          <span className="line-clamp-4 text-sm font-medium leading-snug">{book.title}</span>
          {book.author && <span className="line-clamp-2 text-xs text-muted-foreground">{book.author}</span>}
        </span>
        {percent !== null && (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-foreground/10">
            <span className="block h-full bg-primary" style={{ width: `${percent}%` }} />
          </span>
        )}
      </a>
      <div className="flex min-w-0 items-start justify-between gap-1">
        <div className="min-w-0 text-xs text-muted-foreground">
          <p>{percent === null ? 'Não iniciado' : `${percent}% lido`}</p>
          {book.lastReadAt && <p>Lido em {new Date(book.lastReadAt).toLocaleDateString('pt-BR')}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mt-1 size-7 shrink-0" aria-label={`Opções de ${book.title}`}>
              <EllipsisVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onRename}>
              <PencilIcon />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2Icon />
              Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function RenameDialog({
  book,
  onClose,
  onSubmit,
}: {
  book: Book | null
  onClose: () => void
  onSubmit: (book: Book, title: string) => Promise<boolean>
}) {
  return (
    <Dialog open={book !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {book && <RenameForm key={book.id} book={book} onClose={onClose} onSubmit={onSubmit} />}
      </DialogContent>
    </Dialog>
  )
}

function RenameForm({
  book,
  onClose,
  onSubmit,
}: {
  book: Book
  onClose: () => void
  onSubmit: (book: Book, title: string) => Promise<boolean>
}) {
  const [title, setTitle] = useState(book.title)
  const [saving, setSaving] = useState(false)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const value = title.trim()
        if (!value) return
        setSaving(true)
        const ok = await onSubmit(book, value)
        setSaving(false)
        if (ok) onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>Renomear livro</DialogTitle>
      </DialogHeader>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Título" autoFocus />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving || !title.trim()}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  )
}
