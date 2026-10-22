# Finance Ledger Android App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner use the existing finance ledger from an Android phone anywhere, with web and mobile sharing one protected cloud database.

**Architecture:** Add single-owner authentication to the existing Express API, then connect the existing web client and a new Expo Android app to the same REST routes. Deploy API, web, and private PostgreSQL on a Docker VPS behind Caddy; migrate the current local database once and retain encrypted GitHub backups.

**Tech Stack:** Express, PostgreSQL, TypeScript, Ionic React, Expo, React Native, Expo SecureStore, Docker Compose, Caddy, OpenSSH.

**Spec:** `docs/superpowers/specs/2026-10-19-react-native-android-cloud-design.md`

## Global Constraints

- Android only; use Expo and TypeScript for the new mobile app.
- Keep the current Ionic React web client.
- Support one owner account; disable public registration.
- Hash passwords with Argon2id.
- Keep PostgreSQL on the private Docker network.
- Use HTTPS through Caddy; public ports 80 and 443 support redirects and certificate issuance; restrict SSH to administration and backup operations.
- Migrate local records once; use the cloud database as the shared production source after cutover.
- Keep encrypted backups in the private GitHub repository; never place the backup passphrase, production password, or private key in Git.
- Deliver a private installable APK; do not publish to Play Store.
- Keep offline edits and multi-user access out of scope.

## Review Focus

- Missing, expired, revoked, or malformed access token: finance routes return 401 and disclose no data. Pin in Task 2's API route checks.
- Invalid login and repeated guesses: return a generic credential error, then rate limit attempts. Pin in Task 2's authentication checks.
- Invalid amounts, dates, categories, or same-account transfers: reject before saving; transfers never change income or expense totals. Pin in Tasks 5 and 6's API and summary checks.
- Network loss during a write: show a connection error and never report that an unsaved change succeeded. Pin in Tasks 3 and 6's client checks.
- Wrong backup passphrase, damaged archive, or missing production confirmation: stop before replacing cloud data. Pin in Task 9's backup and restore checks.

---

### Task 1: Add authentication storage and owner provisioning

