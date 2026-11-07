import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import 'foliate-js/view.js'
import type { FoliateDataDetail, FoliateMetadata, FoliateRelocateDetail, FoliateView } from 'foliate-js/view.js'
import { Button } from '@/components/ui/button'
import { ReaderMessage } from './ReaderMessage'
import { isMarkup, sanitizeMarkup } from './sanitize'
import { EPUB_MIME, type BookFormat, type BookProgress } from './types'

const TOOLBAR_HEIGHT = 52
/** Fixed-layout books (PDFs) fit the whole page by default; the toolbar switches to the width. */
type FitMode = 'fit-page' | 'fit-width'
const FIT_KEY = 'vault-reading-fit'

function storedFit(): FitMode {
  try {
    return localStorage.getItem(FIT_KEY) === 'fit-width' ? 'fit-width' : 'fit-page'
  } catch {
    return 'fit-page'
  }
}
const FONT_SIZES = [80, 90, 100, 110, 120, 135, 150, 170]
const FONT_KEY = 'vault-reading-font'

function storedFontSize(): number {
  try {
    const value = Number(localStorage.getItem(FONT_KEY))
    return FONT_SIZES.includes(value) ? value : 100
  } catch {
    return 100
  }
}

/** Injected into every chapter; colors follow the OS theme like the rest of the app. */
function bookCss(fontSize: number): string {
  return `
    html { color-scheme: light dark; font-size: ${fontSize}%; }
    @media (prefers-color-scheme: dark) {
      html { color: #e5e5e5; }
      a:link { color: lightblue; }
    }
    p, li, blockquote, dd { line-height: 1.5; hyphens: auto; widows: 2; orphans: 2; }
    pre { white-space: pre-wrap !important; }
  `
}

/** Turns foliate's metadata values (strings, language maps, contributors, lists) into plain text. */
function metadataText(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value.trim() || undefined
  if (Array.isArray(value)) return value.map(metadataText).filter(Boolean).join(', ') || undefined
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return metadataText('name' in record ? record.name : Object.values(record)[0])
  }
  return undefined
}

export interface BookDetails {
  title?: string
  author?: string
}

/** Opens the file as a foliate-js book: EPUBs reflow, PDFs become fixed-layout pages. */
async function openBook(foliate: FoliateView, blob: Blob, fileName: string, format: BookFormat) {
  if (format === 'pdf') {
    // pdf.js loads only when a PDF is opened.
    const { makePdfBook } = await import('./pdf-book')
    await foliate.open(await makePdfBook(blob))
    return
  }
  // foliate tells formats apart by file name, so hand it a named File (wrapping a Blob does not copy its data).
  await foliate.open(new File([blob], fileName, { type: EPUB_MIME }))
  // Runs before each chapter is turned into a blob: URL, so nothing unsafe ever renders.
  foliate.book.transformTarget?.addEventListener('data', (event) => {
    const detail = (event as CustomEvent<FoliateDataDetail>).detail
    detail.data = Promise.all([detail.data, detail.type]).then(([data, type]) =>
      typeof data === 'string' && isMarkup(type) ? sanitizeMarkup(data, type) : data,
    )
  })
}

