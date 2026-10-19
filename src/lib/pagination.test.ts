import { describe, expect, it } from 'vitest'
import { pageItems, parsePage } from './pagination'

describe('pageItems', () => {
  it('shows everything for few pages', () => {
    expect(pageItems(1, 1)).toEqual([1])
    expect(pageItems(2, 4)).toEqual([1, 2, 3, 4])
  })
  it('collapses long ranges like the design system (1 2 3 … 12)', () => {
    expect(pageItems(1, 12)).toEqual([1, 2, null, 12])
    expect(pageItems(6, 12)).toEqual([1, null, 5, 6, 7, null, 12])
    expect(pageItems(12, 12)).toEqual([1, null, 11, 12])
  })
  it('fills a single-page gap with the page instead of an ellipsis', () => {
    expect(pageItems(3, 12)).toEqual([1, 2, 3, 4, null, 12])
  })
  it('clamps out-of-range pages', () => {
    expect(pageItems(99, 5)).toEqual([1, null, 4, 5])
  })
})

describe('parsePage', () => {
  it('parses and clamps', () => {
    expect(parsePage('3')).toBe(3)
    expect(parsePage('0')).toBe(1)
    expect(parsePage('-2')).toBe(1)
    expect(parsePage('abc')).toBe(1)
    expect(parsePage(undefined)).toBe(1)
    expect(parsePage(['4', '5'])).toBe(4)
    expect(parsePage('99999999')).toBe(10000)
  })
})
