import { ArrowLeftIcon, PlusIcon } from 'lucide-react'
import { navigate } from '@/lib/navigate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatMoney } from '@/lib/format'
import { BILL_STATUS_LABELS, cardLabel, PURCHASE_CATEGORIES, type CardPurchase, type PurchaseCategory } from './types'
import { CYCLES } from '../subscriptions/types'
import type { MonthRow } from './useBills'

interface CardExpensesProps {
  /** The card's statement in the selected month */
  row: MonthRow
  onBack: () => void
  onAdd: () => void
  onEdit: (purchase: CardPurchase) => void
}

export function CardExpenses({ row, onBack, onAdd, onEdit }: CardExpensesProps) {
  const subscriptionsTotal = row.charges.reduce((sum, c) => sum + c.subscription.amount, 0)
  const total = row.purchases.reduce((sum, p) => sum + p.amount, subscriptionsTotal)
  const byCategory = new Map<PurchaseCategory, number>()
  for (const { purchase, amount } of row.purchases) {
    const category = purchase.category ?? 'other'
    byCategory.set(category, (byCategory.get(category) ?? 0) + amount)
  }
  const categories: [string, number][] = [...byCategory].map(([category, amount]) => [PURCHASE_CATEGORIES[category], amount])
  if (subscriptionsTotal) categories.push(['Assinaturas', subscriptionsTotal])
  categories.sort((a, b) => b[1] - a[1])
  const empty = row.purchases.length === 0 && row.charges.length === 0

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeftIcon />
          Cartões
        </Button>
        <p className="text-sm text-muted-foreground">
          {cardLabel(row.bill) || row.bill.name} · Fatura{row.estimated && row.amount ? ' (estimada)' : ''}{' '}
          <span className="font-medium text-foreground tabular-nums">{row.amount ? formatMoney(row.amount) : '—'}</span> ·{' '}
          {BILL_STATUS_LABELS[row.status]}
        </p>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map(([category, amount]) => (
            <Badge key={category} variant="outline" className="gap-1.5">
              {category}
              <span className="text-muted-foreground tabular-nums">{formatMoney(amount)}</span>
            </Badge>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="pl-4">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="hidden sm:table-cell">Categoria</TableHead>
              <TableHead className="hidden sm:table-cell">Parcela</TableHead>
              <TableHead className="pr-4 text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empty ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    Nenhum gasto nesta fatura.
                    <Button variant="outline" size="sm" onClick={onAdd}>
                      <PlusIcon />
                      Nova compra
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {row.purchases.map(({ purchase, number, amount }) => (
                  <TableRow key={purchase.id} className="cursor-pointer" onClick={() => onEdit(purchase)}>
                  <TableCell className="pl-4 tabular-nums">{formatDate(purchase.date, { day: '2-digit', month: '2-digit' })}</TableCell>
                  <TableCell className="max-w-36 sm:max-w-80">
                    <div className="flex flex-col">
                      <span className="truncate font-medium">{purchase.description}</span>
                      <span className="truncate text-xs text-muted-foreground sm:hidden">
                        {PURCHASE_CATEGORIES[purchase.category ?? 'other']}
                        {purchase.installments > 1 && ` · ${number}/${purchase.installments}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{PURCHASE_CATEGORIES[purchase.category ?? 'other']}</TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">
                    {purchase.installments > 1 ? `${number}/${purchase.installments}` : 'À vista'}
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{formatMoney(amount)}</TableCell>
                </TableRow>
                ))}
                {row.charges.map(({ subscription, date }) => (
                  <TableRow key={`${subscription.id}-${date}`} className="cursor-pointer" onClick={() => navigate('#/bills/subscriptions')}>
                    <TableCell className="pl-4 tabular-nums">{formatDate(date, { day: '2-digit', month: '2-digit' })}</TableCell>
                    <TableCell className="max-w-36 sm:max-w-80">
                      <div className="flex flex-col">
                        <span className="truncate font-medium">{subscription.name}</span>
                        <span className="truncate text-xs text-muted-foreground sm:hidden">Assinatura · {CYCLES[subscription.cycle].label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">Assinatura</TableCell>
                    <TableCell className="hidden sm:table-cell">{CYCLES[subscription.cycle].label}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{formatMoney(subscription.amount)}</TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
          {!empty && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="pl-4 sm:hidden">
                  Total
                </TableCell>
                <TableCell colSpan={4} className="hidden pl-4 sm:table-cell">
                  Total
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums">{formatMoney(total)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}
