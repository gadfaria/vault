import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

/** Keeps a crash in one screen from blanking the whole app. Give it a `key` that changes with the route to reset it. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm font-medium">Algo deu errado nesta tela</p>
        <p className="text-sm text-muted-foreground">Seus dados no Drive não foram afetados.</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Recarregar
        </Button>
      </div>
    )
  }
}
