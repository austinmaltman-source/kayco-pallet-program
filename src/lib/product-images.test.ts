import { describe, expect, it } from 'vitest'
import { mergeProductImages } from './product-images'
import { makeProduct } from '../test/test-utils'

const API = 'https://kayco-planning-dashboard.pages.dev/product-images'

describe('mergeProductImages', () => {
  it('fills a missing photo by Kayco item number', () => {
    const products = [makeProduct({ id: 'a', kaycoItemNumber: '100100' })]
    const result = mergeProductImages(products, { '100100': `${API}/new.webp` })
    expect(result.updated).toBe(1)
    expect(result.products[0].imageUrl).toBe(`${API}/new.webp`)
  })

  it('matches item numbers that carry stray whitespace', () => {
    const products = [makeProduct({ id: 'a', kaycoItemNumber: ' 100100 ' })]
    const result = mergeProductImages(products, { '100100': `${API}/new.webp` })
    expect(result.products[0].imageUrl).toBe(`${API}/new.webp`)
  })

  it('refreshes an API-managed photo whose URL changed upstream', () => {
    const products = [
      makeProduct({ id: 'a', kaycoItemNumber: '100100', imageUrl: `${API}/old.webp` }),
    ]
    const result = mergeProductImages(products, { '100100': `${API}/new.webp` })
    expect(result.products[0].imageUrl).toBe(`${API}/new.webp`)
  })

  it('never overwrites a hand-set photo', () => {
    const own = 'https://example.com/my-photo.jpg'
    const products = [makeProduct({ id: 'a', kaycoItemNumber: '100100', imageUrl: own })]
    const result = mergeProductImages(products, { '100100': `${API}/new.webp` })
    expect(result.updated).toBe(0)
    expect(result.products[0].imageUrl).toBe(own)
  })

  it('returns the same array when nothing changed, so no write is triggered', () => {
    const products = [
      makeProduct({ id: 'a', kaycoItemNumber: '100100', imageUrl: `${API}/same.webp` }),
      makeProduct({ id: 'b', kaycoItemNumber: '999999' }),
    ]
    const result = mergeProductImages(products, { '100100': `${API}/same.webp` })
    expect(result.updated).toBe(0)
    expect(result.products).toBe(products)
  })

  it('leaves products alone when the map is empty (API down)', () => {
    const products = [makeProduct({ id: 'a', kaycoItemNumber: '100100' })]
    const result = mergeProductImages(products, {})
    expect(result.products).toBe(products)
  })
})