**Files:**
- Create: `db/migrations/001-auth.sql`
- Create: `scripts/migrate.mjs`
- Create: `scripts/create-owner.mjs`
- Create: `server/auth-crypto.ts`
- Create: `server/auth-crypto.test.ts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- `hashPassword(password: string): Promise<string>` returns an Argon2id hash.
- `verifyPassword(password: string, hash: string): Promise<boolean>` checks a password against its hash.
- `npm run db:migrate` applies each unapplied SQL migration once.
- `npm run owner:create` prompts locally for the sole owner's username and password; it accepts no credentials as command-line arguments.
- `createOwner(pool: Pool, username: string, password: string): Promise<void>` rejects a second owner.
- `npm run local` runs `db:up`, then `db:migrate`, then starts API and Vite.

- [ ] **Step 1: Add `server/auth-crypto.test.ts`** with cases for matching password, wrong password, and malformed stored hash.
- [ ] **Step 2: Add `test:server` to `package.json` as `tsx --test server/auth-crypto.test.ts`, run `npm run test:server`, and confirm the new cases fail before implementation.**
- [ ] **Step 3: Install `argon2`; add the Argon2id helpers, `owner_credentials` singleton table, `auth_sessions` table, migration runner, and interactive owner provisioning command.** Store SHA-256 hashes of opaque access and refresh tokens, never raw tokens. Make `npm run local` run migrations after `db:up`.
- [ ] **Step 4: Run `npm run test:server` and confirm all password cases pass; run `npm run db:migrate` twice and confirm the second run reports no pending migrations.**
- [ ] **Step 5: Commit** as `feat: add owner authentication storage`.

### Task 2: Add login, refresh, logout, and API protection

**Files:**
- Create: `server/auth.ts`
- Create: `server/auth-store.ts`
- Create: `server/auth-middleware.ts`
- Create: `server/app.ts`
- Create: `server/auth-routes.test.ts`
- Modify: `server/index.ts`
- Modify: `package.json`

**Interfaces:**
- `AuthStore` exposes owner lookup, session creation, access-token lookup, refresh rotation, and session revocation.
- `PgAuthStore` implements `AuthStore`; construct it with `new PgAuthStore(pool: Pool)` and persist sessions in `auth_sessions`.
- `createAuthRouter(store: AuthStore): Router` mounts `POST /api/auth/login`, `POST /api/auth/refresh`, and `POST /api/auth/logout`.
- `requireAuth(store: AuthStore): RequestHandler` accepts `Authorization: Bearer <accessToken>` and rejects inactive sessions.
- `createApp(pool: Pool, authStore: AuthStore): Express` mounts public health, auth, and protected finance routes for production and in-memory route checks.
- `AuthStore.findOwner(username: string): Promise<{ username: string; passwordHash: string } | null>`.
- `AuthStore.createSession(session: NewSession): Promise<void>`.
- `AuthStore.findActiveAccessToken(tokenHash: string, now: Date): Promise<{ id: string } | null>`.
- `AuthStore.rotateRefreshToken(currentHash: string, next: NewSession, now: Date): Promise<boolean>`.
- `AuthStore.revokeRefreshToken(tokenHash: string, now: Date): Promise<void>`.
- `NewSession` is `{ accessTokenHash: string; accessExpiresAt: Date; refreshTokenHash: string; refreshExpiresAt: Date }`.
- Login body: `{ username: string, password: string, client: 'web' | 'android' }`; response includes `{ accessToken: string, accessExpiresAt: string }`.
- Android login/refresh responses also include `{ refreshToken: string, refreshExpiresAt: string }`; web receives that refresh token only in the HTTP-only cookie.
- Refresh body: `{ client: 'web' | 'android', refreshToken?: string }`; web reads the cookie, Android sends the body token. Logout uses the same client-specific token source.
- Access tokens expire after 15 minutes; refresh tokens expire after 30 days and rotate on refresh.
- Web refresh tokens use an `HttpOnly`, `SameSite=Strict` cookie with `Secure` enabled in production. Android receives refresh tokens in the response body for SecureStore.
- Generate access and refresh tokens with 32 random bytes encoded as base64url; store only SHA-256 hashes in PostgreSQL.

- [ ] **Step 1: Add route checks** for successful web and Android login, invalid credentials, refresh rotation, logout revocation, rate limiting, and missing, expired, revoked, or malformed access tokens on every finance route. Use an in-memory `AuthStore` so checks never touch the personal database.
- [ ] **Step 2: Update `test:server` to run both server test files, run `npm run test:server`, and confirm the new route checks fail.**
- [ ] **Step 3: Install `cookie-parser` and `express-rate-limit`; implement auth routes and middleware.** Limit login to 10 attempts per IP per 15 minutes and return the same 401 message for an unknown username or wrong password.
- [ ] **Step 4: Move Express setup into `server/app.ts` and export `createApp`.** Mount `/api/auth` before protected finance routes; keep `GET /api/health` public and require authentication for `/api/state`, `/api/movements`, `/api/categories`, and `/api/accounts`.
- [ ] **Step 5: Make `server/index.ts` create the PostgreSQL pool, `PgAuthStore`, and HTTP listener from `createApp` without changing finance rules.**
- [ ] **Step 6: Run `npm run test:server`** and confirm login, refresh, logout, rate limiting, health, and 401 behavior match the interfaces above.
- [ ] **Step 7: Commit** as `feat: protect finance API with owner sessions`.

### Task 3: Add owner login to the existing web app

**Files:**
- Create: `src/auth.ts`
- Create: `src/AuthGate.tsx`
- Create: `src/LoginScreen.tsx`
- Create: `src/auth.test.ts`
- Modify: `src/api.ts`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `package.json`

**Interfaces:**
- `loginWeb(username: string, password: string): Promise<void>` stores the short-lived access token in memory and relies on the HTTP-only refresh cookie.
- `refreshWebSession(): Promise<boolean>` refreshes the access token through `/api/auth/refresh`.
- `logoutWeb(): Promise<void>` revokes the session and clears in-memory state.
- The existing finance request helpers keep their current names and payloads, add the bearer token, and retry once after a 401 refresh.

- [ ] **Step 1: Add auth checks** for initial session restore, successful login, rejected login, refresh after an expired access token, logout, and a failed finance write during network loss. Mock `fetch`; do not connect checks to PostgreSQL.
- [ ] **Step 2: Add `test:web` as `tsx --test src/auth.test.ts`, run `npm run test:web`, and confirm the new checks fail.**
- [ ] **Step 3: Implement `src/auth.ts`, `src/AuthGate.tsx`, and `src/LoginScreen.tsx`.** Keep the access token in memory; do not use localStorage for credentials.
- [ ] **Step 4: Update `src/api.ts` and `src/main.tsx`** to add authenticated requests, one refresh retry, and a login gate before rendering `App`.
- [ ] **Step 5: Replace local-only connection copy in `src/App.tsx`** with a general connection error and retry action.
- [ ] **Step 6: Run `npm run test:web` and `npm run build`**; confirm the login gate and finance UI compile.
- [ ] **Step 7: Commit** as `feat: add web owner login`.

### Task 4: Create the Expo Android app and authentication client

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/app.json`
- Create: `mobile/tsconfig.json`
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/login.tsx`
- Create: `mobile/src/auth/session.ts`
- Create: `mobile/src/api/client.ts`
- Create: `mobile/src/api/contracts.ts`
- Create: `mobile/src/auth/session.test.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `README.md`

