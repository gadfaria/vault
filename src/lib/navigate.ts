/** Goes to an in-app route ("#/notes/abc"); the hash router picks it up and the back button returns. */
export function navigate(href: string): void {
  window.location.assign(href)
}
