import type { ModuleScreenProps } from '..'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SubscriptionsScreen } from '../subscriptions/SubscriptionsScreen'
import { BillsScreen } from './BillsScreen'

type Section = 'bills' | 'subscriptions' | 'cards' | 'summary'

const SECTIONS: Record<Section, { label: string; href: string }> = {
  summary: { label: 'Resumo', href: '#/bills' },
  bills: { label: 'Contas', href: '#/bills/list' },
  subscriptions: { label: 'Assinaturas', href: '#/bills/subscriptions' },
  cards: { label: 'Cartões', href: '#/bills/cards' },
}

/** Bills, subscriptions, cards and the month summary share one sidebar entry; cards are bills, subscriptions keep their own file. */
export function BillsModuleScreen({ path }: ModuleScreenProps) {
  const section: Section = path[0] === 'subscriptions' || path[0] === 'cards' ? path[0] : path[0] === 'list' ? 'bills' : 'summary'
  const nav = (
    <div className="px-4 lg:px-6">
      <Tabs value={section} onValueChange={(value) => window.location.assign(SECTIONS[value as Section].href)}>
        <TabsList>
          {Object.entries(SECTIONS).map(([id, { label }]) => (
            <TabsTrigger key={id} value={id}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
  if (section === 'subscriptions') return <SubscriptionsScreen nav={nav} />
  return <BillsScreen nav={nav} view={section} />
}
