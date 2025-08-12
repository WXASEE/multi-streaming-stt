# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages, layout, styles, and API routes (e.g., `api/transcribe/presign/route.ts`).
- `components/`: Reusable UI components (PascalCase files), plus `components/ui/` primitives.
- `hooks/`: React hooks (prefixed with `use`, e.g., `useWebSocketTranscription.ts`).
- `lib/`: Framework-agnostic logic (audio processing, eventstream, speaker mapping, types, utils).
- `public/`: Static assets (SVGs, icons).
- Root configs: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`.

## Build, Test, and Development Commands
- `pnpm dev`: Start local dev server with Turbopack at `http://localhost:3000`.
- `pnpm build`: Production build.
- `pnpm start`: Run the built app.
- `pnpm lint`: Lint with Next.js/TypeScript rules.
Use `pnpm install` to add dependencies.

## Coding Style & Naming Conventions
- **Language**: TypeScript. Prefer explicit types in `lib/`; infer in components.
- **ESLint**: Next core-web-vitals + TypeScript (see `eslint.config.mjs`). Fix issues before PRs.
- **Naming**: Components in PascalCase (`TranscriptionControls.tsx`); hooks start with `use`; utilities in `camelCase`.
- **Imports**: Keep React/UI concerns in `components/`, pure logic in `lib/`.

## Testing Guidelines
- Currently no formal test suite. If adding tests:
  - Use `.test.ts`/`.test.tsx` colocated with code or under `lib/__tests__/`.
  - Unit-test `lib/` functions (audio, eventstream, speaker-map). Prefer React Testing Library for components.
  - Aim for meaningful coverage on critical paths; avoid brittle UI snapshots.

## Commit & Pull Request Guidelines
- **Commits**: Follow Conventional Commits where possible, e.g., `feat:`, `fix:`, `chore(deps): update pnpm-lock.yaml`.
- **PRs**: Include purpose, related issues (`Closes #123`), screenshots/GIFs for UI changes, testing steps, and any env/config notes.
- Keep PRs focused and small; update docs when behavior changes.

## Security & Configuration Tips
- Configure AWS via `.env.local` (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`). Do not commit secrets.
- Only expose safe values with `NEXT_PUBLIC_` prefix when needed in the browser.
- API route `app/api/transcribe/presign/route.ts` runs on Node.js runtime and signs WebSocket URLs; validate permissions before testing.

