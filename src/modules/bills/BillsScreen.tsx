import { useState } from 'react'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisVerticalIcon, PaperclipIcon, PlusIcon } from 'lucide-react'
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
import { currentMonth, daysUntil, formatDate, formatMonth, formatMoney, shiftMonth } from '@/lib/format'
import { BillFormDialog } from './BillFormDialog'
import { BillHistoryDialog } from './BillHistoryDialog'
import { CardExpenses } from './CardExpenses'
import { CardFormDialog } from './CardFormDialog'
import { CardsView } from './CardsView'
import { MonthSummary } from './MonthSummary'
import { PaymentDialog } from './PaymentDialog'
import { PurchaseFormDialog } from './PurchaseFormDialog'
import { BILL_CATEGORIES, BILL_STATUS_LABELS, billFrequency, cardLabel, FREQUENCIES, isCard, PAYMENT_METHODS, type Bill, type BillStatus, type CardPurchase } from './types'
import { useBills, type MonthRow } from './useBills'
import { useSubscriptions } from '../subscriptions/useSubscriptions'

type Confirm = { kind: 'end' | 'delete'; bill: Bill }

function StatusBadge({ status }: { status: BillStatus }) {
  if (status === 'paid')
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <CheckIcon />
        {BILL_STATUS_LABELS.paid}
      </Badge>
    )
  if (status === 'overdue') return <Badge variant="destructive">{BILL_STATUS_LABELS.overdue}</Badge>
  return <Badge variant="secondary">{BILL_STATUS_LABELS.pending}</Badge>
}

/**
 * Contas and Cartões share this screen (month, dialogs): a card is a bill of category creditCard.
 * `nav` is the Contas | Assinaturas | Cartões switcher, shown above the page content.
 */
