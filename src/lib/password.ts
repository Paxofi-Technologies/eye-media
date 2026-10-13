import { hash } from '@node-rs/argon2'

// argon2id with OWASP-recommended baseline parameters.
export const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const

export function hashPassword(password: string) {
  return hash(password, ARGON_OPTS)
}
