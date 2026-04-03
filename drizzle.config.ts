import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './packages/backend/src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH ?? './data/coruscant.db',
  },
})
