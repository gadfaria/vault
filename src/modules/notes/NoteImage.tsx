import { useEffect, useState } from 'react'
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { ImageOffIcon, Loader2Icon } from 'lucide-react'
import { getOffline, setOffline } from '@/lib/offline-store'
import { safeObjectUrl } from '@/lib/safe-files'
import { useVaultContext } from '@/storage/context'

/** Images pasted into notes are attachments on Drive, written in Markdown as ![name](attachment:<fileId>). */
export const ATTACHMENT_PREFIX = 'attachment:'

const imageKey = (fileId: string) => `notes:image:${fileId}`

/** Object URLs for the session; the blobs themselves are also kept on the device for offline reading. */
const urls = new Map<string, Promise<string>>()

function imageUrl(fileId: string, download: (id: string) => Promise<Blob>): Promise<string> {
  let url = urls.get(fileId)
  if (!url) {
    url = (async () => {
      let blob = await getOffline<Blob>(imageKey(fileId))
      if (!blob) {
        blob = await download(fileId)
        void setOffline(imageKey(fileId), blob)
      }
      return safeObjectUrl(blob)
    })()
    url.catch(() => urls.delete(fileId))
    urls.set(fileId, url)
  }
  return url
}

function useNoteImage(src: string): { url: string | null; failed: boolean } {
  const { vault } = useVaultContext()
  const fileId = src.startsWith(ATTACHMENT_PREFIX) ? src.slice(ATTACHMENT_PREFIX.length) : null
  const [state, setState] = useState<{ fileId: string; url: string | null; failed: boolean } | null>(null)

  useEffect(() => {
    if (!fileId) return
    let cancelled = false
    imageUrl(fileId, (id) => vault.downloadAttachment(id)).then(
      (url) => !cancelled && setState({ fileId, url, failed: false }),
      // Offline and never opened before, or removed from Drive: a placeholder, not a toast per image.
      () => !cancelled && setState({ fileId, url: null, failed: true }),
    )
    return () => {
      cancelled = true
    }
  }, [vault, fileId])

  if (!fileId) return { url: src, failed: false }
  return state?.fileId === fileId ? state : { url: null, failed: false }
}

export function NoteImage({ node, selected }: ReactNodeViewProps) {
  const src = String(node.attrs.src ?? '')
  const alt = String(node.attrs.alt ?? '')
  const { url, failed } = useNoteImage(src)

  return (
    <NodeViewWrapper className="my-3" data-drag-handle>
      {url ? (
        <img src={url} alt={alt} className={`max-h-[70svh] max-w-full rounded-md ${selected ? 'ring-2 ring-ring' : ''}`} />
      ) : (
        <div className="flex h-24 max-w-sm items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground">
          {failed ? <ImageOffIcon className="size-4" /> : <Loader2Icon className="size-4 animate-spin" />}
          {failed ? (navigator.onLine ? 'Não foi possível carregar a imagem' : 'Imagem indisponível offline') : 'Carregando imagem…'}
        </div>
      )}
    </NodeViewWrapper>
  )
}