**Interfaces:**
- `mobile/src/api/contracts.ts` mirrors `Category`, `Movement`, `AccountId`, and `FinanceState` from `src/api.ts`.
- `login(username: string, password: string): Promise<void>` stores the refresh token with Expo SecureStore and keeps the access token in memory.
- `getAccessToken(): Promise<string>` refreshes an expired access token before returning it.
- `apiRequest<T>(path: string, init?: RequestInit): Promise<T>` calls `EXPO_PUBLIC_API_BASE_URL` and returns parsed JSON or a readable API/network error.
- `SecureTokenStorage` exposes `getRefreshToken(): Promise<string | null>`, `setRefreshToken(token: string): Promise<void>`, and `clearRefreshToken(): Promise<void>`.
- `AuthApi` exposes `login(username: string, password: string): Promise<TokenResponse>`, `refresh(refreshToken: string): Promise<TokenResponse>`, and `logout(refreshToken: string): Promise<void>`.
- `SessionManager` exposes `login(username: string, password: string): Promise<void>`, `restore(): Promise<boolean>`, `getAccessToken(): Promise<string>`, and `logout(): Promise<void>`.
- `createSessionManager(storage: SecureTokenStorage, authApi: AuthApi): SessionManager` separates session behavior from the native SecureStore adapter for isolated checks.

- [ ] **Step 1: Add session checks** for encrypted refresh-token persistence, restoring a session after app restart, refresh rotation, logout, and no-network errors.
- [ ] **Step 2: Add `test:mobile` as `tsx --test mobile/src/auth/session.test.ts`, run `npm run test:mobile`, and confirm the new session checks fail.**
- [ ] **Step 3: Scaffold Expo with Expo Router and TypeScript.** Install Expo SecureStore with `npx expo install expo-secure-store`.
- [ ] **Step 4: Add `typecheck` to `mobile/package.json` as `tsc --noEmit`.**
- [ ] **Step 5: Implement the API client, auth session, and login screen.** Require HTTPS for production `EXPO_PUBLIC_API_BASE_URL`; allow a local emulator URL only in development configuration.
- [ ] **Step 6: Run `npm run test:mobile` and `npm --prefix mobile run typecheck`**; confirm login and session restoration compile.
- [ ] **Step 7: Commit** as `feat: scaffold authenticated Android client`.

### Task 5: Build the monthly ledger and account summary

