import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Attachment } from '@/domain/types'
import { isInertType, safeObjectUrl } from '@/lib/safe-files'
import { useVaultContext } from './context'

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024

/** Object URLs of downloaded attachments, shared across components for the whole session. */
const urlCache = new Map<string, Promise<string>>()

const NO_EXTRA_TYPES: string[] = []

/**
 * Upload and trash helpers for files owned by `module`. Only images and PDFs are accepted,
 * plus `extraTypes` (a stable array) for modules that never open the file as a page.
 */
export function useAttachments(module: string, maxBytes = DEFAULT_MAX_BYTES, extraTypes = NO_EXTRA_TYPES) {
  const { vault, reportError } = useVaultContext()

  const upload = useCallback(
    async (files: File[]): Promise<Attachment[] | null> => {
      const tooBig = files.find((f) => f.size > maxBytes)
      if (tooBig) {
        toast.error(`${tooBig.name} passa de ${Math.round(maxBytes / 1024 / 1024)} MB.`)
        return null
      }
      const refused = files.find((f) => !isInertType(f.type) && !extraTypes.includes(f.type))
      if (refused) {
        toast.error(`${refused.name} não é um tipo de arquivo aceito.`, { description: 'Use PNG, JPEG, WebP, GIF, HEIC ou PDF.' })
        return null
      }
      try {
        const uploaded: Attachment[] = []
        for (const file of files) uploaded.push(await vault.uploadAttachment(file, module))
        return uploaded
      } catch (err) {
        reportError(err)
        return null
      }
    },
    [vault, module, maxBytes, extraTypes, reportError],
  )

  /** Best effort: a file left behind in attachments/ is harmless, so failures are only reported. */
  const trash = useCallback(
    async (attachments: Attachment[]) => {
      for (const attachment of attachments) {
        try {
          await vault.trashAttachment(attachment.id)
          urlCache.delete(attachment.id)
        } catch (err) {
          reportError(err)
        }
      }
    },
    [vault, reportError],
  )

  return { upload, trash }
}

/** Downloads an attachment once and returns an object URL for it (null while loading). */
export function useAttachmentUrl(fileId: string): string | null {
  const { vault, reportError } = useVaultContext()
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let pending = urlCache.get(fileId)
    if (!pending) {
      pending = vault.downloadAttachment(fileId).then(safeObjectUrl)
      pending.catch(() => urlCache.delete(fileId))
      urlCache.set(fileId, pending)
    }
    pending.then(
      (value) => !cancelled && setUrl(value),
      (err) => !cancelled && reportError(err),
    )
    return () => {
      cancelled = true
    }
  }, [vault, fileId, reportError])

  return url
}
