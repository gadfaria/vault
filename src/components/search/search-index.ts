import type { LucideIcon } from "lucide-react"
import {
  BellIcon,
  CarIcon,
  FileTextIcon,
  HeartPulseIcon,
  IdCardIcon,
  LandmarkIcon,
  NotebookPenIcon,
  PiggyBankIcon,
  PillIcon,
  ReceiptTextIcon,
  RepeatIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  WrenchIcon,
} from "lucide-react"
import { formatDate, formatMoney } from "@/lib/format"
import { billFrequency, billHref, cardLabel, isCard, scheduleLabel, type Bill } from "@/modules/bills/types"
import { DOCUMENT_TYPES, documentLabel, formatAddress, type PersonalDocument, type PersonalProfile } from "@/modules/documents/types"
import { ACCOUNT_TYPES, INVESTMENT_KINDS, accountLabel, type Investment } from "@/modules/finance/types"
import type { InstitutionGroup } from "@/modules/finance/useFinance"
import { ENTRY_KINDS, type HealthEntry, type HealthProfile, type Medication } from "@/modules/health/types"
import { UNTITLED, folderPath, type Note, type NoteFolder } from "@/modules/notes/types"
import { scheduleLabel as reminderSchedule, type Reminder } from "@/modules/reminders/types"
import { CYCLES, categoryLabel, type Subscription } from "@/modules/subscriptions/types"
import { SERVICE_TYPES, vehicleLabel } from "@/modules/vehicles/types"
import type { VehicleSummary } from "@/modules/vehicles/useVehicles"

export interface SearchItem {
  id: string
  group: string
  icon: LucideIcon
  title: string
  subtitle: string
  /** Extra text that matches but isn't shown (numbers, notes, part names…) */
  keywords: string[]
  href: string
}

export interface SearchSources {
  accountGroups: InstitutionGroup[]
  investments: Investment[]
  bills: Bill[]
  reminders: Reminder[]
  subscriptions: Subscription[]
  documents: PersonalDocument[]
  profiles: PersonalProfile[]
  vehicles: VehicleSummary[]
  health: { profiles: HealthProfile[]; entries: HealthEntry[]; medications: Medication[] }
  notes: { notes: Note[]; folders: NoteFolder[] }
}

const clean = (parts: (string | undefined | false)[]) => parts.filter(Boolean).join(" · ")

