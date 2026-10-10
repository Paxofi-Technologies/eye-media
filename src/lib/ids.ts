import { randomInt } from 'node:crypto'

// Crockford-style alphabet: no I, L, O, U to avoid misreading references over the phone.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function randomCode(length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}

export function submissionReference(): string {
  return `EYE-${randomCode(6)}`
}

export function slugSuffix(): string {
  return randomCode(5).toLowerCase()
}
