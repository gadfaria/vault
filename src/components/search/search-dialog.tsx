import { useState } from "react"
import { navigate } from "@/lib/navigate"
import { Loader2Icon } from "lucide-react"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { MODULES, SUB_PAGES } from "@/modules"
import { useBills } from "@/modules/bills/useBills"
import { useDocuments } from "@/modules/documents/useDocuments"
import { useFinance } from "@/modules/finance/useFinance"
import { useHealth } from "@/modules/health/useHealth"
import { useNotes } from "@/modules/notes/useNotes"
import { useReminders } from "@/modules/reminders/useReminders"
import { useSubscriptions } from "@/modules/subscriptions/useSubscriptions"
import { useVehicles } from "@/modules/vehicles/useVehicles"
import { buildSearchIndex, normalize, type SearchItem } from "./search-index"

/**
 * Every word typed must appear somewhere in the item, ignoring case and accents.
 * Item values start with a unique id (cmdk needs one); it is skipped so that typing
 * digits doesn't match pieces of UUIDs.
 */
function filter(value: string, search: string, keywords?: string[]): number {
  const text = value.slice(value.indexOf(" ") + 1)
  const haystack = normalize([text, ...(keywords ?? [])].join(" "))
  return normalize(search)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
    ? 1
    : 0
}

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Buscar"
      description="Busque em todos os módulos do vault"
      className="sm:max-w-xl"
    >
      {/* Mounted only while open, so the collections load on demand. */}
      {open && <SearchPanel onNavigate={() => onOpenChange(false)} />}
    </CommandDialog>
  )
}

function SearchPanel({ onNavigate }: { onNavigate: () => void }) {
  const [search, setSearch] = useState("")
  const finance = useFinance()
  const bills = useBills()
  const subs = useSubscriptions()
  const docs = useDocuments()
  const health = useHealth()
  const vehicles = useVehicles()
  const reminders = useReminders()
  const notes = useNotes()
  const loading =
    finance.loading ||
    bills.loading ||
    subs.loading ||
    docs.loading ||
    health.loading ||
    vehicles.loading ||
    reminders.loading ||
    notes.loading

  const items = loading
    ? []
    : buildSearchIndex({
        accountGroups: finance.groups,
        investments: [...finance.activeInvestments, ...finance.redeemedInvestments],
        bills: bills.bills,
        reminders: reminders.all,
        subscriptions: [...subs.active, ...subs.cancelled].map((r) => r.subscription),
        documents: docs.rows.map((r) => r.document),
        profiles: docs.profiles,
        vehicles: vehicles.summaries,
        health: health.people.reduce(
          (acc, person) => {
            const data = health.forPerson(person)
            if (data.profile) acc.profiles.push(data.profile)
            acc.entries.push(...data.entries)
            acc.medications.push(...data.activeMedications, ...data.pastMedications)
            return acc
          },
          { profiles: [], entries: [], medications: [] } as Parameters<typeof buildSearchIndex>[0]["health"],
        ),
        notes: { notes: notes.notes, folders: notes.folders },
      })

  const groups = new Map<string, SearchItem[]>()
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item])

  function go(href: string) {
    navigate(href)
    onNavigate()
  }

  return (
    <Command filter={filter}>
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Buscar nota, documento, conta, placa, apólice…"
      />
      <CommandList className="max-h-[60svh]">
        {loading && search && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Carregando dados…
          </div>
        )}
        {!loading && <CommandEmpty>Nada encontrado para “{search}”.</CommandEmpty>}

        <CommandGroup heading="Páginas">
          {MODULES.map((module) => (
            <CommandItem
              key={module.id}
              value={`page-${module.id} ${module.name}`}
              keywords={["ir para", "página"]}
              onSelect={() => go(`#/${module.id}`)}
            >
              <module.icon />
              {module.name}
            </CommandItem>
          ))}
          {SUB_PAGES.map((page) => (
            <CommandItem
              key={page.href}
              value={`page-${page.href} ${page.name}`}
              keywords={["ir para", "página"]}
              onSelect={() => go(page.href)}
            >
              <page.icon />
              {page.name}
            </CommandItem>
          ))}
        </CommandGroup>

        {/* With an empty box only the pages show; results appear once you type. */}
        {search.trim() !== "" &&
          [...groups.entries()].map(([group, list]) => (
            <CommandGroup key={group} heading={group}>
              {list.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.id} ${item.title} ${item.subtitle}`}
                  keywords={item.keywords.filter(Boolean)}
                  onSelect={() => go(item.href)}
                >
                  <item.icon />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{item.title}</span>
                    {item.subtitle && <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
      </CommandList>
    </Command>
  )
}