export function buildSearchIndex(s: SearchSources): SearchItem[] {
  const items: SearchItem[] = []

  for (const document of s.documents) {
    items.push({
      id: `doc-${document.id}`,
      group: "Documentos",
      icon: IdCardIcon,
      title: clean([documentLabel(document), document.owner]),
      // The number is usually what you are looking for, so it is shown right away.
      subtitle: clean([document.number, document.issuer, document.expiryDate && `validade ${formatDate(document.expiryDate)}`]),
      keywords: [DOCUMENT_TYPES[document.type], document.number.replace(/\D/g, ""), document.notes],
      href: `#/documents/${document.id}`,
    })
  }

  for (const profile of s.profiles) {
    const address = formatAddress(profile)
    items.push({
      id: `profile-person-${profile.id}`,
      group: "Documentos",
      icon: UserRoundIcon,
      title: `Dados pessoais · ${profile.person}`,
      subtitle: clean([profile.cpf && `CPF ${profile.cpf}`, profile.city && `${profile.city}/${profile.state}`]),
      // Labels make "cep", "passaporte", "endereço" or "mãe" find the card; values make the data itself findable.
      keywords: [
        "dados pessoais", "cpf", "endereço", "cep", "telefone", "e-mail", "mãe", "pai", "passaporte",
        profile.fullName, profile.cpf, profile.cpf.replace(/\D/g, ""), address, profile.zip, profile.phone, profile.email,
        profile.motherName, profile.fatherName, profile.passport,
        ...profile.extras.flatMap((e) => [e.label, e.value]),
      ],
      href: "#/documents",
    })
  }

  for (const group of s.accountGroups) {
    for (const { account, latest } of group.accounts) {
      items.push({
        id: `account-${account.id}`,
        group: "Finanças",
        icon: LandmarkIcon,
        title: clean([account.institution, accountLabel(account)]),
        subtitle: latest ? `${formatMoney(latest.amount)} em ${formatDate(latest.date)}` : "Sem saldo",
        keywords: [ACCOUNT_TYPES[account.type], "conta", "saldo"],
        href: "#/finance",
      })
    }
  }

  for (const investment of s.investments) {
    items.push({
      id: `investment-${investment.id}`,
      group: "Finanças",
      icon: PiggyBankIcon,
      title: investment.name,
      subtitle: clean([
        investment.institution,
        formatMoney(investment.amount),
        investment.rate,
        investment.redeemedAt ? `resgatado ${formatDate(investment.redeemedAt)}` : investment.maturity && `vence ${formatDate(investment.maturity)}`,
      ]),
      keywords: [INVESTMENT_KINDS[investment.kind], "investimento", "aplicação", investment.notes],
      href: "#/finance",
    })
  }

  for (const bill of s.bills) {
    items.push({
      id: `bill-${bill.id}`,
      group: "Contas",
      icon: ReceiptTextIcon,
      title: bill.name,
      subtitle: clean([
        isCard(bill) ? cardLabel(bill) || "cartão" : undefined,
        scheduleLabel(bill),
        bill.estimate ? `~${formatMoney(bill.estimate)}` : undefined,
        bill.endMonth && billFrequency(bill) !== "once" && "encerrada",
      ]),
      keywords: isCard(bill)
        ? [bill.notes, "cartão", "fatura", "crédito", bill.card?.bank ?? "", bill.card?.lastDigits ?? ""]
        : [bill.notes, "conta"],
      href: billHref(bill),
    })
  }

  for (const reminder of s.reminders) {
    items.push({
      id: `reminder-${reminder.id}`,
      group: "Lembretes",
      icon: BellIcon,
      title: reminder.title,
      subtitle: clean([reminderSchedule(reminder), reminder.endedAt && "encerrado"]),
      keywords: [reminder.notes, "lembrete"],
      href: "#/reminders",
    })
  }

  for (const subscription of s.subscriptions) {
    items.push({
      id: `sub-${subscription.id}`,
      group: "Assinaturas",
      icon: RepeatIcon,
      title: subscription.name,
      subtitle: clean([
        `${formatMoney(subscription.amount)} ${CYCLES[subscription.cycle].label.toLowerCase()}`,
        subscription.paymentMethod,
        subscription.cancelledAt && "cancelada",
      ]),
      keywords: [categoryLabel(subscription.category), subscription.notes, "assinatura"],
      href: "#/bills/subscriptions",
    })
  }

  for (const { vehicle, services, currentPolicy, nextPolicy, pastPolicies } of s.vehicles) {
    const href = `#/vehicles/${vehicle.id}`
    const name = vehicleLabel(vehicle)
    items.push({
      id: `vehicle-${vehicle.id}`,
      group: "Veículos",
      icon: CarIcon,
      title: name,
      subtitle: clean([vehicle.plate, vehicle.year, vehicle.color]),
      keywords: [vehicle.brand, vehicle.model, vehicle.chassis, vehicle.renavam, vehicle.notes, "carro", "veículo"],
      href,
    })
    for (const service of services) {
      items.push({
        id: `service-${service.id}`,
        group: "Veículos",
        icon: WrenchIcon,
        title: service.title,
        subtitle: clean([name, formatDate(service.date), service.workshop]),
        keywords: [SERVICE_TYPES[service.type], ...service.parts.map((p) => p.name), service.notes, "manutenção"],
        href,
      })
    }
    for (const policy of [currentPolicy, nextPolicy, ...pastPolicies].filter((p) => p !== undefined)) {
      items.push({
        id: `policy-${policy.id}`,
        group: "Veículos",
        icon: ShieldCheckIcon,
        title: `Seguro ${policy.insurer}`,
        subtitle: clean([name, policy.policyNumber && `apólice ${policy.policyNumber}`, `até ${formatDate(policy.endDate)}`]),
        keywords: [policy.broker, policy.assistancePhone, policy.coverages, "seguro", "apólice"],
        href,
      })
    }
  }

  for (const profile of s.health.profiles) {
    items.push({
      id: `profile-${profile.id}`,
      group: "Saúde",
      icon: HeartPulseIcon,
      title: `Perfil de saúde · ${profile.person}`,
      subtitle: clean([profile.bloodType, profile.insurance, profile.insuranceNumber]),
      keywords: [profile.allergies, profile.conditions, profile.emergencyContact, "alergia", "plano", "carteirinha"],
      href: "#/health",
    })
  }
  for (const entry of s.health.entries) {
    items.push({
      id: `entry-${entry.id}`,
      group: "Saúde",
      icon: FileTextIcon,
      title: entry.title,
      subtitle: clean([entry.person, ENTRY_KINDS[entry.kind], formatDate(entry.date), entry.provider]),
      keywords: [entry.specialty, entry.notes],
      href: "#/health",
    })
  }
  for (const medication of s.health.medications) {
    items.push({
      id: `med-${medication.id}`,
      group: "Saúde",
      icon: PillIcon,
      title: medication.name,
      subtitle: clean([medication.person, medication.dosage, medication.frequency]),
      keywords: [medication.notes, "remédio", "medicamento"],
      href: "#/health",
    })
  }

  for (const note of s.notes.notes) {
    const path = folderPath(s.notes.folders, note.folderId)
    items.push({
      id: `note-${note.id}`,
      group: "Notas",
      icon: NotebookPenIcon,
      title: note.title || UNTITLED,
      subtitle: path.join(" / "),
      keywords: ["nota"],
      href: `#/notes/${note.id}`,
    })
  }

  return items
}

/** Lowercase without accents, so "saude" finds "Saúde" and "cnh" finds "CNH". */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}
