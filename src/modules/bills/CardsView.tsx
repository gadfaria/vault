import { CheckIcon, CreditCardIcon, EllipsisVerticalIcon, PlusIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatMoney, formatMonth, today } from '@/lib/format'
import type { SubscriptionRow } from '../subscriptions/useSubscriptions'
import { BILL_STATUS_LABELS, cardLabel, firstStatementMonth, PAYMENT_METHODS } from './types'
import type { MonthRow } from './useBills'

interface CardsViewProps {
  loading: boolean
  /** The month's statement of every card due in it */
  rows: MonthRow[]
  /** Active subscriptions, matched to cards by `cardId` */
  subscriptions: SubscriptionRow[]
  /** The statement before each one shown, when still to pay */
  unpaid: MonthRow[]
  onAdd: () => void
  onPay: (row: MonthRow) => void
  onEnter: (row: MonthRow) => void
  onUndo: (row: MonthRow) => void
  onHistory: (row: MonthRow) => void
  onEdit: (row: MonthRow) => void
  onAddPurchase: (row: MonthRow) => void
  /** Opens the card's expenses */
  onSelect: (row: MonthRow) => void
}

export function CardsView({ loading, rows, subscriptions, unpaid, onAdd, ...actions }: CardsViewProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @3xl/main:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CreditCardIcon className="size-6 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Nenhum cartão neste mês</p>
              <p className="text-sm text-muted-foreground">
                Cadastre seus cartões para acompanhar a fatura de cada mês e as assinaturas cobradas em cada um.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onAdd}>
              <PlusIcon />
              Novo cartão
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const total = rows.reduce((sum, row) => sum + row.amount, 0)

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <p className="text-sm text-muted-foreground">
        Total das faturas: <span className="font-medium text-foreground tabular-nums">{formatMoney(total)}</span>
      </p>
      <div className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-2">
        {rows.map((row) => (
          <CardTile
            key={row.bill.id}
            row={row}
            subscriptions={subscriptions.filter((s) => s.subscription.cardId === row.bill.id)}
            unpaid={unpaid.find((u) => u.bill.id === row.bill.id)}
            {...actions}
          />
        ))}
      </div>
    </div>
  )
}

function CardTile({
  row,
  subscriptions,
  unpaid,
  onPay,
  onEnter,
  onUndo,
  onHistory,
  onEdit,
  onAddPurchase,
  onSelect,
}: Omit<CardsViewProps, 'loading' | 'rows' | 'subscriptions' | 'unpaid' | 'onAdd'> & { row: MonthRow; subscriptions: SubscriptionRow[]; unpaid?: MonthRow }) {
  const { bill, status } = row
  const details = bill.card
  const open = firstStatementMonth(bill, today()) === row.month
  const monthly = subscriptions.reduce((sum, s) => sum + s.monthly, 0)
  const purchasesTotal = row.purchases.reduce((sum, p) => sum + p.amount, 0)
  const schedule = [details?.closingDay ? `fecha dia ${details.closingDay}` : '', `vence ${formatDate(row.dueDate, { day: '2-digit', month: '2-digit' })}`]
    .filter(Boolean)
    .join(' · ')

  return (
    <Card className="@container/card cursor-pointer transition-colors hover:bg-muted/50" onClick={() => onSelect(row)}>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <CreditCardIcon className="size-4" />
          {cardLabel(bill) || 'Cartão de crédito'}
        </CardDescription>
        <CardTitle className="text-lg">{bill.name}</CardTitle>
        <CardAction className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {status === 'paid' ? (
            <Badge variant="outline" className="text-muted-foreground">
              <CheckIcon />
              {BILL_STATUS_LABELS.paid}
            </Badge>
          ) : (
            <Badge variant={status === 'overdue' ? 'destructive' : 'secondary'}>{BILL_STATUS_LABELS[status]}</Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                <EllipsisVerticalIcon />
                <span className="sr-only">Ações</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => onSelect(row)}>Ver gastos</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAddPurchase(row)}>Adicionar compra</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onEnter(row)}>{row.estimated ? 'Lançar fatura' : 'Editar fatura'}</DropdownMenuItem>
              {status === 'paid' && <DropdownMenuItem onSelect={() => onUndo(row)}>Desfazer pagamento</DropdownMenuItem>}
              <DropdownMenuItem onSelect={() => onHistory(row)}>Ver histórico</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onEdit(row)}>Editar cartão</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {unpaid && (
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">
                Fatura de {formatMonth(unpaid.month, true)} · <span className="tabular-nums">{formatMoney(unpaid.amount)}</span>
              </span>
              <span className={`text-xs ${unpaid.status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}`}>
                {unpaid.status === 'overdue' ? 'Venceu' : 'Fechada · vence'} {formatDate(unpaid.dueDate, { day: '2-digit', month: '2-digit' })}
                {unpaid.estimated ? ' · estimada' : ''}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => onPay(unpaid)}>
              <CheckIcon />
              Pagar
            </Button>
          </div>
        )}
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">
              {open ? 'Fatura aberta' : 'Fatura'}
              {row.estimated && row.amount ? ' (estimada)' : ''}
            </span>
            <span className={`text-2xl font-semibold tabular-nums ${row.estimated ? 'text-muted-foreground' : ''}`}>
              {row.amount ? formatMoney(row.amount) : '—'}
            </span>
            <span className="text-xs text-muted-foreground">
              {schedule} · {PAYMENT_METHODS[bill.paymentMethod]}
            </span>
          </div>
          {status !== 'paid' && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onPay(row)
              }}
            >
              <CheckIcon />
              Pagar
            </Button>
          )}
        </div>

        {details?.limit ? (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Limite</span>
            <span className="tabular-nums">{formatMoney(details.limit)}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            {row.purchases.length === 1 ? '1 compra nesta fatura' : `${row.purchases.length} compras nesta fatura`}
          </span>
          <span className="flex items-center gap-1">
            <span className="tabular-nums">{row.purchases.length ? formatMoney(purchasesTotal) : '—'}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onAddPurchase(row)
              }}
            >
              <PlusIcon />
              <span className="sr-only">Adicionar compra</span>
            </Button>
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2 border-t text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Assinaturas neste cartão</span>
          <span className="tabular-nums">{subscriptions.length ? `${formatMoney(Math.round(monthly))}/mês` : '—'}</span>
        </div>
        {subscriptions.length > 0 && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {subscriptions.map((s) => s.subscription.name).join(', ')}
          </p>
        )}
      </CardFooter>
    </Card>
  )
}
