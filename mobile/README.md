# WACRM Mobile

Expo TypeScript client for the WACRM service-center platform.

## Architecture

The mobile app must call the authenticated WACRM API. It must not connect directly to application tables.

```text
Mobile app -> WACRM REST API -> Supabase
```

## Setup

```bash
cd mobile
npm install
cp .env.example .env
```

Edit `.env` and set:

- `EXPO_PUBLIC_SUPABASE_URL` — your Supabase project URL (same project as the web app)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon/public key
- `EXPO_PUBLIC_API_URL` — the public HTTPS URL of the WACRM web app (e.g. `https://crm.example.com`), no trailing slash

Expo automatically loads `.env` and inlines any `EXPO_PUBLIC_*` variable at build time.

## Run

```bash
npm start
```

Then press `i` for iOS simulator, `a` for Android emulator, or `w` for web — or use the dedicated scripts:

```bash
npm run android
npm run ios
npm run web
```

## Validate

```bash
npm run typecheck
```

Runs `tsc --noEmit` against the mobile project's own `tsconfig.json`.

## App structure

- `lib/supabase.ts` — Supabase client configured with Expo SecureStore session persistence.
- `lib/api.ts` — REST client that reads `EXPO_PUBLIC_API_URL` and attaches the current Supabase
  session's access token as `Authorization: Bearer <token>`.
- `hooks/use-auth.tsx` — `AuthProvider` / `useAuth()` for session state and sign-out.
- `hooks/use-api-resource.ts` — small hook for loading/error/data state around `lib/api.ts` calls.
- `screens/` — Dashboard, Tasks, Branches, Billing, Profile, and Login screens.
- `components/tab-bar.tsx` — bottom tab navigation (no external navigation library required).
- `components/api-screen.tsx`, `components/screen-state.tsx` — shared loading/error/empty UI for
  API-backed screens.

## Known limitation: no bearer-token bridge yet

The existing web routes under `src/app/api/*` are authenticated via Supabase SSR cookies set by
`src/middleware.ts` — they do **not** accept `Authorization: Bearer <token>` requests today. This
mobile client is wired to call `/api/mobile/*` endpoints with a bearer token, but those endpoints
do not exist on the server yet. Until a bearer-token bridge is added server-side, the Dashboard,
Tasks, Branches, and Billing screens will show a "Not connected yet" state with the underlying
error (401/404), rather than fabricated data. The Login and Profile screens work fully today since
they only rely on Supabase Auth, not the REST bridge.

Planned next step: add versioned, bearer-authenticated API routes (e.g. `/api/mobile/dashboard`,
`/api/mobile/tasks`, `/api/mobile/branches`, `/api/mobile/billing`) that validate the Supabase
access token server-side and return account-scoped data.

