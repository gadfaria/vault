import { useState } from 'react'
import { navigate } from '@/lib/navigate'
import { EllipsisVerticalIcon, PaperclipIcon, PlusIcon } from 'lucide-react'
import { useAuth } from '@/auth/context'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate } from '@/lib/format'
import { DocumentDetailDialog } from './DocumentDetailDialog'
import { DocumentFormDialog } from './DocumentFormDialog'
import { ProfileCard } from './ProfileCard'
import { ProfileDialog } from './ProfileDialog'
import { ExpiryBadge } from '@/components/expiry-badge'
import { DOCUMENT_TYPES, EXPIRING_SOON_DAYS, documentLabel, type PersonalDocument } from './types'
import type { ModuleScreenProps } from '..'
import { useDocuments, type DocumentRow } from './useDocuments'

const ALL = '__all__'

export function DocumentsScreen({ path }: ModuleScreenProps) {
  const docs = useDocuments()
  const { session } = useAuth()
  const me = session?.name.split(' ')[0] ?? ''
  // You always have a tab (for your personal data), even before adding any document.
  const people = !me || docs.owners.includes(me) ? docs.owners : [me, ...docs.owners].sort()
  const [chosenOwner, setOwner] = useState(me || ALL)
  const owner = chosenOwner === ALL || people.includes(chosenOwner) ? chosenOwner : ALL
  const [profileOpen, setProfileOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PersonalDocument | null>(null)
  const [deleting, setDeleting] = useState<PersonalDocument | null>(null)
  // A document can be opened by URL (#/documents/<id>, e.g. from the global search) or by clicking it.
  const [clickedId, setClickedId] = useState<string | null>(null)
  const routeId = path[0] ?? null
  const selectedId = clickedId ?? routeId
  const setSelectedId = (id: string | null) => {
    setClickedId(id)
    if (id === null && routeId) navigate('#/documents')
  }

  const visible = owner === ALL ? docs.rows : docs.rows.filter((r) => r.document.owner.trim() === owner)
  const selected = docs.rows.find((r) => r.document.id === selectedId)?.document ?? null
  const defaultOwner = me

  return (
    <>
      <SiteHeader title="Documentos">
        <Button size="sm" onClick={() => setCreating(true)} disabled={docs.loading}>
          <PlusIcon />
          <span className="hidden sm:inline">Novo documento</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </SiteHeader>

      <PageBody>
        <div className="px-4 lg:px-6">
          <Tabs value={owner} onValueChange={setOwner}>
            <TabsList>
              {people.length > 1 && <TabsTrigger value={ALL}>Todos</TabsTrigger>}
              {people.map((o) => (
                <TabsTrigger key={o} value={o}>
                  {o}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {owner !== ALL && (
          <div className="px-4 lg:px-6">
            <ProfileCard
              loading={docs.loading}
              person={owner}
              profile={docs.profileFor(owner)}
              onEdit={() => setProfileOpen(true)}
            />
          </div>
        )}

        <SummaryCards loading={docs.loading} rows={visible} owners={owner === ALL ? docs.owners : [owner]} />

        <div className="flex flex-col gap-4 px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium">Documentos</h2>
            {!docs.loading && (
              <Badge variant="secondary" className="tabular-nums">
                {visible.length}
              </Badge>
            )}
          </div>

          <DocumentsTable
            loading={docs.loading}
            rows={visible}
            onOpen={(d) => setSelectedId(d.id)}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
        </div>
      </PageBody>

      {owner !== ALL && (
        <ProfileDialog
          open={profileOpen}
          onOpenChange={setProfileOpen}
          person={owner}
          profile={docs.profileFor(owner)}
          onSubmit={(input) => docs.saveProfile(owner, input, docs.profileFor(owner))}
        />
      )}
      <DocumentFormDialog
        open={creating}
        onOpenChange={setCreating}
        owners={people}
        defaultOwner={owner === ALL ? defaultOwner : owner}
        onSubmit={docs.createDocument}
      />
      <DocumentFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        document={editing ?? undefined}
        owners={people}
        defaultOwner={defaultOwner}
        onSubmit={(input) => (editing ? docs.updateDocument(editing, input) : Promise.resolve(false))}
      />
      <DocumentDetailDialog
        document={editing || deleting ? null : selected}
        onClose={() => setSelectedId(null)}
        onEdit={setEditing}
        onDelete={setDeleting}
        onAddFiles={docs.addAttachments}
        onRemoveFile={docs.removeAttachment}
      />
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && documentLabel(deleting)}
              {deleting?.owner && ` de ${deleting.owner}`} será removido
              {deleting?.attachments.length ? ' e os arquivos dele vão para a lixeira do Drive' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (deleting && (await docs.deleteDocument(deleting)) && selectedId === deleting.id) setSelectedId(null)
                setDeleting(null)
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

function SummaryCards({ loading, rows, owners }: { loading: boolean; rows: DocumentRow[]; owners: string[] }) {
  const expired = rows.filter((r) => r.status.kind === 'expired')
  const soon = rows
    .filter((r) => r.status.kind === 'soon')
    .sort((a, b) => a.document.expiryDate.localeCompare(b.document.expiryDate))
  const withFiles = rows.filter((r) => r.document.attachments.length > 0).length
  const names = (list: DocumentRow[]) =>
    list
      .slice(0, 3)
      .map((r) => documentLabel(r.document))
      .join(', ')

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <StatCard
        loading={loading}
        label="Documentos"
        value={String(rows.length)}
        badge={owners.length > 0 ? `${owners.length} ${owners.length === 1 ? 'pessoa' : 'pessoas'}` : undefined}
        headline={rows.length ? 'Guardados no seu Drive' : 'Comece adicionando um documento'}
        detail={owners.join(', ')}
      />
      <StatCard
        loading={loading}
        label="Vencidos"
        value={String(expired.length)}
        headline={expired.length ? names(expired) : 'Nenhum documento vencido'}
        detail={expired.length ? 'Hora de renovar' : 'Tudo em dia'}
      />
      <StatCard
        loading={loading}
        label={`Vencem em ${EXPIRING_SOON_DAYS} dias`}
        value={String(soon.length)}
        headline={soon[0] ? `${documentLabel(soon[0].document)} em ${formatDate(soon[0].document.expiryDate)}` : 'Nada vencendo em breve'}
        detail={soon.length > 1 ? `E mais ${soon.length - 1}` : 'Próximos três meses'}
      />
      <StatCard
        loading={loading}
        label="Com arquivo"
        value={rows.length ? `${withFiles}/${rows.length}` : '0'}
        headline={withFiles < rows.length ? `${rows.length - withFiles} sem foto ou PDF` : 'Todos com arquivo'}
        detail="Frente e verso, PDF"
      />
    </div>
  )
}

function StatCard({
  loading,
  label,
  value,
  badge,
  headline,
  detail,
}: {
  loading: boolean
  label: string
  value: string
  badge?: string
  headline: string
  detail: string
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="col-span-full text-2xl font-semibold tabular-nums @[340px]/card:text-3xl">
          {loading ? <Skeleton className="h-9 w-16" /> : value}
        </CardTitle>
        {!loading && badge && (
          <CardAction className="row-span-1">
            <Badge variant="outline">{badge}</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        {loading ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          <>
            <div className="line-clamp-1 font-medium">{headline}</div>
            <div className="line-clamp-1 text-muted-foreground">{detail || ' '}</div>
          </>
        )}
      </CardFooter>
    </Card>
  )
}

function DocumentsTable({
  loading,
  rows,
  onOpen,
  onEdit,
  onDelete,
}: {
  loading: boolean
  rows: DocumentRow[]
  onOpen: (document: PersonalDocument) => void
  onEdit: (document: PersonalDocument) => void
  onDelete: (document: PersonalDocument) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead className="pl-4">Documento</TableHead>
            <TableHead className="hidden md:table-cell">Número</TableHead>
            <TableHead className="hidden lg:table-cell">De quem</TableHead>
            <TableHead>Validade</TableHead>
            <TableHead className="hidden w-12 sm:table-cell" />
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            [0, 1, 2].map((i) => (
              <TableRow key={i}>
                <TableCell colSpan={6} className="px-4">
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                Nenhum documento ainda. Adicione RG, CNH, passaporte…
              </TableCell>
            </TableRow>
          ) : (
            rows.map(({ document, status }) => (
              <TableRow key={document.id} className="cursor-pointer" onClick={() => onOpen(document)}>
                <TableCell className="pl-4">
                  <div className="flex flex-col">
                    <span className="font-medium">{documentLabel(document)}</span>
                    <span className="text-xs text-muted-foreground">
                      {document.title.trim() ? DOCUMENT_TYPES[document.type] : document.issuer || ' '}
                      <span className="lg:hidden">{document.owner && ` · ${document.owner}`}</span>
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden font-mono text-muted-foreground md:table-cell">
                  {document.number || '—'}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">{document.owner || '—'}</TableCell>
                <TableCell>
                  <ExpiryBadge status={status} expiryDate={document.expiryDate} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {document.attachments.length > 0 && (
                    <span className="flex items-center gap-1 text-xs tabular-nums">
                      <PaperclipIcon className="size-3.5" />
                      {document.attachments.length}
                    </span>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                        <EllipsisVerticalIcon />
                        <span className="sr-only">Ações</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onSelect={() => onOpen(document)}>Abrir</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onEdit(document)}>Editar</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => onDelete(document)}>
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
