// Follow the OS light/dark preference (shadcn dark tokens live under .dark).
// A file rather than an inline script, so the Content-Security-Policy needs no 'unsafe-inline'.
const media = matchMedia('(prefers-color-scheme: dark)')
const apply = () => document.documentElement.classList.toggle('dark', media.matches)
apply()
media.addEventListener('change', apply)
