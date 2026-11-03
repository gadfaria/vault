import { useState } from 'react'
import { ExternalLinkIcon, PencilIcon, PlusIcon, VideoIcon } from 'lucide-react'
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
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CameraFormDialog } from './CameraFormDialog'
import { playerUrl, type Camera } from './types'
import { useCameras } from './useCameras'

export function CamerasScreen() {
  const cameras = useCameras()
  // undefined: closed; null: new camera
  const [editing, setEditing] = useState<Camera | null | undefined>(undefined)
  const [confirm, setConfirm] = useState<Camera | null>(null)

  return (
    <>
      <SiteHeader title="Câmeras" />
      <PageBody>
        <div className="flex items-center justify-between px-4 lg:px-6">
          <h2 className="text-sm font-medium">Ao vivo</h2>
          <Button variant="outline" size="sm" onClick={() => setEditing(null)} disabled={cameras.loading}>
            <PlusIcon />
            Nova câmera
          </Button>
        </div>

        <div className="px-4 lg:px-6">
          {cameras.loading ? (
            <Skeleton className="aspect-video w-full" />
          ) : cameras.cameras.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
              <VideoIcon className="size-6 text-muted-foreground" />
              <p className="text-sm">Nenhuma câmera ainda</p>
              <p className="text-sm text-muted-foreground">Cadastre a ponte go2rtc de casa para ver a câmera aqui.</p>
            </div>
          ) : (
            <div className={`grid grid-cols-1 gap-4 ${cameras.cameras.length > 1 ? '@5xl/main:grid-cols-2' : ''}`}>
              {cameras.cameras.map((camera) => (
                <CameraCard key={camera.id} camera={camera} onEdit={() => setEditing(camera)} />
              ))}
            </div>
          )}
        </div>
      </PageBody>

      <CameraFormDialog
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        camera={editing ?? undefined}
        onSubmit={(input) => (editing ? cameras.updateCamera(editing, input) : cameras.createCamera(input))}
        onDelete={setConfirm}
      />
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir câmera?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.name} sai do Vault. A ponte em casa continua como está.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (confirm && (await cameras.deleteCamera(confirm))) setEditing(undefined)
                setConfirm(null)
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function CameraCard({ camera, onEdit }: { camera: Camera; onEdit: () => void }) {
  const url = playerUrl(camera)

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle>{camera.name}</CardTitle>
        <CardAction className="flex gap-1">
          <Button variant="ghost" size="icon" className="size-8" asChild>
            <a href={url} target="_blank" rel="noreferrer" title="Abrir em nova aba">
              <ExternalLinkIcon />
            </a>
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={onEdit} title="Editar">
            <PencilIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-4">
        <iframe
          src={url}
          title={camera.name}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full rounded-md border bg-black"
        />
        {/* The bridge's login page can't show inside the frame, so the first visit happens in a tab. */}
        <p className="text-xs text-muted-foreground">
          Sem imagem? Abra em nova aba uma vez para entrar, depois volte aqui.
        </p>
      </CardContent>
    </Card>
  )
}
