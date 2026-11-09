import { useState } from 'react'
import { navigate } from '@/lib/navigate'
import { EllipsisVerticalIcon, GaugeIcon, PaperclipIcon, PlusIcon } from 'lucide-react'
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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatKm, formatMoney, today } from '@/lib/format'
import { InsuranceCard } from './InsuranceCard'
import { OdometerDialog } from './OdometerDialog'
import { PolicyFormDialog } from './PolicyFormDialog'
import { ServiceFormDialog } from './ServiceFormDialog'
import {
  SERVICE_TYPES,
  VEHICLE_TYPES,
  serviceTotal,
  vehicleLabel,
  type InsurancePolicy,
  type Service,
  type Vehicle,
} from './types'
import type { useVehicles, VehicleSummary } from './useVehicles'
import { VehicleFormDialog } from './VehicleFormDialog'

type Confirm =
  | { kind: 'vehicle'; vehicle: Vehicle }
  | { kind: 'service'; service: Service }
  | { kind: 'policy'; policy: InsurancePolicy }

interface VehicleDetailProps {
  /** Undefined while the collection is still loading. */
  summary: VehicleSummary | undefined
  vehicles: ReturnType<typeof useVehicles>
}

export function VehicleDetail({ summary, vehicles }: VehicleDetailProps) {
  const [editing, setEditing] = useState(false)
  const [odometer, setOdometer] = useState(false)
  const [serviceDialog, setServiceDialog] = useState<{ service?: Service } | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [policyDialog, setPolicyDialog] = useState<{ policy?: InsurancePolicy; renewing?: InsurancePolicy } | null>(null)

  const workshops = [
    ...new Set(vehicles.summaries.flatMap((s) => s.services.map((x) => x.workshop)).filter(Boolean)),
  ].sort()

  if (!summary) {
    return (
      <>
        <SiteHeader title={[{ label: 'Veículos', href: '#/vehicles' }, { label: '…' }]} />
        <PageBody>
          <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </PageBody>
      </>
    )
  }

  const { vehicle, services, currentKm, lastService, totalCost, yearCost } = summary
  const year = today().slice(0, 4)

  return (
    <>
      <SiteHeader title={[{ label: 'Veículos', href: '#/vehicles' }, { label: vehicleLabel(vehicle) }]}>
        <Button variant="outline" size="sm" onClick={() => setOdometer(true)} className="hidden sm:inline-flex">
          <GaugeIcon />
          Atualizar km
        </Button>
        <Button size="sm" onClick={() => setServiceDialog({})}>
          <PlusIcon />
          <span className="hidden sm:inline">Nova manutenção</span>
          <span className="sm:hidden">Manutenção</span>
        </Button>
      </SiteHeader>

      <PageBody>
        <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
          <StatCard
            label="Km atual"
            value={currentKm ? formatKm(currentKm.km) : '—'}
            headline={currentKm ? `Registrado em ${formatDate(currentKm.date)}` : 'Nenhum km registrado'}
            action={
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setOdometer(true)}>
                Atualizar km
              </Button>
            }
          />
          <StatCard
            label="Gasto total"
            value={formatMoney(totalCost)}
            badge={`${services.length} ${services.length === 1 ? 'registro' : 'registros'}`}
            headline="Somando mão de obra e peças"
            detail={services.length > 0 ? `Desde ${formatDate(services.at(-1)!.date)}` : 'Nenhuma manutenção ainda'}
          />
          <StatCard
            label={`Gasto em ${year}`}
            value={formatMoney(yearCost)}
            headline={totalCost > 0 ? `${Math.round((yearCost / totalCost) * 100)}% do total` : 'Sem gastos registrados'}
            detail="De janeiro até hoje"
          />
          <StatCard
            label="Última manutenção"
            value={lastService ? formatDate(lastService.date) : '—'}
            badge={lastService ? SERVICE_TYPES[lastService.type] : undefined}
            headline={lastService ? lastService.title : 'Registre a primeira'}
            detail={lastService?.km != null ? `Aos ${formatKm(lastService.km)}` : ''}
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-4 px-4 lg:px-6 @4xl/main:grid-cols-2">
          <VehicleInfo
            vehicle={vehicle}
            onEdit={() => setEditing(true)}
            onDelete={() => setConfirm({ kind: 'vehicle', vehicle })}
          />
          <InsuranceCard
            currentPolicy={summary.currentPolicy}
            nextPolicy={summary.nextPolicy}
            pastPolicies={summary.pastPolicies}
            onAdd={() => setPolicyDialog({})}
            onRenew={(renewing) => setPolicyDialog({ renewing })}
            onEdit={(policy) => setPolicyDialog({ policy })}
            onDelete={(policy) => setConfirm({ kind: 'policy', policy })}
          />
        </div>

        <div className="flex flex-col gap-4 px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium">Histórico de manutenção</h2>
            <Badge variant="secondary" className="tabular-nums">
              {services.length}
            </Badge>
          </div>
          <ServicesTable
            services={services}
            onOpen={(service) => setServiceDialog({ service })}
            onDelete={(service) => setConfirm({ kind: 'service', service })}
          />
        </div>
      </PageBody>

      <VehicleFormDialog
        open={editing}
        onOpenChange={setEditing}
        vehicle={vehicle}
        onSubmit={(input) => vehicles.updateVehicle(vehicle, input)}
      />
      <OdometerDialog
        open={odometer}
        onOpenChange={setOdometer}
        currentKm={currentKm?.km}
        onSubmit={(km, date) => vehicles.addReading(vehicle.id, km, date)}
      />
      <ServiceFormDialog
        open={serviceDialog !== null && confirm === null}
        onOpenChange={(open) => !open && setServiceDialog(null)}
        service={serviceDialog?.service}
        suggestedKm={currentKm?.km}
        workshops={workshops}
        onSubmit={(input, newFiles, removed) =>
          vehicles.saveService(vehicle.id, input, newFiles, removed, serviceDialog?.service)
        }
        onDelete={(service) => setConfirm({ kind: 'service', service })}
      />
      <PolicyFormDialog
        open={policyDialog !== null && confirm === null}
        onOpenChange={(open) => !open && setPolicyDialog(null)}
        policy={policyDialog?.policy}
        renewing={policyDialog?.renewing}
        onSubmit={(input, newFiles, removed) =>
          vehicles.savePolicy(vehicle.id, input, newFiles, removed, policyDialog?.policy)
        }
        onDelete={(policy) => setConfirm({ kind: 'policy', policy })}
      />
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'vehicle'
                ? 'Excluir veículo?'
                : confirm?.kind === 'policy'
                  ? 'Excluir seguro?'
                  : 'Excluir manutenção?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'vehicle'
                ? `${vehicleLabel(confirm.vehicle)} e todo o histórico de manutenção, km e seguros dele serão removidos.`
                : confirm?.kind === 'service'
                  ? `${confirm.service.title} (${formatDate(confirm.service.date)}) será removida do histórico.`
                  : confirm?.kind === 'policy'
                    ? `A apólice ${confirm.policy.policyNumber || ''} da ${confirm.policy.insurer} será removida${confirm.policy.attachments.length ? ' e os arquivos vão para a lixeira do Drive' : ''}. Para trocar de seguro, prefira "Renovar".`
                    : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (confirm?.kind === 'vehicle') {
                  if (await vehicles.deleteVehicle(confirm.vehicle)) navigate('#/vehicles')
                } else if (confirm?.kind === 'service') {
                  if (await vehicles.deleteService(confirm.service)) setServiceDialog(null)
                } else if (confirm?.kind === 'policy') {
                  if (await vehicles.deletePolicy(confirm.policy)) setPolicyDialog(null)
                }
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

function StatCard({
  label,
  value,
  badge,
  headline,
  detail,
  action,
}: {
  label: string
  value: string
  badge?: string
  headline: string
  detail?: string
  action?: React.ReactNode
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="col-span-full truncate text-2xl font-semibold tabular-nums @[340px]/card:text-3xl">
          {value}
        </CardTitle>
        {badge && (
          <CardAction className="row-span-1">
            <Badge variant="outline">{badge}</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 font-medium">{headline}</div>
        {action ?? <div className="text-muted-foreground">{detail}</div>}
      </CardFooter>
    </Card>
  )
}

function VehicleInfo({ vehicle, onEdit, onDelete }: { vehicle: Vehicle; onEdit: () => void; onDelete: () => void }) {
  const fields: [string, string][] = [
    ['Marca', vehicle.brand],
    ['Modelo', vehicle.model],
    ['Tipo', VEHICLE_TYPES[vehicle.type]],
    ['Ano', vehicle.year],
    ['Placa', vehicle.plate],
    ['Cor', vehicle.color],
    ['Renavam', vehicle.renavam],
    ['Chassi', vehicle.chassis],
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados do veículo</CardTitle>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                <EllipsisVerticalIcon />
                <span className="sr-only">Ações do veículo</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={onEdit}>Editar</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                Excluir veículo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm @xl/main:grid-cols-4 @4xl/main:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className={`truncate font-medium ${label === 'Placa' || label === 'Chassi' || label === 'Renavam' ? 'font-mono' : ''}`}>
                {value || '—'}
              </dd>
            </div>
          ))}
        </dl>
        {vehicle.notes && <p className="whitespace-pre-line text-sm text-muted-foreground">{vehicle.notes}</p>}
      </CardContent>
    </Card>
  )
}