**Files:**
- Create: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/(tabs)/index.tsx`
- Create: `mobile/src/features/ledger/selectors.ts`
- Create: `mobile/src/features/ledger/selectors.test.ts`
- Create: `mobile/src/features/ledger/MovementList.tsx`
- Modify: `mobile/src/api/contracts.ts`

**Interfaces:**
- `getMonthlySummary(state: FinanceState, month: string, filter: 'all' | AccountId): MonthlySummary` returns income, expenses, net, cash balance, and bank balance.
- `MonthlySummary` is `{ income: number; expenses: number; net: number; balances: Record<AccountId, number>; movements: Movement[] }`.
- The filter affects the movement list and monthly income/expense totals; balance cards always show total account balances through the selected month end. Transfers affect balances, not income or expense totals.
- The initial ledger screen loads state from `GET /api/state`, displays monthly movements and balances, and supports month and account filters.

- [ ] **Step 1: Add selector checks** for month boundaries, leap-year February, account filters, income destination accounts, transfers, and opening balances.
- [ ] **Step 2: Add the selector test to `test:mobile`, run `npm run test:mobile`, and confirm the selector checks fail.**
- [ ] **Step 3: Implement `getMonthlySummary` and movement filtering** using the current API's `FinanceState` fields and account rules.
- [ ] **Step 4: Implement the tab layout, monthly summary, month selector, account filters, and movement list.** Use a scrollable native list rather than the web spreadsheet grid.
- [ ] **Step 5: Run `npm run test:mobile` and `npm --prefix mobile run typecheck`**; confirm transfers do not affect income or expense totals.
- [ ] **Step 6: Commit** as `feat: add Android monthly ledger`.

### Task 6: Add movement and transfer operations

**Files:**
- Create: `mobile/app/movements/new.tsx`
- Create: `mobile/app/movements/[id].tsx`
- Create: `mobile/app/transfers/new.tsx`
- Create: `mobile/src/features/movements/validation.ts`
- Create: `mobile/src/features/movements/validation.test.ts`
- Modify: `mobile/app/(tabs)/index.tsx`
- Modify: `mobile/src/api/client.ts`

**Interfaces:**
- `MovementDraft` is `{ id?: string; date: string; kind: 'income' | 'expense'; amount: string; categoryId: string; account: AccountId; note: string }`.
- `TransferDraft` is `{ date: string; amount: string; account: AccountId; toAccount: AccountId; note: string }`.
- `ValidationResult` is `{ ok: true } | { ok: false; field: string; message: string }`.
- `validateMovement(input: MovementDraft): ValidationResult` rejects invalid dates, non-finite or non-positive amounts, and missing categories.
- `validateTransfer(input: TransferDraft): ValidationResult` rejects invalid dates, non-finite or non-positive amounts, and identical source/destination accounts.
- Use existing API routes and payloads: `POST`/`PUT`/`DELETE /api/movements`.

- [ ] **Step 1: Add validation checks** for zero, negative, non-finite amount, malformed date, missing category, and same-account transfer.
- [ ] **Step 2: Add the validation test to `test:mobile`, run `npm run test:mobile`, and confirm the validation checks fail.**
- [ ] **Step 3: Implement movement and transfer forms** with income/expense account direction matching `server/index.ts` validation rules.
- [ ] **Step 4: Implement movement edit and delete** using existing `PUT` and `DELETE /api/movements/:id` payloads.
- [ ] **Step 5: Show success only after the server confirms and refreshed state loads.** Preserve drafts and show a connection error after failed writes.
- [ ] **Step 6: Run `npm run test:mobile` and `npm --prefix mobile run typecheck`**; confirm a saved movement reloads from the API and transfers do not affect income or expense totals.
- [ ] **Step 7: Commit** as `feat: add Android finance operations`.

### Task 7: Add category and opening-balance management

**Files:**
- Create: `mobile/app/categories.tsx`
- Create: `mobile/app/balances.tsx`
- Create: `mobile/src/features/settings/requests.test.ts`
- Modify: `mobile/app/(tabs)/index.tsx`
- Modify: `mobile/src/api/client.ts`

**Interfaces:**
- Category management uses `PUT /api/categories` with the complete `Category[]` state; support add, rename, activate, and deactivate.
- Opening balances use `PUT /api/accounts/:key` with `{ openingBalance: number }` for `cash` and `bank`.

- [ ] **Step 1: Add request checks** for category add/rename/activation and both opening-balance account keys, using mocked `fetch`.
- [ ] **Step 2: Add the checks to `test:mobile`, run `npm run test:mobile`, and confirm the new checks fail.**
- [ ] **Step 3: Implement category and opening-balance screens** and add their entry points to the ledger.
- [ ] **Step 4: Run `npm run test:mobile` and `npm --prefix mobile run typecheck`**; confirm each screen sends the existing API payload and refreshes state after save.
- [ ] **Step 5: Commit** as `feat: add Android categories and balances`.

### Task 8: Package web, API, and PostgreSQL for the cloud VPS

**Files:**
- Create: `Dockerfile.api`
- Create: `Dockerfile.web`
- Create: `Caddyfile`
- Create: `compose.prod.yml`
- Create: `.env.production.example`
- Modify: `.gitignore`
- Modify: `server/index.ts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- `HOST` defaults to `127.0.0.1` for local runs; the API container listens on `0.0.0.0:3001` inside the private Compose network.
- `APP_DOMAIN` configures Caddy's host; Caddy routes `/api/*` to the API and serves the built Vite app for other paths.
- Production `DATABASE_URL` connects to Compose service `db` on port `5432`; local `DATABASE_URL` remains on `127.0.0.1:5432`.
- Production Compose publishes only Caddy ports 80 and 443; PostgreSQL and API have no host-published ports.
- `npm run api:start` runs the TypeScript API with `tsx`; include `tsx` in production dependencies and run migrations before starting the server.

