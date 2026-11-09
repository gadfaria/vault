import { useMemo, useRef, useState, type FormEvent } from 'react'
import { navigate } from '@/lib/navigate'
import {
  ChevronRightIcon,
  EllipsisIcon,
  FilePlusIcon,
  FileTextIcon,
  FileUpIcon,
  FolderIcon,
  FolderInputIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  WifiOffIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Field } from '@/components/form-field'
import { SiteHeader, type Crumb } from '@/components/site-header'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { ModuleScreenProps } from '..'
import { NoteEditor } from './NoteEditor'
import { folderOptions, folderPath, isInside, UNTITLED, type FolderNode, type Note, type NoteFolder } from './types'
import { useNotes } from './useNotes'

const EXPANDED_KEY = 'vault.notes.expanded'
/** Select values can't be empty strings; this stands for the top level. */
const TOP = 'top'

function loadExpanded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function saveExpanded(ids: Set<string>) {
  try {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...ids]))
  } catch {
    // Only a convenience: folders start collapsed next time.
  }
}

type NameDialogState = { kind: 'create'; parentId: string } | { kind: 'rename'; folder: NoteFolder }
type MoveTarget = { kind: 'note'; note: Note } | { kind: 'folder'; folder: NoteFolder }

export function NotesScreen({ path }: ModuleScreenProps) {
  const notes = useNotes({ sync: true })
  const noteId = path[0]
  const open = noteId ? notes.notes.find((n) => n.id === noteId) : undefined
  const [selectedFolder, setSelectedFolder] = useState('')
  const [expanded, setExpanded] = useState(loadExpanded)
  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null)
  const [moving, setMoving] = useState<MoveTarget | null>(null)
  const [deleting, setDeleting] = useState<MoveTarget | null>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const importFolder = useRef('')

  // New notes go next to the open one, or into the folder last clicked.
  const currentFolder = open ? open.folderId : selectedFolder

  // Opening a note (also from search) unfolds the folders above it, once per note opened.
  const [unfoldedFor, setUnfoldedFor] = useState<string | undefined>(undefined)
  if (open && open.id !== unfoldedFor) {
    setUnfoldedFor(open.id)
    const next = new Set(expanded)
    for (let id = open.folderId, steps = 0; id && steps < 50; steps++) {
      next.add(id)
      id = notes.folders.find((f) => f.id === id)?.parentId ?? ''
    }
    if (next.size !== expanded.size) setExpanded(next)
  }

  function toggleFolder(id: string) {
    setSelectedFolder(id)
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveExpanded(next)
      return next
    })
  }

  async function newNote(folderId: string) {
    const note = await notes.createNote(folderId, '')
    if (note) navigate(`#/notes/${note.id}`)
  }

  function startImport(folderId: string) {
    importFolder.current = folderId
    importInput.current?.click()
  }

  async function importFiles(files: File[]) {
    const id = toast.loading(files.length > 1 ? `Importando ${files.length} notas…` : 'Importando nota…')
    let imported: Note | null = null
    let count = 0
    for (const file of files) {
      const title = file.name.replace(/\.(md|markdown|txt)$/i, '')
      const note = await notes.createNote(importFolder.current, title, await file.text())
      if (!note) break
      imported = note
      count++
    }
    toast.dismiss(id)
    if (count) toast.success(count > 1 ? `${count} notas importadas` : 'Nota importada')
    if (imported) navigate(`#/notes/${imported.id}`)
  }

  async function confirmDelete() {
    if (!deleting) return
    const target = deleting
    setDeleting(null)
    const ok = target.kind === 'note' ? await notes.deleteNote(target.note) : await notes.deleteFolder(target.folder)
    if (!ok) return
    const removedOpen =
      open && (target.kind === 'note' ? target.note.id === open.id : isInside(notes.folders, open.folderId, target.folder.id))
    if (removedOpen) navigate('#/notes')
    if (target.kind === 'folder' && selectedFolder && isInside(notes.folders, selectedFolder, target.folder.id)) {
      setSelectedFolder('')
    }
  }

  const crumbs: Crumb[] = [{ label: 'Notas', href: open || noteId ? '#/notes' : undefined }]
  if (open) crumbs.push({ label: open.title || UNTITLED })
  // Shown above the title instead of in the header, where it would squeeze the title out on phones.
  const openPath = open ? folderPath(notes.folders, open.folderId).join(' / ') : ''

  const actions = {
    readOnly: notes.readOnly,
    onNewNote: newNote,
    onNewFolder: (parentId: string) => setNameDialog({ kind: 'create', parentId }),
    onImport: startImport,
    onRename: (folder: NoteFolder) => setNameDialog({ kind: 'rename', folder }),
    onMove: setMoving,
    onDelete: setDeleting,
  }

  return (
    <>
      <SiteHeader title={crumbs}>
        {!notes.readOnly && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-8" aria-label="Mais ações">
                  <EllipsisIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setNameDialog({ kind: 'create', parentId: currentFolder })}>
                  <FolderPlusIcon />
                  Nova pasta
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => startImport(currentFolder)}>
                  <FileUpIcon />
                  Importar .md
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => newNote(currentFolder)} disabled={notes.loading}>
              <PlusIcon />
              <span className="hidden sm:inline">Nova nota</span>
              <span className="sm:hidden">Nova</span>
            </Button>
          </>
        )}
      </SiteHeader>

      <input
        ref={importInput}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) void importFiles(files)
        }}
      />

      <div className="flex min-h-0 flex-1">
        <aside className={`w-full shrink-0 border-r md:block md:w-72 ${noteId ? 'hidden' : ''}`}>
          <div className="flex flex-col gap-0.5 p-2 md:sticky md:top-0 md:max-h-[calc(100svh-var(--header-height)-1rem)] md:overflow-y-auto">
            {notes.readOnly && !notes.loading && (
              <p className="mb-2 flex items-center gap-2 rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                <WifiOffIcon className="size-3.5 shrink-0" />
                Somente leitura: cópia salva neste aparelho.
              </p>
            )}
            {notes.loading ? (
              <div className="flex flex-col gap-2 p-1">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            ) : notes.tree.folders.length === 0 && notes.tree.notes.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {notes.readOnly ? 'Nenhuma nota salva neste aparelho.' : 'Nenhuma nota ainda.'}
              </p>
            ) : (
              <TreeLevel
                level={notes.tree}
                depth={0}
                expanded={expanded}
                selectedFolder={currentFolder}
                openId={open?.id}
                onToggle={toggleFolder}
                {...actions}
              />
            )}
          </div>
        </aside>

        <main className={`min-w-0 flex-1 px-4 py-4 md:px-8 md:py-6 ${noteId ? '' : 'hidden md:block'}`}>
          <div className="mx-auto w-full max-w-3xl">
            {openPath && (
              <p className="mb-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <FolderIcon className="size-3.5 shrink-0" />
                {openPath}
              </p>
            )}
            {open ? (
              <NoteEditor
                note={open}
                readOnly={notes.readOnly}
                loadContent={notes.loadContent}
                saveContent={notes.saveContent}
                onRename={(title) => title !== open.title && notes.updateNote(open, { title })}
              />
            ) : noteId && !notes.loading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Nota não encontrada.</p>
            ) : (
              !notes.loading && (
                <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-muted-foreground">
                  <FileTextIcon className="size-8 opacity-40" />
                  Escolha uma nota na lista
                  {!notes.readOnly && (
                    <Button variant="outline" size="sm" onClick={() => newNote(currentFolder)}>
                      <PlusIcon />
                      Nova nota
                    </Button>
                  )}
                </div>
              )
            )}
          </div>
        </main>
      </div>

      <FolderNameDialog
        state={nameDialog}
        onOpenChange={(value) => !value && setNameDialog(null)}
        onSubmit={async (name) => {
          if (!nameDialog) return false
          if (nameDialog.kind === 'rename') return notes.updateFolder(nameDialog.folder, { name })
          const folder = await notes.createFolder(name, nameDialog.parentId)
          if (folder && nameDialog.parentId) {
            setExpanded((current) => {
              const next = new Set(current).add(nameDialog.parentId)
              saveExpanded(next)
              return next
            })
          }
          if (folder) setSelectedFolder(folder.id)
          return folder !== null
        }}
      />

      <MoveDialog
        target={moving}
        folders={notes.folders}
        onOpenChange={(value) => !value && setMoving(null)}
        onSubmit={(folderId) =>
          moving?.kind === 'note'
            ? notes.updateNote(moving.note, { folderId })
            : moving
              ? notes.updateFolder(moving.folder, { parentId: folderId })
              : Promise.resolve(false)
        }
      />

      <AlertDialog open={deleting !== null} onOpenChange={(value) => !value && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleting?.kind === 'folder' ? 'Excluir pasta?' : 'Excluir nota?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.kind === 'folder'
                ? `A pasta "${deleting.folder.name}" e tudo o que está dentro dela serão excluídos.`
                : `A nota "${deleting?.note.title || UNTITLED}" será excluída.`}{' '}
              Os arquivos vão para a lixeira do Drive, onde ficam por 30 dias.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

