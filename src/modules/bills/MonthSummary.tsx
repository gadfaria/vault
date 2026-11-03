import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { addMonths, formatDate, formatMoney, formatMonth, shiftMonth } from '@/lib/format'
import { chargesInMonth, type Subscription } from '../subscriptions/types'
import { BILL_CATEGORIES, installmentIn, isCard, PURCHASE_CATEGORIES, statementSpendMonth, type Bill, type CardPurchase } from './types'
import type { MonthRow } from './useBills'

type Source = 'bills' | 'cards' | 'subscriptions'

/** One line of the month's spending. */
interface Entry {
  key: string
  date: string
  description: string
  /** Where it is paid: "Conta", the card's name or the subscription's payment method */
  origin: string
  category: string
  amount: number
  source: Source
  /** e.g. "3/10" or "estimado" */
  note?: string
  estimated?: boolean
}

/**
 * Everything spent in a month: bills due in it, card purchases made in it (an installment purchase
 * adds one installment to each month from its date), subscriptions charged in it, and the part of
 * card statements not covered by registered purchases, in the month most of that statement was spent.
 */
function monthEntries(
  monthRows: (month: string) => MonthRow[],
  bills: Bill[],
  purchases: CardPurchase[],
  subscriptions: Subscription[],
  month: string,
): Entry[] {
  const entries: Entry[] = []
  const cards = new Map(bills.filter(isCard).map((bill) => [bill.id, bill]))

  for (const row of monthRows(month)) {
    if (isCard(row.bill)) continue
    entries.push({
      key: row.bill.id,
      date: row.dueDate,
      description: row.bill.name,
      origin: 'Conta',
      category: BILL_CATEGORIES[row.bill.category],
      amount: row.amount,
      source: 'bills',
      note: row.estimated ? 'estimado' : undefined,
      estimated: row.estimated,
    })
  }

  for (const purchase of purchases) {
    const card = cards.get(purchase.cardId)
    const installment = card && installmentIn({ ...purchase, firstMonth: purchase.date.slice(0, 7) }, month)
    if (!card || !installment) continue
    entries.push({
      key: `${purchase.id}-${installment.number}`,
      date: addMonths(purchase.date, installment.number - 1),
      description: purchase.description,
      origin: card.name,
      category: PURCHASE_CATEGORIES[purchase.category ?? 'other'],
      amount: installment.amount,
      source: 'cards',
      note: purchase.installments > 1 ? `${installment.number}/${purchase.installments}` : undefined,
    })
  }

  for (const subscription of subscriptions) {
    const card = subscription.cardId ? cards.get(subscription.cardId) : undefined
    for (const date of chargesInMonth(subscription, month)) {
      entries.push({
        key: `${subscription.id}-${date}`,
        date,
        description: subscription.name,
        origin: card?.name ?? (subscription.paymentMethod || 'Assinatura'),
        category: 'Assinaturas',
        amount: subscription.amount,
        source: card ? 'cards' : 'subscriptions',
      })
    }
  }

  // A statement is due up to two months after most of it was spent
  const statements = [month, shiftMonth(month, 1), shiftMonth(month, 2)].flatMap(monthRows)
  for (const row of statements) {
    if (!isCard(row.bill) || statementSpendMonth(row.bill, row.dueDate.slice(0, 7)) !== month) continue
    const itemized = [...row.purchases.map((p) => p.amount), ...row.charges.map((c) => c.subscription.amount)].reduce((s, a) => s + a, 0)
    const rest = row.amount - itemized
    if (rest === 0) continue
    entries.push({
      key: `${row.bill.id}-${row.dueDate}-rest`,
      date: `${month}-01`,
      description: rest > 0 ? 'Gastos não lançados' : 'Ajuste da fatura',
      origin: `${row.bill.name} · fatura de ${formatMonth(row.dueDate.slice(0, 7), true)}`,
      category: 'Não detalhado',
      amount: rest,
      source: 'cards',
      note: row.estimated ? 'estimado' : undefined,
      estimated: row.estimated,
    })
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description))
}

export function MonthSummary({
  loading,
  monthRows,
  bills,
  purchases,
  subscriptions,
  month,
}: {
  loading: boolean
  /** Every bill and card statement of a month */
  monthRows: (month: string) => MonthRow[]
  bills: Bill[]
  purchases: CardPurchase[]
  /** Every subscription, cancelled ones included */
  subscriptions: Subscription[]
  month: string
}) {
  const entries = monthEntries(monthRows, bills, purchases, subscriptions, month)
  const sum = (source?: Source) => entries.filter((e) => !source || e.source === source).reduce((s, e) => s + e.amount, 0)
  const total = sum()

  const byCategory = new Map<string, number>()
  for (const entry of entries) byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.amount)
  const categories = [...byCategory].filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1])
  const max = categories[0]?.[1] ?? 0

  const sources: { label: string; amount: number; detail: string }[] = [
    { label: 'Contas', amount: sum('bills'), detail: 'Luz, água, aluguel…' },
    { label: 'Cartões', amount: sum('cards'), detail: 'Compras feitas no mês' },
    { label: 'Assinaturas fora do cartão', amount: sum('subscriptions'), detail: 'Pix, débito, boleto…' },
  ]

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs dark:bg-card">
          <CardHeader>
            <CardDescription>Total do mês</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {loading ? <Skeleton className="h-9 w-32" /> : formatMoney(total)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Contas, cartões e assinaturas</CardContent>
        </Card>
        {sources.map((source) => (
          <Card key={source.label} className="@container/card">
            <CardHeader>
              <CardDescription>{source.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {loading ? <Skeleton className="h-8 w-28" /> : formatMoney(source.amount)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {!loading && total > 0 ? `${Math.round((source.amount / total) * 100)}% · ` : ''}
              {source.detail}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 @5xl/main:grid-cols-3">
        <Card className="@5xl/main:col-span-1">
          <CardHeader>
            <CardTitle>Por categoria</CardTitle>
            <CardDescription>Contas e compras juntas</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum gasto neste mês.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {categories.map(([category, amount]) => (
                  <li key={category} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate">{category}</span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatMoney(amount)}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">{Math.round((amount / total) * 100)}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(amount / max) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-lg border @5xl/main:col-span-2">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="pl-4">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                <TableHead className="hidden sm:table-cell">Onde</TableHead>
                <TableHead className="pr-4 text-right">Valor</TableHead>
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
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Nenhum gasto neste mês.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.key}>
                    <TableCell className="pl-4 tabular-nums">{formatDate(entry.date, { day: '2-digit', month: '2-digit' })}</TableCell>
                    <TableCell className="max-w-36 sm:max-w-64">
                      <div className="flex flex-col">
                        <span className="truncate font-medium">{entry.description}</span>
                        <span className="truncate text-xs text-muted-foreground sm:hidden">
                          {entry.category} · {entry.origin}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{entry.category}</TableCell>
                    <TableCell className="hidden max-w-40 truncate sm:table-cell">{entry.origin}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`tabular-nums ${entry.estimated ? 'text-muted-foreground' : ''}`}>{formatMoney(entry.amount)}</span>
                        {entry.note && <span className="text-xs text-muted-foreground tabular-nums">{entry.note}</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {!loading && entries.length > 0 && (
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
    </div>
  )
}
