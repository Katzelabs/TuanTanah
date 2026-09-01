/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string
  /**
   * Short git SHA of the build, injected as a Docker build arg. Baked into the
   * bundle by Vite, so it is absent in `pnpm dev` — see `lib/version.ts`.
   */
  readonly VITE_BUILD_SHA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