/** Paginated reader (foliate-js) for EPUB and PDF: swipe, click the arrows or use ← → to turn pages. */
export default function BookViewer({
  file,
  fileName,
  format,
  initialCfi,
  onRelocate,
  onDetails,
}: {
  /** Ideally a disk-backed File from the device's copy, which the readers slice instead of loading whole */
  file: Blob
  fileName: string
  format: BookFormat
  initialCfi?: string
  onRelocate: (position: BookProgress) => void
  onDetails: (details: BookDetails) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<FoliateView | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [fraction, setFraction] = useState<number | null>(null)
  const [chapter, setChapter] = useState<string | null>(null)
  const [pageLabel, setPageLabel] = useState<string | null>(null)
  const [fixedLayout, setFixedLayout] = useState(false)
  const [fontSize, setFontSize] = useState(storedFontSize)
  const [fit, setFit] = useState(storedFit)
  // Read once on open; later changes come from the reader itself.
  const start = useRef({ initialCfi, fontSize, fit, onRelocate, onDetails })
  useEffect(() => {
    start.current.onRelocate = onRelocate
    start.current.onDetails = onDetails
  }, [onRelocate, onDetails])

  const turn = useCallback((direction: 'left' | 'right') => {
    const current = view.current
    if (!current) return
    void (direction === 'left' ? current.goLeft() : current.goRight())
  }, [])

  useEffect(() => {
    const container = host.current
    if (!container) return
    let cancelled = false
    const foliate = document.createElement('foliate-view') as FoliateView
    foliate.style.display = 'block'
    foliate.style.height = '100%'
    container.append(foliate)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'ArrowLeft') turn('left')
      else if (event.key === 'ArrowRight') turn('right')
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    // Chapters render in iframes, which don't pass keys up to the window.
    foliate.addEventListener('load', (event) => {
      const { doc } = (event as CustomEvent<{ doc: Document }>).detail
      doc.addEventListener('keydown', onKeyDown)
    })
    foliate.addEventListener('relocate', (event) => {
      const detail = (event as CustomEvent<FoliateRelocateDetail>).detail
      setFraction(detail.fraction)
      setChapter(detail.tocItem?.label?.trim() || null)
      setPageLabel(detail.section ? `Pág. ${detail.section.current + 1} de ${detail.section.total}` : null)
      if (detail.cfi) start.current.onRelocate({ cfi: detail.cfi, fraction: detail.fraction })
    })

    async function open() {
      await openBook(foliate, file, fileName, format)
      if (cancelled) return
      const renderer = foliate.renderer
      if (foliate.isFixedLayout) {
        renderer.setAttribute('zoom', start.current.fit)
      } else {
        renderer.setAttribute('flow', 'paginated')
        renderer.setAttribute('margin', '32px')
        renderer.setAttribute('gap', '6%')
        renderer.setAttribute('max-inline-size', '680px')
        renderer.setAttribute('max-column-count', '2')
        renderer.setStyles?.(bookCss(start.current.fontSize))
      }
      setFixedLayout(foliate.isFixedLayout)
      // A PDF's Title field is often junk ("Microsoft Word - doc1.docx"), so only EPUBs name themselves.
      if (format === 'epub') {
        const metadata: FoliateMetadata = foliate.book.metadata ?? {}
        start.current.onDetails({ title: metadataText(metadata.title), author: metadataText(metadata.author) })
      }
      await foliate.init({ lastLocation: start.current.initialCfi ?? null, showTextStart: !start.current.initialCfi })
      if (cancelled) return
      view.current = foliate
      setStatus('ready')
    }
    open().catch((err: unknown) => {
      console.error('Could not open book', err)
      if (!cancelled) setStatus('error')
    })

    return () => {
      cancelled = true
      window.removeEventListener('keydown', onKeyDown)
      view.current = null
      foliate.close()
      foliate.book?.destroy?.()
      foliate.remove()
    }
  }, [file, fileName, format, turn])

  const changeFontSize = (next: number) => {
    setFontSize(next)
    view.current?.renderer.setStyles?.(bookCss(next))
    try {
      localStorage.setItem(FONT_KEY, String(next))
    } catch {
      // Font size just isn't remembered on this device.
    }
  }
  const toggleFit = () => {
    const next: FitMode = fit === 'fit-page' ? 'fit-width' : 'fit-page'
    setFit(next)
    view.current?.renderer.setAttribute('zoom', next)
    try {
      localStorage.setItem(FIT_KEY, next)
    } catch {
      // The fit just isn't remembered on this device.
    }
  }
  const fontIndex = FONT_SIZES.indexOf(fontSize)
  const ready = status === 'ready'

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 border-b px-4 lg:px-6" style={{ height: TOOLBAR_HEIGHT }}>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => turn('left')} disabled={!ready} aria-label="Página anterior">
          <ChevronLeftIcon />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => turn('right')} disabled={!ready} aria-label="Próxima página">
          <ChevronRightIcon />
        </Button>
        <div className="flex min-w-0 items-baseline gap-2 px-1 text-sm">
          {fixedLayout && pageLabel ? (
            <span className="shrink-0 tabular-nums">{pageLabel}</span>
          ) : (
            fraction !== null && <span className="shrink-0 tabular-nums">{Math.round(fraction * 100)}%</span>
          )}
          {chapter && <span className="truncate text-muted-foreground">{chapter}</span>}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {fixedLayout ? (
            <Button variant="ghost" size="sm" onClick={toggleFit} disabled={!ready}>
              {fit === 'fit-page' ? 'Ajustar à largura' : 'Página inteira'}
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="px-2" onClick={() => changeFontSize(FONT_SIZES[fontIndex - 1])} disabled={fontIndex <= 0} aria-label="Diminuir fonte">
                A−
              </Button>
              <Button variant="ghost" size="sm" className="px-2 text-base" onClick={() => changeFontSize(FONT_SIZES[fontIndex + 1])} disabled={fontIndex >= FONT_SIZES.length - 1} aria-label="Aumentar fonte">
                A+
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Fills the screen below the header and toolbar; the inset layout adds a 0.5rem margin around it from md up. */}
      <div className="relative h-[calc(100svh-var(--header-height)-52px)] md:h-[calc(100svh-var(--header-height)-52px-1rem)]">
        <div ref={host} className="absolute inset-0" />
        {status === 'loading' && (
          <div className="absolute inset-0 bg-background">
            <ReaderMessage spinner>Abrindo o livro…</ReaderMessage>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 bg-background">
            <ReaderMessage>Não foi possível abrir este livro.</ReaderMessage>
          </div>
        )}
      </div>
    </div>
  )
}
