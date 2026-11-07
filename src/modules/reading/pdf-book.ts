/**
 * Turns a PDF into a foliate-js book, so PDFs open in the same reader as EPUBs.
 * Based on foliate-js's experimental pdf.js adapter (pdf.js, not shipped on npm), using
 * pdfjs-dist from npm. Every page is a fixed-layout section: a canvas plus a text layer
 * for selection, redrawn at each zoom. Links inside the PDF are not clickable.
 */
import { GlobalWorkerOptions, PDFDataRangeTransport, TextLayer, getDocument, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist'

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

// The text layer rules from pdf.js's viewer CSS (v6), without the parts the reader doesn't use.
const TEXT_LAYER_CSS = `
  :root { --user-unit: 1; --total-scale-factor: calc(var(--scale-factor) * var(--user-unit)); --scale-round-x: 1px; --scale-round-y: 1px; }
  html, body { margin: 0; padding: 0; }
  .textLayer {
    color-scheme: only light; position: absolute; text-align: initial; inset: 0; overflow: clip; opacity: 1;
    line-height: 1; letter-spacing: normal; word-spacing: normal; text-size-adjust: none; forced-color-adjust: none;
    transform-origin: 0 0; caret-color: CanvasText; z-index: 0;
    --min-font-size: 1;
    --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
    --min-font-size-inv: calc(1 / var(--min-font-size));
  }
  .textLayer :is(span, br) { color: transparent; position: absolute; white-space: pre; cursor: text; transform-origin: 0% 0%; user-select: text; }
  .textLayer > :not(.markedContent), .textLayer .markedContent span:not(.markedContent) {
    z-index: 1; --font-height: 0; font-size: calc(var(--text-scale-factor) * var(--font-height));
    --scale-x: 1; --rotate: 0deg; transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
  }
  .textLayer .markedContent { display: contents; }
  .textLayer span[role="img"] { user-select: none; cursor: default; }
  .textLayer ::selection { background: rgb(0 0 255 / 0.25); color: transparent; }
  .textLayer br::selection { background: transparent; }
  .textLayer .endOfContent { display: block; position: absolute; inset: 100% 0 0; z-index: 0; cursor: default; user-select: none; }
  .textLayer.selecting .endOfContent { top: 0; }
`

async function renderInto(page: PDFPageProxy, doc: Document, zoom: number) {
  const scale = zoom * devicePixelRatio
  doc.documentElement.style.transform = `scale(${1 / devicePixelRatio})`
  doc.documentElement.style.transformOrigin = 'top left'
  doc.documentElement.style.setProperty('--scale-factor', String(scale))
  const viewport = page.getViewport({ scale })

  // The canvas must belong to this document (where pdf.js loads the fonts), then move into the page's frame.
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvas, viewport }).promise
  doc.querySelector('#canvas')?.replaceChildren(doc.adoptNode(canvas))

  const container = doc.querySelector<HTMLElement>('.textLayer')
  if (!container) return
  container.replaceChildren()
  await new TextLayer({ textContentSource: page.streamTextContent(), container, viewport }).render()
  const end = doc.createElement('div')
  end.className = 'endOfContent'
  container.append(end)
  container.onpointerdown = () => container.classList.add('selecting')
  container.onpointerup = () => container.classList.remove('selecting')
}

function pageSection(page: PDFPageProxy) {
  const viewport = page.getViewport({ scale: 1 })
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=${viewport.width}, height=${viewport.height}">
    <style>${TEXT_LAYER_CSS}</style></head>
    <body><div id="canvas"></div><div class="textLayer"></div></body></html>`
  const src = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  return { src, onZoom: ({ doc, scale }: { doc: Document; scale: number }) => renderInto(page, doc, scale) }
}

interface OutlineItem {
  title: string
  dest: string | unknown[] | null
  items: OutlineItem[]
}

interface TocItem {
  label: string
  href: string
  subitems: TocItem[] | null
}

const tocItem = (item: OutlineItem): TocItem => ({
  label: item.title,
  href: JSON.stringify(item.dest),
  subitems: item.items.length ? item.items.map(tocItem) : null,
})

async function pageIndex(pdf: PDFDocumentProxy, href: string): Promise<number> {
  const parsed = JSON.parse(href) as string | unknown[]
  const dest = typeof parsed === 'string' ? await pdf.getDestination(parsed) : parsed
  if (!dest) throw new Error(`Unknown PDF destination ${href}`)
  const [ref] = dest
  return typeof ref === 'number' ? ref : pdf.getPageIndex(ref as Parameters<PDFDocumentProxy['getPageIndex']>[0])
}

/** A foliate-js book for a PDF file. */
export async function makePdfBook(file: Blob) {
  // pdf.js asks for byte ranges as it needs them, so a book stored on the device is never loaded whole.
  const transport = new PDFDataRangeTransport(file.size, null)
  transport.requestDataRange = (begin: number, end: number) => {
    void file
      .slice(begin, end)
      .arrayBuffer()
      .then((chunk) => transport.onDataRange(begin, new Uint8Array(chunk)))
  }
  const task = getDocument({ range: transport, disableAutoFetch: true, disableStream: true })
  const pdf = await task.promise
  const { info } = (await pdf.getMetadata().catch(() => null)) ?? {}
  const details = (info ?? {}) as { Title?: string; Author?: string }
  const outline = (await pdf.getOutline().catch(() => null)) as OutlineItem[] | null
  const cache = new Map<number, ReturnType<typeof pageSection>>()

  return {
    // One page at a time: PDFs are rarely facing pages, and spreads restore to the wrong side on narrow screens.
    rendition: { layout: 'pre-paginated', spread: 'none' },
    metadata: { title: details.Title, author: details.Author },
    toc: outline?.map(tocItem),
    sections: Array.from({ length: pdf.numPages }, (_, i) => ({
      id: i,
      size: 1000,
      load: async () => {
        let section = cache.get(i)
        if (!section) {
          section = pageSection(await pdf.getPage(i + 1))
          cache.set(i, section)
        }
        return section
      },
    })),
    isExternal: (uri: string) => /^\w+:/i.test(uri),
    resolveHref: async (href: string) => ({ index: await pageIndex(pdf, href) }),
    splitTOCHref: async (href: string) => [await pageIndex(pdf, href), null],
    getTOCFragment: (doc: Document) => doc.documentElement,
    destroy: () => {
      for (const section of cache.values()) URL.revokeObjectURL(section.src)
      void task.destroy()
    },
  }
}
