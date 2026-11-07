import { Loader2Icon } from 'lucide-react'

export function ReaderMessage({ children, spinner }: { children: React.ReactNode; spinner?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 py-24 text-sm text-muted-foreground">
      {spinner && <Loader2Icon className="size-5 animate-spin" />}
      {children}
    </div>
  )
}
