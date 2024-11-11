/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_AI_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
