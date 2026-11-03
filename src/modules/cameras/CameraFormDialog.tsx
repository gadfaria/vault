import { useState, type FormEvent } from 'react'
import { Field } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Camera } from './types'
import type { CameraInput } from './useCameras'

interface CameraFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, edits this camera. */
  camera?: Camera
  onSubmit: (input: CameraInput) => Promise<boolean>
  onDelete: (camera: Camera) => void
}

export function CameraFormDialog(props: CameraFormDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Keyed so the form resets every time the dialog opens. */}
        {props.open && <CameraForm key={props.camera?.id ?? 'new'} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function CameraForm({ camera, onSubmit, onDelete, onOpenChange }: CameraFormDialogProps) {
  const [values, setValues] = useState<CameraInput>({
    name: camera?.name ?? '',
    bridgeUrl: camera?.bridgeUrl ?? '',
    stream: camera?.stream ?? '',
    ptz: camera?.ptz ?? false,
  })
  const [pending, setPending] = useState(false)

  const set = (key: 'name' | 'bridgeUrl' | 'stream') => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))
  // The Vault is served over HTTPS, so a plain-http bridge would be blocked as mixed content (localhost aside).
  const validUrl = /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$))\S*$/.test(values.bridgeUrl.trim())
  const valid = values.name.trim() !== '' && validUrl && values.stream.trim() !== ''

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    setPending(true)
    const ok = await onSubmit({
      name: values.name.trim(),
      bridgeUrl: values.bridgeUrl.trim().replace(/\/+$/, ''),
      stream: values.stream.trim(),
      ptz: values.ptz,
    })
    setPending(false)
    if (ok) onOpenChange(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{camera ? 'Editar câmera' : 'Nova câmera'}</DialogTitle>
        <DialogDescription>
          O vídeo vem da ponte go2rtc que roda em casa. A senha da câmera fica só na ponte.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <Field label="Nome" id="name">
          <Input id="name" value={values.name} onChange={set('name')} placeholder="Ex.: Sala" autoFocus />
        </Field>
        <Field label="Endereço da ponte" id="bridgeUrl">
          <Input
            id="bridgeUrl"
            value={values.bridgeUrl}
            onChange={set('bridgeUrl')}
            placeholder="https://cam.exemplo.com"
            inputMode="url"
          />
        </Field>
        <Field label="Stream" id="stream">
          <Input id="stream" value={values.stream} onChange={set('stream')} placeholder="Ex.: sala" />
        </Field>
        <div className="flex items-center gap-3">
          <Checkbox
            id="ptz"
            checked={values.ptz}
            onCheckedChange={(v) => setValues((s) => ({ ...s, ptz: v === true }))}
          />
          <Label htmlFor="ptz">Tem controle de movimento (setas no vídeo)</Label>
        </div>
      </div>

      <DialogFooter className="sm:justify-between">
        {camera ? (
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => onDelete(camera)}>
            Excluir
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending || !valid}>
          {pending ? 'Salvando…' : camera ? 'Salvar' : 'Adicionar'}
        </Button>
      </DialogFooter>
    </form>
  )
}
