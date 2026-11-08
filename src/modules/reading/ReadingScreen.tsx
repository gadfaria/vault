import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpenIcon, CloudOffIcon, EllipsisVerticalIcon, HardDriveIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
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
import { BOOK_CACHE_LIMIT, removeCachedBook } from '@/lib/book-cache'
import { formatBytes } from '@/lib/format'
import type { ModuleScreenProps } from '..'
import { ReaderMessage } from './ReaderMessage'
import { SyncIndicator } from './SyncIndicator'
import type { BookDetails } from './BookViewer'
import { BOOK_ACCEPT, bookFormat, bookHref, fileFormat, readingPercent, titleFromFileName, type Book, type BookProgress } from './types'
import { useBookFile } from './useBookFile'
import { useCachedBooks } from './useCachedBooks'
import { useReading, type ReadingState } from './useReading'

// foliate-js (and pdf.js, for PDFs) are large, so they load only when a book is opened.
// If the reader's code can't load (offline before it was ever cached), say so instead of breaking the page.
const BookViewer = lazy(() =>
  import('./BookViewer').catch(() => ({
    default: () => <ReaderMessage>Sem conexão. O leitor ainda não está salvo neste aparelho.</ReaderMessage>,
  })),
)

/** Progress is written to Drive at most this often while reading. */
const SAVE_DELAY_MS = 2000

export function ReadingScreen({ path }: ModuleScreenProps) {
  const reading = useReading()
  const [bookId] = path

  if (bookId) {
    const book = reading.books.find((b) => b.id === bookId)
    return (
      <>
        <SiteHeader title={[{ label: 'Leitura', href: '#/reading' }, { label: book?.title ?? 'Livro' }]}>
          <SyncIndicator status={reading.sync} />
        </SiteHeader>
        {reading.loading ? (
          <ReaderMessage spinner>Carregando…</ReaderMessage>
        ) : reading.unavailable ? (
          <ReaderMessage>Sem conexão. A biblioteca fica no aparelho depois de aberta uma vez com internet.</ReaderMessage>
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
  const file = useBookFile(book)
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

  if (file.status === 'offline') return <ReaderMessage>Sem conexão. Este livro ainda não foi baixado neste aparelho.</ReaderMessage>
  if (file.status === 'error') return <ReaderMessage>Não foi possível baixar este livro do Drive.</ReaderMessage>
  if (file.status === 'loading') {
    return (
      <ReaderMessage spinner>
        {file.downloading ? `Baixando do Drive (${formatBytes(book.file.size)})… Só na primeira vez neste aparelho.` : 'Abrindo…'}
      </ReaderMessage>
    )
  }
  return (
    <Suspense fallback={<ReaderMessage spinner>Abrindo o leitor…</ReaderMessage>}>
      <BookViewer
        file={file.file}
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
  const cached = useCachedBooks()
  const cachedIds = useMemo(() => new Set(cached.map((b) => b.fileId)), [cached])
  const cachedBytes = cached.reduce((sum, b) => sum + b.size, 0)

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
      <SiteHeader title="Leitura">
        <SyncIndicator status={reading.sync} />
      </SiteHeader>
      <PageBody>
        <div className="flex items-center justify-between px-4 lg:px-6">
          <div className="flex min-w-0 flex-col">
            <h2 className="text-sm font-medium">Biblioteca</h2>
            {cachedBytes > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatBytes(cachedBytes)} de {formatBytes(BOOK_CACHE_LIMIT)} neste aparelho
              </p>
            )}
          </div>
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
          <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={reading.loading || uploading || !reading.online}>
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
          ) : reading.unavailable ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
              <CloudOffIcon className="size-6 text-muted-foreground" />
              <p className="text-sm">Sem conexão</p>
              <p className="text-sm text-muted-foreground">A biblioteca fica no aparelho depois de aberta uma vez com internet.</p>
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
                <BookCard
                  key={book.id}
                  book={book}
                  cached={cachedIds.has(book.file.id)}
                  online={reading.online}
                  onRename={() => setRenaming(book)}
                  onDelete={() => setConfirm(book)}
                />
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
              {confirm?.title} sai da biblioteca e deste aparelho, e o arquivo vai para a lixeira do Drive (recuperável por 30 dias).
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

function BookCard({
  book,
  cached,
  online,
  onRename,
  onDelete,
}: {
  book: Book
  /** Stored on this device, so it opens without downloading (and offline) */
  cached: boolean
  online: boolean
  onRename: () => void
  onDelete: () => void
}) {
  const percent = readingPercent(book)

  return (
    <div className={`group relative flex min-w-0 flex-col gap-2 ${!online && !cached ? 'opacity-50' : ''}`}>
      <a
        href={bookHref(book)}
        className="relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-md border bg-gradient-to-br from-muted to-muted/40 p-3 transition hover:ring-2 hover:ring-foreground/20"
      >
        <span className="flex items-center justify-between text-muted-foreground">
          <BookOpenIcon className="size-5" />
          <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase">
            {cached && <HardDriveIcon className="size-3.5" aria-label="Disponível offline" />}
            {bookFormat(book)}
          </span>
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
          {!online && !cached && <p>Precisa de internet</p>}
          {book.lastReadAt && <p>Lido em {new Date(book.lastReadAt).toLocaleDateString('pt-BR')}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mt-1 size-7 shrink-0" aria-label={`Opções de ${book.title}`}>
              <EllipsisVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onRename} disabled={!online}>
              <PencilIcon />
              Renomear
            </DropdownMenuItem>
            {cached && (
              <DropdownMenuItem onSelect={() => void removeCachedBook(book.file.id)}>
                <HardDriveIcon />
                Remover do aparelho
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onSelect={onDelete} disabled={!online}>
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
