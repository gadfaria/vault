/**
 * EPUB chapters render in iframes on the app's own origin (blob: URLs), where a script could
 * reach the Drive token. foliate-js already drops script files; this removes what remains
 * (inline scripts, on* handlers, javascript: links, nested frames) before a chapter is rendered,
 * and adds a CSP that blocks scripts as a second layer.
 */
const MARKUP_TYPES = new Set(['application/xhtml+xml', 'text/html', 'image/svg+xml'])
const CSP = "script-src 'none'; object-src 'none'"
const URL_ATTRIBUTES = ['href', 'src', 'action', 'formaction', 'xlink:href']

export function isMarkup(type: string): boolean {
  return MARKUP_TYPES.has(type)
}

export function sanitizeMarkup(markup: string, type: string): string {
  let doc = new DOMParser().parseFromString(markup, type as DOMParserSupportedType)
  // A chapter that isn't well-formed XML is still cleaned, parsed leniently as HTML.
  if (doc.querySelector('parsererror')) doc = new DOMParser().parseFromString(markup, 'text/html')

  for (const el of doc.querySelectorAll('script, iframe, frame, frameset, object, embed, meta[http-equiv]')) el.remove()
  for (const el of doc.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      // Browsers ignore spaces and control characters in a URL, so " java\tscript:" still runs.
      const value = [...attr.value].filter((c) => c > ' ').join('').toLowerCase()
      if (name.startsWith('on') || (URL_ATTRIBUTES.includes(name) && value.startsWith('javascript:'))) {
        el.removeAttributeNode(attr)
      }
    }
  }

  if (type !== 'image/svg+xml') {
    const root = doc.documentElement
    const ns = root.namespaceURI
    let head: Element | null = doc.querySelector('head')
    if (!head) {
      head = doc.createElementNS(ns, 'head')
      root.prepend(head)
    }
    const meta = doc.createElementNS(ns, 'meta')
    meta.setAttribute('http-equiv', 'Content-Security-Policy')
    meta.setAttribute('content', CSP)
    head.prepend(meta)
  }

  return type === 'text/html' ? `<!DOCTYPE html>${doc.documentElement.outerHTML}` : new XMLSerializer().serializeToString(doc)
}