export function BillsScreen({ nav, view = 'bills' }: { nav?: React.ReactNode; view?: 'bills' | 'cards' | 'summary' }) {
  const bills = useBills()
  const subs = useSubscriptions()
  const [cardDialog, setCardDialog] = useState<{ card?: Bill } | null>(null)
  const [month, setMonth] = useState(currentMonth)
  const [billDialog, setBillDialog] = useState<{ bill?: Bill } | null>(null)
  const [paymentRow, setPaymentRow] = useState<{ row: MonthRow; markPaid: boolean } | null>(null)
  const [historyBill, setHistoryBill] = useState<Bill | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [purchaseDialog, setPurchaseDialog] = useState<{ card: Bill; purchase?: CardPurchase } | null>(null)
  const [deletingPurchase, setDeletingPurchase] = useState<CardPurchase | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  const rows = bills.monthRows(month, subs.all)
  // Card statements live in Cartões and Resumo, not in the bills list
  const billRows = rows.filter((row) => !isCard(row.bill))
  const selectedCard = view === 'cards' ? rows.find((row) => isCard(row.bill) && row.bill.id === selectedCardId) : undefined
  const isCurrent = month === currentMonth()
  const editBill = (bill: Bill) => (isCard(bill) ? setCardDialog({ card: bill }) : setBillDialog({ bill }))

  return (
    <>
      {selectedCard ? (
        <SiteHeader title={[{ label: 'Contas', href: '#/bills' }, { label: 'Cartões' }, { label: selectedCard.bill.name }]}>
          <Button size="sm" onClick={() => setPurchaseDialog({ card: selectedCard.bill })}>
            <PlusIcon />
            <span className="hidden sm:inline">Nova compra</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </SiteHeader>
      ) : view === 'cards' ? (
        <SiteHeader title={[{ label: 'Contas', href: '#/bills' }, { label: 'Cartões' }]}>
          <Button size="sm" onClick={() => setCardDialog({})} disabled={bills.loading}>
            <PlusIcon />
            <span className="hidden sm:inline">Novo cartão</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </SiteHeader>
      ) : view === 'summary' ? (
        <SiteHeader title={[{ label: 'Contas', href: '#/bills' }, { label: 'Resumo' }]} />
      ) : (
        <SiteHeader title="Contas">
          <Button size="sm" onClick={() => setBillDialog({})} disabled={bills.loading}>
            <PlusIcon />
            <span className="hidden sm:inline">Nova conta</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </SiteHeader>
      )}

      <PageBody>
        {nav}
        <div className="flex items-center gap-2 px-4 lg:px-6">
          <Button variant="outline" size="icon" className="size-8" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Mês anterior">
            <ChevronLeftIcon />
          </Button>
          <h2 className="min-w-40 text-center text-base font-medium first-letter:uppercase">{formatMonth(month)}</h2>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Próximo mês">
            <ChevronRightIcon />
          </Button>
          {!isCurrent && (
            <Button variant="ghost" size="sm" onClick={() => setMonth(currentMonth())}>
              Mês atual
            </Button>
          )}
        </div>

        {selectedCard ? (
          <CardExpenses
            row={selectedCard}
            onBack={() => setSelectedCardId(null)}
            onAdd={() => setPurchaseDialog({ card: selectedCard.bill })}
            onEdit={(purchase) => setPurchaseDialog({ card: selectedCard.bill, purchase })}
          />
        ) : view === 'cards' ? (
          <CardsView
            loading={bills.loading || subs.loading}
            rows={rows.filter((row) => isCard(row.bill))}
            subscriptions={subs.active}
            onAdd={() => setCardDialog({})}
            onPay={(row) => setPaymentRow({ row, markPaid: true })}
            onEnter={(row) => setPaymentRow({ row, markPaid: false })}
            onUndo={(row) => row.payment && bills.undoPayment(row.payment)}
            onHistory={(row) => setHistoryBill(row.bill)}
            onEdit={(row) => editBill(row.bill)}
            onAddPurchase={(row) => setPurchaseDialog({ card: row.bill })}
            onSelect={(row) => setSelectedCardId(row.bill.id)}
          />
        ) : view === 'summary' ? (
          <MonthSummary
            loading={bills.loading || subs.loading}
            monthRows={(m) => bills.monthRows(m, subs.all)}
            bills={bills.bills}
            purchases={bills.purchases}
            subscriptions={subs.all}
            month={month}
          />
        ) : (
          <>
            <SummaryCards loading={bills.loading} rows={billRows} />

            <div className="px-4 lg:px-6">
              <BillsTable
                loading={bills.loading}
                rows={billRows}
                hasBills={bills.bills.some((bill) => !isCard(bill))}
                onPay={(row) => setPaymentRow({ row, markPaid: true })}
                onEnter={(row) => setPaymentRow({ row, markPaid: false })}
                onUndo={(row) => row.payment && bills.undoPayment(row.payment)}
                onHistory={(row) => setHistoryBill(row.bill)}
                onEdit={(row) => editBill(row.bill)}
              />
            </div>
          </>
        )}
      </PageBody>

      <BillFormDialog
        open={billDialog !== null && confirm === null}
        onOpenChange={(open) => !open && setBillDialog(null)}
        bill={billDialog?.bill}
        onSubmit={(input) => bills.saveBill(input, billDialog?.bill)}
        onDelete={(bill) => setConfirm({ kind: 'delete', bill })}
      />
      <CardFormDialog
        open={cardDialog !== null && confirm === null}
        onOpenChange={(open) => !open && setCardDialog(null)}
        card={cardDialog?.card}
        onSubmit={(input) => bills.saveBill(input, cardDialog?.card)}
        onDelete={(card) => setConfirm({ kind: 'delete', bill: card })}
      />
      <PurchaseFormDialog
        open={purchaseDialog !== null && deletingPurchase === null}
        onOpenChange={(open) => !open && setPurchaseDialog(null)}
        card={purchaseDialog?.card}
        purchase={purchaseDialog?.purchase}
        onSubmit={(input) => bills.savePurchase(input, purchaseDialog?.purchase)}
        onDelete={setDeletingPurchase}
      />
      <PaymentDialog
        row={paymentRow?.row ?? null}
        month={month}
        markPaid={paymentRow?.markPaid ?? false}
        onClose={() => setPaymentRow(null)}
        onSubmit={(row, input, newFiles, removed) => bills.savePayment(row.bill, month, input, newFiles, removed)}
      />
      <BillHistoryDialog
        bill={historyBill}
        history={historyBill ? bills.history(historyBill, month) : []}
        onClose={() => setHistoryBill(null)}
        onEdit={(bill) => {
          setHistoryBill(null)
          editBill(bill)
        }}
        onEnd={(bill) => setConfirm({ kind: 'end', bill })}
      />
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === 'end' ? `Encerrar ${confirm.bill.name}?` : confirm && isCard(confirm.bill) ? 'Excluir cartão?' : 'Excluir conta?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'end'
                ? `Ela deixa de aparecer depois de ${formatMonth(month)}. O histórico continua guardado.`
                : `${confirm?.bill.name ?? ''} e todos os lançamentos dela serão removidos. Para manter o histórico, prefira encerrar.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm?.kind === 'delete' ? 'destructive' : 'default'}
              onClick={async () => {
                if (confirm?.kind === 'end' && (await bills.endBill(confirm.bill, month))) setHistoryBill(null)
                if (confirm?.kind === 'delete' && (await bills.deleteBill(confirm.bill))) {
                  setBillDialog(null)
                  setCardDialog(null)
                }
                setConfirm(null)
              }}
            >
              {confirm?.kind === 'end' ? 'Encerrar' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={deletingPurchase !== null} onOpenChange={(open) => !open && setDeletingPurchase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir compra?</AlertDialogTitle>
            <AlertDialogDescription>{deletingPurchase?.description} sai de todas as faturas em que aparece.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (deletingPurchase && (await bills.deletePurchase(deletingPurchase))) setPurchaseDialog(null)
                setDeletingPurchase(null)
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

function SummaryCards({ loading, rows }: { loading: boolean; rows: MonthRow[] }) {
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const paid = rows.filter((r) => r.status === 'paid')
  const open = rows.filter((r) => r.status !== 'paid')
  const overdue = open.filter((r) => r.status === 'overdue')
  const next = open.find((r) => r.status === 'pending')
  const estimated = rows.filter((r) => r.estimated).length

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <StatCard
        loading={loading}
        label="Total do mês"
        value={formatMoney(total)}
        badge={`${rows.length} ${rows.length === 1 ? 'conta' : 'contas'}`}
        headline={estimated ? `${estimated} com valor estimado` : rows.length ? 'Todos os valores lançados' : 'Nenhuma conta neste mês'}
        detail="Valores reais ou estimados"
      />
      <StatCard
        loading={loading}
        label="Pago"
        value={formatMoney(paid.reduce((s, r) => s + r.amount, 0))}
        headline={`${paid.length} de ${rows.length} pagas`}
        detail={rows.length && paid.length === rows.length ? 'Tudo em dia' : ' '}
      />
      <StatCard
        loading={loading}
        label="A pagar"
        value={formatMoney(open.reduce((s, r) => s + r.amount, 0))}
        badge={overdue.length ? `${overdue.length} ${overdue.length === 1 ? 'atrasada' : 'atrasadas'}` : undefined}
        badgeVariant="destructive"
        headline={open.length ? `${open.length} ${open.length === 1 ? 'conta' : 'contas'} em aberto` : 'Nada em aberto'}
        detail={overdue.length ? overdue.map((r) => r.bill.name).join(', ') : ' '}
      />
      <StatCard
        loading={loading}
        label="Próximo vencimento"
        value={next ? formatDate(next.dueDate) : '—'}
        badge={next ? (daysUntil(next.dueDate) === 0 ? 'hoje' : `em ${daysUntil(next.dueDate)} dias`) : undefined}
        headline={next ? next.bill.name : 'Nada a vencer'}
        detail={next ? formatMoney(next.amount) + (next.estimated ? ' (estimado)' : '') : ' '}
      />
    </div>
  )
}

function StatCard({
  loading,
  label,
  value,
  badge,
  badgeVariant = 'outline',
  headline,
  detail,
}: {
  loading: boolean
  label: string
  value: string
  badge?: string
  badgeVariant?: 'outline' | 'destructive'
  headline: string
  detail: string
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="col-span-full truncate text-2xl font-semibold tabular-nums @[340px]/card:text-3xl">
          {loading ? <Skeleton className="h-9 w-32" /> : value}
        </CardTitle>
        {!loading && badge && (
          <CardAction className="row-span-1">
            <Badge variant={badgeVariant}>{badge}</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        {loading ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          <>
            <div className="line-clamp-1 font-medium">{headline}</div>
            <div className="line-clamp-1 text-muted-foreground">{detail}</div>
          </>
        )}
      </CardFooter>
    </Card>
  )
}

function BillsTable({
  loading,
  rows,
  hasBills,
  onPay,
  onEnter,
  onUndo,
  onHistory,
  onEdit,
}: {
  loading: boolean
  rows: MonthRow[]
  hasBills: boolean
  onPay: (row: MonthRow) => void
  onEnter: (row: MonthRow) => void
  onUndo: (row: MonthRow) => void
  onHistory: (row: MonthRow) => void
  onEdit: (row: MonthRow) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead className="pl-4">Vencimento</TableHead>
            <TableHead>Conta</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="hidden sm:table-cell">Status</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            [0, 1, 2].map((i) => (
              <TableRow key={i}>
                <TableCell colSpan={5} className="px-4">
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                {hasBills ? 'Nenhuma conta neste mês.' : 'Nenhuma conta ainda. Adicione luz, água, aluguel…'}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.bill.id} className="cursor-pointer" onClick={() => onHistory(row)}>
                <TableCell className="pl-4">
                  <div className="flex flex-col">
                    <span className={`tabular-nums ${row.status === 'overdue' ? 'font-medium text-destructive' : ''}`}>
                      {formatDate(row.dueDate, { day: '2-digit', month: '2-digit' })}
                    </span>
                    <span className="text-xs text-muted-foreground sm:hidden">{BILL_STATUS_LABELS[row.status]}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-56">
                  <div className="flex flex-col">
                    <span className="truncate font-medium">{row.bill.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {(isCard(row.bill) && cardLabel(row.bill)) || BILL_CATEGORIES[row.bill.category]} · {PAYMENT_METHODS[row.bill.paymentMethod]}
                      {billFrequency(row.bill) !== 'monthly' && ` · ${FREQUENCIES[billFrequency(row.bill)].label.toLowerCase()}`}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <span className={`tabular-nums ${row.estimated ? 'text-muted-foreground' : 'font-medium'}`}>
                      {row.amount ? formatMoney(row.amount) : '—'}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {row.payment?.attachments.length ? <PaperclipIcon className="size-3" /> : null}
                      {row.estimated ? 'estimado' : row.payment?.paidAt ? `paga ${formatDate(row.payment.paidAt, { day: '2-digit', month: '2-digit' })}` : ''}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1 pr-2">
                    {row.status !== 'paid' && (
                      <Button variant="outline" size="sm" onClick={() => onPay(row)}>
                        <CheckIcon />
                        <span className="hidden md:inline">Marcar como paga</span>
                        <span className="md:hidden">Pagar</span>
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                          <EllipsisVerticalIcon />
                          <span className="sr-only">Ações</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onSelect={() => onEnter(row)}>
                          {row.estimated ? 'Lançar valor' : 'Editar lançamento'}
                        </DropdownMenuItem>
                        {row.status === 'paid' && (
                          <DropdownMenuItem onSelect={() => onUndo(row)}>Desfazer pagamento</DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => onHistory(row)}>Ver histórico</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => onEdit(row)}>{isCard(row.bill) ? 'Editar cartão' : 'Editar conta'}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
