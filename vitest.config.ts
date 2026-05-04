import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/src/__tests__/**/*.test.ts', 'packages/*/src/**/*.test.tsx'],
    environment: 'node',
  },
})