- [ ] **Step 1: Add API and web Docker builds, production Compose services, Caddy routing, health checks, and a production environment example.** Keep secrets out of the example and Git; include migration and owner-provisioning scripts in the API image.
- [ ] **Step 2: Configure `HOST`, `api:start`, and production static routing** while preserving `npm run local` and the Vite development proxy. Set `api:start` to `tsx server/index.ts` and include `tsx` in production dependencies.
- [ ] **Step 3: Run `docker compose -f compose.prod.yml config`**; confirm only Caddy publishes ports 80 and 443 and neither API nor PostgreSQL has a `ports` entry.
- [ ] **Step 4: Run `npm run build` and `docker compose -f compose.prod.yml build`**; confirm the web and API images build successfully.
- [ ] **Step 5: Commit** as `feat: add cloud deployment stack`.

### Task 9: Add guarded cloud backup, restore, and migration commands

**Files:**
- Create: `scripts/backup-cloud.mjs`
- Create: `scripts/restore-cloud.mjs`
- Create: `scripts/migrate-cloud.mjs`
- Create: `scripts/verify-cloud.mjs`
- Create: `scripts/backup-cloud.test.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- `npm run backup:cloud` streams `pg_dump` from the VPS over SSH, encrypts locally with the existing AES-256-GCM format, and pushes only `backup/database.dump.enc` to the private GitHub repository.
- Cloud backups are owner-triggered, matching the current manual `npm run backup` workflow; no backup passphrase or GitHub credential is stored on the VPS.
- `npm run restore:cloud` decrypts locally, requires the exact confirmation `REEMPLAZAR PRODUCCION`, and streams the dump over SSH to PostgreSQL.
- `npm run migrate:cloud` creates and publishes a fresh encrypted local snapshot, then decrypts and streams that same snapshot over SSH to production after a separate migration confirmation.
- `npm run verify:cloud` compares category, account, movement counts, and calculated balances between source and destination before cutover.

- [ ] **Step 1: Add backup checks** for wrong passphrase, damaged backup header, missing SSH configuration, and absent production confirmation; assert no remote restore command runs in each rejected case.
- [ ] **Step 2: Add `test:scripts` as `node --test scripts/backup-cloud.test.mjs`, run `npm run test:scripts`, and confirm the new checks fail.**
- [ ] **Step 3: Refactor shared encryption and GitHub upload code** into `scripts/backup-common.mjs` without changing `npm run backup` or `npm run restore` behavior.
- [ ] **Step 4: Confirm OpenSSH is available with `Get-Command ssh`; implement cloud backup and restore using SSH streams.** Read SSH target from local environment or SSH config; never pass secrets in command-line arguments or logs.
- [ ] **Step 5: Implement one-time migration and source/destination verification.** Compare categories, account opening balances, movement counts, and balances computed through the latest source date.
- [ ] **Step 6: Run `npm run test:scripts`** and confirm all invalid inputs stop before remote data replacement; confirm valid operation keeps the existing encrypted file format.
- [ ] **Step 7: Commit** as `feat: add encrypted cloud database operations`.

### Task 10: Deploy the service and migrate the existing data

**Files:**
- Modify: `README.md`

**Interfaces:**
- Production deployment requires `APP_DOMAIN`, a selected VPS, SSH access, and production environment values supplied outside Git.
- Provision the owner with `npm run owner:create` in an interactive terminal; do not pass username or password as command-line arguments.

- [ ] **Step 1: Before provisioning, select the VPS provider and domain with the owner.** Keep cloud backups owner-triggered, matching the current workflow; retain encrypted snapshots through the private repository's commit history. Do not create a paid account or publish the service without the provider choice.
- [ ] **Step 2: Configure the domain, SSH access, and production environment values outside Git.**
- [ ] **Step 3: Deploy the production Compose stack.**
- [ ] **Step 4: Confirm Caddy serves the login page over HTTPS, the health route is available, and PostgreSQL has no public endpoint.**
- [ ] **Step 5: Provision the owner** with `docker compose -f compose.prod.yml exec api npm run owner:create` in an interactive SSH terminal; do not put credentials in command arguments.
- [ ] **Step 6: Run `npm run migrate:cloud` and `npm run verify:cloud`**; stop if categories, accounts, movement counts, or balances differ.
- [ ] **Step 7: Open `https://APP_DOMAIN`, sign in, and confirm one saved change.**
- [ ] **Step 8: Run `npm run backup:cloud` and confirm an encrypted cloud snapshot is committed to the private GitHub repository.** Do not run cloud restore without an explicit restore request.
- [ ] **Step 9: Commit runbook changes** as `docs: document cloud deployment and data migration`.