interface TreeActions {
  readOnly: boolean
  onNewNote: (folderId: string) => void
  onNewFolder: (parentId: string) => void
  onImport: (folderId: string) => void
  onRename: (folder: NoteFolder) => void
  onMove: (target: MoveTarget) => void
  onDelete: (target: MoveTarget) => void
}

interface TreeLevelProps extends TreeActions {
  level: { folders: FolderNode[]; notes: Note[] }
  depth: number
  expanded: Set<string>
  selectedFolder: string
  openId?: string
  onToggle: (id: string) => void
}

function TreeLevel({ level, depth, ...props }: TreeLevelProps) {
  const indent = { paddingLeft: `${depth * 0.875 + 0.25}rem` }
  return (
    <>
      {level.folders.map((node) => {
        const isOpen = props.expanded.has(node.folder.id)
        return (
          <div key={node.folder.id} className="flex flex-col gap-0.5">
            <TreeRow
              style={indent}
              active={props.selectedFolder === node.folder.id && !props.openId}
              onClick={() => props.onToggle(node.folder.id)}
              icon={
                <>
                  <ChevronRightIcon className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  {isOpen ? <FolderOpenIcon className="size-4 shrink-0" /> : <FolderIcon className="size-4 shrink-0" />}
                </>
              }
              label={node.folder.name}
              menu={
                !props.readOnly && (
                  <>
                    <DropdownMenuItem onSelect={() => props.onNewNote(node.folder.id)}>
                      <FilePlusIcon />
                      Nova nota aqui
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => props.onNewFolder(node.folder.id)}>
                      <FolderPlusIcon />
                      Nova subpasta
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => props.onImport(node.folder.id)}>
                      <FileUpIcon />
                      Importar .md aqui
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => props.onRename(node.folder)}>
                      <PencilIcon />
                      Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => props.onMove({ kind: 'folder', folder: node.folder })}>
                      <FolderInputIcon />
                      Mover
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => props.onDelete({ kind: 'folder', folder: node.folder })}>
                      <Trash2Icon />
                      Excluir
                    </DropdownMenuItem>
                  </>
                )
              }
            />
            {isOpen && <TreeLevel level={node} depth={depth + 1} {...props} />}
          </div>
        )
      })}
      {level.notes.map((note) => (
        <TreeRow
          key={note.id}
          style={{ paddingLeft: `${depth * 0.875 + 1.125}rem` }}
          active={props.openId === note.id}
          href={`#/notes/${note.id}`}
          icon={<FileTextIcon className="size-4 shrink-0 text-muted-foreground" />}
          label={note.title || UNTITLED}
          muted={!note.title}
          menu={
            !props.readOnly && (
              <>
                <DropdownMenuItem onSelect={() => props.onMove({ kind: 'note', note })}>
                  <FolderInputIcon />
                  Mover
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => props.onDelete({ kind: 'note', note })}>
                  <Trash2Icon />
                  Excluir
                </DropdownMenuItem>
              </>
            )
          }
        />
      ))}
    </>
  )
}

