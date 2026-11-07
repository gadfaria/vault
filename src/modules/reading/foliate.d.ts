/** The parts of foliate-js (untyped) that the EPUB reader uses. */
declare module 'foliate-js/view.js' {
  export interface FoliateMetadata {
    /** A string or a language map ({ en: '…' }) */
    title?: unknown
    /** A string, a contributor ({ name }) or a list of them */
    author?: unknown
  }

  export interface FoliateRelocateDetail {
    /** 0–1 through the whole book */
    fraction: number
    cfi: string
    tocItem?: { label?: string } | null
    /** Sections are chapters in an EPUB and pages in a PDF */
    section?: { current: number; total: number }
  }

  export interface FoliateRenderer extends HTMLElement {
    setStyles?(css: string): void
  }

  /** A book resource about to become a blob: URL; `data` and `type` may be replaced. */
  export interface FoliateDataDetail {
    readonly name: string
    data: string | Blob | Promise<string | Blob>
    type: string | Promise<string>
  }

  export interface FoliateView extends HTMLElement {
    book: { metadata?: FoliateMetadata; dir?: string; transformTarget?: EventTarget; destroy?(): void }
    renderer: FoliateRenderer
    isFixedLayout: boolean
    /** A file, a URL, or a book object made by an adapter (e.g. the PDF one) */
    open(book: File | Blob | string | object): Promise<void>
    init(options: { lastLocation?: string | null; showTextStart?: boolean }): Promise<void>
    close(): void
    goLeft(): Promise<void>
    goRight(): Promise<void>
    goToFraction(fraction: number): Promise<void>
  }

  export class View extends HTMLElement {}
}