### Task 11: Build and install the private Android APK

**Files:**
- Modify: `.gitignore`
- Generate locally: `mobile/android/` via Expo prebuild.
- Modify locally: `mobile/android/app/build.gradle` to read the ignored signing properties file.
- Create locally, keep outside Git: `mobile/android/keystore.properties`.
- Generate locally and keep outside Git: Android signing keystore.
- Produce: signed private APK.

**Interfaces:**
- The mobile release uses `EXPO_PUBLIC_API_BASE_URL=https://<APP_DOMAIN>` and the verified production auth/API routes.
- Keep the signing keystore and passwords outside the repository.

- [ ] **Step 1: Run `java -version` and `adb version`; confirm the Android SDK path is configured** before generating the native Android project. Use local Gradle; do not add a cloud build service.
- [ ] **Step 2: Set `EXPO_PUBLIC_API_BASE_URL=https://APP_DOMAIN`, generate the Android project with `npx expo prebuild --platform android`, and configure release signing to read `keystore.properties`.** Store that file and the keystore outside Git.
- [ ] **Step 3: Build with `Push-Location mobile/android; .\gradlew.bat assembleRelease; Pop-Location` in PowerShell.** Confirm the signed APK exists under `mobile/android/app/build/outputs/apk/release/`.
- [ ] **Step 4: Install the APK on the owner's Android phone.** Confirm login and ledger reads/writes over mobile data; verify the same change appears on the web client.
- [ ] **Step 5: Commit only tracked build-configuration changes** as `feat: prepare private Android APK build`.

## Execution Order

Run Tasks 1–3 first to establish the authenticated API and web flow. Tasks 4–7 consume that API contract. Run Task 8 to package the service, then Task 9 for guarded data operations. Tasks 10 and 11 require the owner's selected VPS, domain, backup policy, and Android build prerequisites. Tasks 1–9 can be reviewed locally without a cloud account.

## References

- [React Native framework guidance](https://reactnative.dev/blog/2024/06/25/use-a-framework-to-build-react-native-apps)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo local Android production build](https://docs.expo.dev/guides/local-app-production/)
