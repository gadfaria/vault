import type { ComponentType } from 'react'
import { CreditCardIcon, ListIcon, RepeatIcon, type LucideIcon } from 'lucide-react'
import { bills } from './bills'
import { cameras } from './cameras'
import { documents } from './documents'
import { finance } from './finance'
import { health } from './health'
import { home } from './home'
import { notes } from './notes'
import { reading } from './reading'
import { reminders } from './reminders'
import { vehicles } from './vehicles'

export interface ModuleScreenProps {
  /** Route segments after the module id: #/vehicles/abc → ['abc'] */
  path: string[]
}

export interface VaultModule {
  /** URL slug (#/<id>) and collection file name (data/<id>.json). */
  id: string
  name: string
  icon: LucideIcon
  Screen: ComponentType<ModuleScreenProps>
}

/**
 * Every area of the vault, in sidebar order; the first one is the landing page.
 * To add one, create src/modules/<id>/ and register it here.
 */
export const MODULES: VaultModule[] = [home, reminders, notes, reading, finance, bills, vehicles, documents, health, cameras]

/** A page inside a module that keeps its own collection file, e.g. Assinaturas under Contas. */
export interface SubPage {
  name: string
  href: string
  icon: LucideIcon
  /** Its own data/<collection>.json, named in backups (none when it reads another module's file) */
  collection?: string
}

export const SUB_PAGES: SubPage[] = [
  { name: 'Assinaturas', href: '#/bills/subscriptions', icon: RepeatIcon, collection: 'subscriptions' },
  { name: 'Cartões', href: '#/bills/cards', icon: CreditCardIcon },
  { name: 'Lista de contas', href: '#/bills/list', icon: ListIcon },
]