function ServicesTable({
  services,
  onOpen,
  onDelete,
}: {
  services: Service[]
  onOpen: (service: Service) => void
  onDelete: (service: Service) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead className="pl-4">Data</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="hidden md:table-cell">Tipo</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Km</TableHead>
            <TableHead className="hidden lg:table-cell">Oficina</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                Nenhuma manutenção registrada ainda.
              </TableCell>
            </TableRow>
          ) : (
            services.map((service) => (
              <TableRow key={service.id} className="cursor-pointer" onClick={() => onOpen(service)}>
                <TableCell className="pl-4 text-muted-foreground tabular-nums">{formatDate(service.date)}</TableCell>
                <TableCell className="max-w-64">
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="truncate">{service.title}</span>
                      {service.attachments.length > 0 && (
                        <PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Com nota fiscal" />
                      )}
                    </span>
                    {service.parts.length > 0 && (
                      <span className="truncate text-xs text-muted-foreground">
                        {service.parts.map((p) => (p.quantity > 1 ? `${p.quantity}× ${p.name}` : p.name)).join(', ')}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline" className="px-1.5 text-muted-foreground">
                    {SERVICE_TYPES[service.type]}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                  {service.km != null ? formatKm(service.km) : '—'}
                </TableCell>
                <TableCell className="hidden max-w-40 truncate text-muted-foreground lg:table-cell">
                  {service.workshop || '—'}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatMoney(serviceTotal(service))}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                        <EllipsisVerticalIcon />
                        <span className="sr-only">Ações</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onSelect={() => onOpen(service)}>Editar</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => onDelete(service)}>
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
