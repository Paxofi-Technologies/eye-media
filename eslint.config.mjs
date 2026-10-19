import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // The cPanel startup file is plain CommonJS executed directly by Passenger.
  { files: ['deploy/**/*.js'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'release/**', 'screenshots/**', 'next-env.d.ts', 'drizzle/**']),
])
