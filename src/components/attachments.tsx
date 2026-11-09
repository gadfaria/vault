import { useRef } from "react"
import { FileIcon, FileTextIcon, Loader2Icon, PaperclipIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Attachment } from "@/domain/types"
import { formatBytes } from "@/lib/format"
import { isInertType } from "@/lib/safe-files"
import { useAttachmentUrl } from "@/storage/useAttachments"

/** Thumbnails for images, a file tile for anything else. Click opens the file in a new tab. */
export function AttachmentGrid({
  attachments,
  onRemove,
}: {
  attachments: Attachment[]
  onRemove?: (attachment: Attachment) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {attachments.map((attachment) => (
        <AttachmentTile key={attachment.id} attachment={attachment} onRemove={onRemove} />
      ))}
    </div>
  )
}

function AttachmentTile({
  attachment,
  onRemove,
}: {
  attachment: Attachment
  onRemove?: (attachment: Attachment) => void
}) {
  const url = useAttachmentUrl(attachment.id)
  const isImage = attachment.mimeType.startsWith("image/")
  const extension = attachment.name.split(".").pop()?.toUpperCase() ?? ""

  return (
    <div className="group flex min-w-0 flex-col gap-1.5">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md border bg-muted">
        {!url ? (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
          </div>
        ) : isImage ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <FileTextIcon className="size-6" />
            <span className="text-xs font-medium">{extension}</span>
          </div>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            download={isInertType(attachment.mimeType) ? undefined : attachment.name}
            className="absolute inset-0 ring-foreground/20 transition hover:ring-2 hover:ring-inset"
            aria-label={`Abrir ${attachment.name}`}
          />
        )}
        {onRemove && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-1.5 right-1.5 size-6 opacity-100 shadow-sm sm:opacity-0 sm:group-hover:opacity-100"
            aria-label={`Remover ${attachment.name}`}
            onClick={() => onRemove(attachment)}
          >
            <XIcon className="size-3.5" />
          </Button>
        )}
      </div>
      <div className="flex min-w-0 items-baseline justify-between gap-2 text-xs">
        <span className="truncate">{attachment.name}</span>
        <span className="shrink-0 text-muted-foreground">{formatBytes(attachment.size)}</span>
      </div>
    </div>
  )
}

/** "Anexar arquivo" button backed by a hidden file input. Images and PDFs only. */
export function AttachmentPicker({
  onFiles,
  disabled,
  pending,
}: {
  onFiles: (files: File[]) => void
  disabled?: boolean
  pending?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ""
          if (files.length) onFiles(files)
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || pending}
        onClick={() => input.current?.click()}
      >
        {pending ? <Loader2Icon className="animate-spin" /> : <PaperclipIcon />}
        {pending ? "Enviando…" : "Anexar arquivo"}
      </Button>
    </>
  )
}

/** Files picked in a form but not uploaded yet (they upload on save). */
export function PendingFileList({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  return (
    <ul className="flex flex-col divide-y rounded-md border text-sm">
      {files.map((file, i) => (
        <li key={`${file.name}-${i}`} className="flex items-center gap-2 px-3 py-2">
          <FileIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{file.name}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={`Remover ${file.name}`}
            onClick={() => onRemove(i)}
          >
            <XIcon className="size-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  )
}