function TreeRow({
  style,
  active,
  muted,
  href,
  onClick,
  icon,
  label,
  menu,
}: {
  style: React.CSSProperties
  active: boolean
  muted?: boolean
  href?: string
  onClick?: () => void
  icon: React.ReactNode
  label: string
  menu: React.ReactNode
}) {
  const content = (
    <>
      {icon}
      <span className={`truncate ${muted ? 'text-muted-foreground' : ''}`}>{label}</span>
    </>
  )
  const className = 'flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pr-1 text-left text-sm outline-none'
  return (
    <div
      className={`group flex items-center rounded-md hover:bg-muted focus-within:bg-muted ${active ? 'bg-muted font-medium' : ''}`}
    >
      {href ? (
        <a href={href} style={style} className={className}>
          {content}
        </a>
      ) : (
        <button type="button" style={style} onClick={onClick} className={className}>
          {content}
        </button>
      )}
      {menu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="mr-0.5 size-6 shrink-0 opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 md:opacity-0"
              aria-label={`Ações de ${label}`}
            >
              <EllipsisIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">{menu}</DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function FolderNameDialog({
  state,
  onOpenChange,
  onSubmit,
}: {
  state: NameDialogState | null
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => Promise<boolean>
}) {
  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {state && (
          <FolderNameForm
            key={state.kind === 'rename' ? state.folder.id : 'new'}
            initial={state.kind === 'rename' ? state.folder.name : ''}
            title={state.kind === 'rename' ? 'Renomear pasta' : 'Nova pasta'}
            onSubmit={onSubmit}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FolderNameForm({
  initial,
  title,
  onSubmit,
  onDone,
}: {
  initial: string
  title: string
  onSubmit: (name: string) => Promise<boolean>
  onDone: () => void
}) {
  const [name, setName] = useState(initial)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setPending(true)
    const ok = await onSubmit(name.trim())
    setPending(false)
    if (ok) onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <Field label="Nome" id="folder-name">
        <Input id="folder-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" />
      </Field>
      <DialogFooter>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? 'Salvando…' : 'Salvar'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function MoveDialog({
  target,
  folders,
  onOpenChange,
  onSubmit,
}: {
  target: MoveTarget | null
  folders: NoteFolder[]
  onOpenChange: (open: boolean) => void
  onSubmit: (folderId: string) => Promise<boolean>
}) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {target && (
          <MoveForm
            key={target.kind === 'note' ? target.note.id : target.folder.id}
            target={target}
            folders={folders}
            onSubmit={onSubmit}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function MoveForm({
  target,
  folders,
  onSubmit,
  onDone,
}: {
  target: MoveTarget
  folders: NoteFolder[]
  onSubmit: (folderId: string) => Promise<boolean>
  onDone: () => void
}) {
  const current = target.kind === 'note' ? target.note.folderId : target.folder.parentId
  const [choice, setChoice] = useState(current || TOP)
  const [pending, setPending] = useState(false)
  // A folder can't go inside itself or one of its own subfolders.
  const options = useMemo(
    () =>
      folderOptions(folders).filter((o) => target.kind === 'note' || !isInside(folders, o.id, target.folder.id)),
    [folders, target],
  )

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const folderId = choice === TOP ? '' : choice
    if (folderId === current) {
      onDone()
      return
    }
    setPending(true)
    const ok = await onSubmit(folderId)
    setPending(false)
    if (ok) onDone()
  }

  const name = target.kind === 'note' ? target.note.title || UNTITLED : target.folder.name
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle className="truncate">Mover "{name}"</DialogTitle>
      </DialogHeader>
      <Field label="Para a pasta" id="move-target">
        <Select value={choice} onValueChange={setChoice}>
          <SelectTrigger id="move-target" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TOP}>Notas (início)</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? 'Movendo…' : 'Mover'}
        </Button>
      </DialogFooter>
    </form>
  )
}
