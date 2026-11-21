import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, Extension, ReactNodeViewRenderer, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extensions'
import { BookOpenIcon, PencilIcon } from 'lucide-react'
import { toast } from 'sonner'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useAttachments } from '@/storage/useAttachments'
import { ATTACHMENT_PREFIX, NoteImage } from './NoteImage'
import { UNTITLED, type Note } from './types'
import type { NoteContent, SaveResult } from './useNotes'

const SAVE_DELAY = 800

const NoteImageNode = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(NoteImage)
  },
})

/** ⌘⌥T / Ctrl+Alt+T inserts a 3×3 table; Tab moves between cells and adds a row from the last one. */
const TableShortcut = Extension.create({
  name: 'tableShortcut',
  addKeyboardShortcuts() {
    return { 'Mod-Alt-t': () => this.editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true }) }
  },
})

/** Plain text that is clearly Markdown is pasted as formatted content instead of literal symbols. */
const MARKDOWN_HINT = /^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|>\s|```|\|.*\|\s*$)|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)/m

/** GitHub-style heading anchor: "1. Visão geral (RTH)" → "1-visão-geral-rth". */
function headingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

/** Scrolls to the heading a "#section" link points to; true when the click was such a link. */
function followAnchor(root: HTMLElement, event: MouseEvent): boolean {
  const link = (event.target as Element | null)?.closest('a')
  const href = link?.getAttribute('href')
  // "#/…" is an app route, not a section of the note.
  if (!link || !href?.startsWith('#') || href.startsWith('#/') || !root.contains(link)) return false
  // The app routes with the hash, so the link must never reach the browser.
  event.preventDefault()
  let target = href.slice(1)
  try {
    target = decodeURIComponent(target)
  } catch {
    // Keep it as written.
  }
  const heading = [...root.querySelectorAll('h1, h2, h3, h4, h5, h6')].find(
    (h) => headingSlug(h.textContent ?? '') === target.toLowerCase(),
  )
  heading?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return true
}

interface NoteEditorProps {
  note: Note
  readOnly: boolean
  loadContent: (noteId: string) => Promise<NoteContent | null>
  saveContent: (noteId: string, markdown: string, expected: string | undefined) => Promise<SaveResult>
  onRename: (title: string) => void
}

export function NoteEditor(props: NoteEditorProps) {
  const { note, loadContent } = props
  const [content, setContent] = useState<{ noteId: string; value: NoteContent | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    loadContent(note.id).then((value) => !cancelled && setContent({ noteId: note.id, value }))
    return () => {
      cancelled = true
    }
  }, [note.id, loadContent])

  if (content?.noteId !== note.id) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (!content.value) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Esta nota ainda não foi baixada neste aparelho. Abra-a com internet para ler offline depois.
      </p>
    )
  }
  return <EditorBody key={note.id} {...props} initial={content.value} />
}

const READING_KEY = 'vault.notes.reading'

/** Reading mode is a per-device preference: it stays on across notes until switched back. */
function loadReading(): boolean {
  try {
    return localStorage.getItem(READING_KEY) === '1'
  } catch {
    return false
  }
}

function saveReading(reading: boolean) {
  try {
    localStorage.setItem(READING_KEY, reading ? '1' : '0')
  } catch {
    // Only a convenience: the next note opens in editing mode.
  }
}

type Status = 'saved' | 'pending' | 'saving' | 'error'

const STATUS_LABEL: Record<Status, string> = {
  saved: 'Salvo',
  pending: 'Alterações não salvas',
  saving: 'Salvando…',
  error: 'Não salvo',
}

function EditorBody({ note, readOnly, loadContent, saveContent, onRename, initial }: NoteEditorProps & { initial: NoteContent }) {
  const [title, setTitle] = useState(note.title)
  const [status, setStatus] = useState<Status>('saved')
  // Offline (readOnly) nothing can be edited; reading is the user's own choice to just view.
  const [reading, setReading] = useState(loadReading)
  const locked = readOnly || reading
  const [conflict, setConflict] = useState(false)
  const { upload } = useAttachments('notes')

  // The version on Drive this editor is based on, and Markdown typed but not yet saved.
  const base = useRef(initial.modifiedTime)
  const unsaved = useRef<string | null>(null)
  const blocked = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const editorRef = useRef<Editor | null>(null)

  /** Saves run one after another; each takes whatever is unsaved at that moment. */
  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    chain.current = chain.current.then(async () => {
      const markdown = unsaved.current
      if (markdown === null || blocked.current) return
      unsaved.current = null
      setStatus('saving')
      const result = await saveContent(note.id, markdown, base.current)
      if (result.ok) {
        base.current = result.modifiedTime
        setStatus(unsaved.current === null ? 'saved' : 'pending')
        return
      }
      // Keep the text for the next attempt, unless something newer was typed meanwhile.
      unsaved.current ??= markdown
      if (result.conflict) {
        blocked.current = true
        setConflict(true)
      }
      setStatus('error')
    })
    return chain.current
  }, [note.id, saveContent])

  const schedule = useCallback(
    (editor: Editor) => {
      unsaved.current = editor.getMarkdown()
      setStatus('pending')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, SAVE_DELAY)
    },
    [flush],
  )
  const scheduleRef = useRef(schedule)
  useEffect(() => {
    scheduleRef.current = schedule
  }, [schedule])

  const insertImages = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'))
      if (!images.length) return false
      const id = toast.loading(images.length > 1 ? 'Enviando imagens…' : 'Enviando imagem…')
      const uploaded = await upload(images)
      toast.dismiss(id)
      for (const attachment of uploaded ?? []) {
        editorRef.current?.chain().focus().setImage({ src: `${ATTACHMENT_PREFIX}${attachment.id}`, alt: attachment.name }).run()
      }
      return true
    },
    [upload],
  )
  const insertImagesRef = useRef(insertImages)
  useEffect(() => {
    insertImagesRef.current = insertImages
  }, [insertImages])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      Markdown,
      TaskList,
      TaskItem.configure({ nested: true }),
      NoteImageNode,
      TableKit.configure({ table: { resizable: false } }),
      TableShortcut,
      Placeholder.configure({ placeholder: 'Escreva aqui…' }),
    ],
    content: initial.markdown,
    contentType: 'markdown',
    editable: !locked,
    onUpdate: ({ editor }) => scheduleRef.current(editor),
    editorProps: {
      attributes: { class: 'note-content min-h-[50svh] outline-none' },
      handleDOMEvents: {
        click: (view, event) => followAnchor(view.dom, event),
      },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])]
        if (files.some((f) => f.type.startsWith('image/'))) {
          void insertImagesRef.current(files)
          return true
        }
        const text = event.clipboardData?.getData('text/plain') ?? ''
        if (!event.clipboardData?.getData('text/html') && MARKDOWN_HINT.test(text)) {
          editorRef.current?.commands.insertContent(text, { contentType: 'markdown' })
          return true
        }
        return false
      },
      handleDrop: (_view, event, _slice, moved) => {
        const files = [...(event.dataTransfer?.files ?? [])]
        if (moved || !files.some((f) => f.type.startsWith('image/'))) return false
        event.preventDefault()
        void insertImagesRef.current(files)
        return true
      },
    },
  })

  // Paste and image handlers are set up before the editor exists, so they reach it through this ref.
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    editor.setEditable(!locked)
  }, [editor, locked])

  // Back online with unsaved text (the connection dropped mid-save): try again.
  useEffect(() => {
    if (!readOnly && unsaved.current !== null && !blocked.current) void flush()
  }, [readOnly, flush])

  // Leaving the note, hiding the tab or closing the app saves right away instead of waiting.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      void flush()
    }
  }, [flush])

  // The title is part of notes.json, saved on its own shortly after typing stops.
  const titleTimer = useRef<number | undefined>(undefined)
  const renameRef = useRef(onRename)
  useEffect(() => {
    renameRef.current = onRename
  }, [onRename])
  const commitTitle = useCallback((value: string) => {
    window.clearTimeout(titleTimer.current)
    renameRef.current(value.trim())
  }, [])
  useEffect(() => () => window.clearTimeout(titleTimer.current), [])

  async function keepMine() {
    blocked.current = false
    setConflict(false)
    // Overwrite: the next save skips the version check once.
    base.current = ''
    await flush()
  }

  async function takeDriveVersion() {
    const latest = await loadContent(note.id)
    if (!latest) return
    blocked.current = false
    unsaved.current = null
    base.current = latest.modifiedTime
    editor.commands.setContent(latest.markdown, { contentType: 'markdown', emitUpdate: false })
    setConflict(false)
    setStatus('saved')
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            window.clearTimeout(titleTimer.current)
            const value = e.target.value
            titleTimer.current = window.setTimeout(() => commitTitle(value), SAVE_DELAY)
          }}
          onBlur={() => title.trim() !== note.title && commitTitle(title)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              editor.commands.focus('start')
            }
          }}
          placeholder={UNTITLED}
          disabled={locked}
          aria-label="Título"
          className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60 disabled:opacity-100"
        />
        {!locked && (
          <span className={`shrink-0 pt-2 text-xs ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
            {STATUS_LABEL[status]}
          </span>
        )}
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-0.5 shrink-0 text-muted-foreground"
            onClick={() => {
              // Switching to reading saves right away whatever is still waiting.
              if (!reading) void flush()
              setReading(!reading)
              saveReading(!reading)
            }}
            aria-pressed={reading}
            title={reading ? 'Voltar a editar' : 'Só visualizar, sem editar'}
          >
            {reading ? <PencilIcon /> : <BookOpenIcon />}
            {reading ? 'Editar' : 'Ler'}
          </Button>
        )}
      </div>

      <EditorContent editor={editor} />

      <AlertDialog open={conflict}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nota alterada em outro aparelho</AlertDialogTitle>
            <AlertDialogDescription>
              Esta nota mudou no Drive depois que você a abriu. Escolha qual versão fica: a do Drive descarta o que você
              digitou aqui; a sua substitui a do Drive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={takeDriveVersion}>Usar a do Drive</AlertDialogCancel>
            <AlertDialogAction onClick={keepMine}>Manter a minha</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
