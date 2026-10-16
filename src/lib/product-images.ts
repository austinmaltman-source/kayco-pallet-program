import type { Product } from '../types'

// Product photos come from the Kayco Sales Intelligence API, keyed by Kayco
// item number. The Worker reduces its ~5MB /items payload to a compact
// item-number -> URL map and edge-caches it for a day (/api/product-images);
// the browser HTTP-caches it too, so this is one small fetch per day.

// Photos hosted here are API-managed: they get refreshed when the API's URL
// changes. Any other imageUrl was set by hand and is never overwritten.
export const KAYCO_IMAGE_HOST = 'kayco-planning-dashboard.pages.dev'

export function isKaycoImageUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    return new URL(url).hostname === KAYCO_IMAGE_HOST
  } catch {
    return false
  }
}

let imageMapPromise: Promise<Record<string, string>> | null = null

export function loadProductImageMap(): Promise<Record<string, string>> {
  imageMapPromise ??= fetch('/api/product-images')
    .then((response) => {
      if (!response.ok) throw new Error(`product images -> ${response.status}`)
      return response.json() as Promise<{ data?: Record<string, string> }>
    })
    .then((body) => body.data ?? {})
    // Offline or upstream down: keep whatever images products already have.
    .catch(() => ({}))
  return imageMapPromise
}

export function mergeProductImages(
  products: Product[],
  images: Record<string, string>,
): { products: Product[]; updated: number } {
  let updated = 0
  const next = products.map((product) => {
    const itemNumber = product.kaycoItemNumber?.trim()
    if (!itemNumber) return product
    const apiUrl = images[itemNumber]
    if (!apiUrl || apiUrl === product.imageUrl) return product
    // A hand-set photo wins over the API's.
    if (product.imageUrl && !isKaycoImageUrl(product.imageUrl)) return product
    updated += 1
    return { ...product, imageUrl: apiUrl }
  })
  // Same array back when nothing changed, so callers can skip the write
  // (and the shared-state push it would trigger).
  return { products: updated > 0 ? next : products, updated }
}
