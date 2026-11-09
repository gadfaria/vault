import { useState } from 'react'
import { navigate } from '@/lib/navigate'
import { CarIcon, PlusIcon } from 'lucide-react'
import { PageBody } from '@/components/app-layout'
import { SiteHeader } from '@/components/site-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatKm, formatMoney } from '@/lib/format'
import type { ModuleScreenProps } from '..'
import { VEHICLE_TYPES, vehicleLabel } from './types'
import { useVehicles, type VehicleSummary } from './useVehicles'
import { VehicleDetail } from './VehicleDetail'
import { VehicleFormDialog } from './VehicleFormDialog'

export function VehiclesScreen({ path }: ModuleScreenProps) {
  const vehicles = useVehicles()
  const [creating, setCreating] = useState(false)
  const [vehicleId] = path

  if (vehicleId) {
    const summary = vehicles.summaries.find((s) => s.vehicle.id === vehicleId)
    if (summary || vehicles.loading) return <VehicleDetail summary={summary} vehicles={vehicles} />
  }

  return (
    <>
      <SiteHeader title="Veículos" />
      <PageBody>
        <div className="flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium">Seus veículos</h2>
            {!vehicles.loading && (
              <Badge variant="secondary" className="tabular-nums">
                {vehicles.summaries.length}
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setCreating(true)} disabled={vehicles.loading}>
            <PlusIcon />
            Novo veículo
          </Button>
        </div>

        <div className="px-4 lg:px-6">
          {vehicles.loading ? (
            <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : vehicles.summaries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
              <CarIcon className="size-6 text-muted-foreground" />
              <p className="text-sm">Nenhum veículo ainda</p>
              <p className="text-sm text-muted-foreground">
                Cadastre um veículo para registrar revisões e peças trocadas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-3 dark:*:data-[slot=card]:bg-card">
              {vehicles.summaries.map((summary) => (
                <VehicleCard key={summary.vehicle.id} summary={summary} />
              ))}
            </div>
          )}
        </div>
      </PageBody>

      <VehicleFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSubmit={async (input) => {
          const vehicle = await vehicles.createVehicle(input)
          if (vehicle) navigate(`#/vehicles/${vehicle.id}`)
          return vehicle !== null
        }}
      />
    </>
  )
}

function VehicleCard({ summary }: { summary: VehicleSummary }) {
  const { vehicle, currentKm, lastService, totalCost } = summary
  const subtitle = [VEHICLE_TYPES[vehicle.type], vehicle.year].filter(Boolean).join(' · ')
  const fullName = `${vehicle.brand} ${vehicle.model}`.trim()

  return (
    <Card className="relative transition-colors hover:border-foreground/30">
      <CardHeader>
        <CardDescription>{subtitle}</CardDescription>
        <CardTitle className="text-xl">
          <a href={`#/vehicles/${vehicle.id}`} className="after:absolute after:inset-0">
            {vehicleLabel(vehicle)}
          </a>
        </CardTitle>
        {vehicle.plate && (
          <CardAction>
            <Badge variant="outline" className="font-mono tracking-wider">
              {vehicle.plate}
            </Badge>
          </CardAction>
        )}
        {vehicle.name.trim() && fullName && <p className="text-sm text-muted-foreground">{fullName}</p>}
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <Stat label="Km atual" value={currentKm ? formatKm(currentKm.km) : '—'} />
          <Stat label="Último serviço" value={lastService ? formatDate(lastService.date) : '—'} />
          <Stat label="Gasto total" value={formatMoney(totalCost)} />
        </dl>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular-nums">{value}</dd>
    </div>
  )
}
