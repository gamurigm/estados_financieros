# React Native Android app and cloud deployment

**Date:** 2026-10-19

**Status:** Design approved in conversation; awaiting written-spec review.

## Goal

Let one owner use the finance ledger from an Android phone anywhere with internet access. Keep the current web app. Both clients must read and change the same data.

## Current system

- The web client uses Ionic React, React, and Vite.
- The API uses Express and PostgreSQL 17 in Docker Compose.
- The API listens on `127.0.0.1:3001` and has no authentication.
- PostgreSQL is published only on `127.0.0.1:5432`.
- `npm run backup` encrypts a PostgreSQL dump with AES-256-GCM and pushes it to the private GitHub repository. `npm run restore` restores that dump to the local database.

These local-only network bindings and unauthenticated API routes cannot serve a remote phone safely.

## Approved decisions

- Build a separate React Native app with Expo and TypeScript for Android. Deliver a private installable APK first; Play Store publication is out of scope.
- Preserve the current web client. Do not rewrite it in React Native.
- Host the API and PostgreSQL on a provider-neutral cloud VPS using Docker Compose. Use Caddy for HTTPS and routing. Keep PostgreSQL on the private Docker network. Public ports 80 and 443 support redirects and certificate issuance; restrict SSH to administration and backup operations.
- Add one owner account. Disable public registration and require authentication for every finance API route.
- Migrate the current local records to the cloud database once. After cutover, the cloud database is the shared source of truth; local databases remain for development only.
- Preserve encrypted backups in the private GitHub repository. Cloud dumps must be streamed over SSH to the owner's computer for encryption and upload, so the VPS does not need the backup passphrase or GitHub credentials. Cloud restore must require explicit confirmation.

## Components and data flow

```text
Android app (Expo) ── HTTPS ──┐
                              ├── Caddy ── Express API ── private PostgreSQL
Web client (Ionic React) ─ HTTPS┘
```

The Android app and web client use the same authenticated REST API. The API retains the existing movement, category, and account operations. The database port is never exposed publicly. Caddy terminates TLS and routes API requests; it also serves the built web client.

Authentication uses one provisioned owner identity with no public sign-up. Store passwords with Argon2id. Use secure, HTTP-only cookies for the web client and short-lived access credentials with refresh credentials stored in Android secure storage. Keep secrets out of Git and provide them through deployment environment configuration.

## Mobile scope

The first Android release supports the existing ledger's core operations:

- View monthly movements and account balances.
- Create, edit, and delete income and expense movements.
- Create and view cash-to-bank and bank-to-cash transfers.
- Manage categories and opening balances.
- Show clear connection and authentication errors.

Offline edits, multi-user access, iOS, push notifications, and Play Store publication are out of scope.

## Data migration and backup

1. Create an encrypted backup of the local PostgreSQL database.
2. Transfer it over SSH, decrypt locally, and pipe the dump to PostgreSQL on the VPS before client cutover. Do not open a public database port.
3. Compare categories, accounts, movement counts, and calculated balances against the local source.
4. Switch both clients to the cloud API only after the comparison succeeds.
5. Keep the existing local development database separate from production.

Retain the existing encrypted backup format and private-repository destination. Add cloud-specific backup and restore commands; do not make the current local restore command overwrite production. A cloud dump travels through SSH and is encrypted on the owner's computer before GitHub upload. Cloud restore must decrypt locally, transfer through SSH, and require a typed confirmation before replacing production data.

## Security and operation

- Require HTTPS for all client traffic. Expose port 80 only for HTTPS redirects and certificate issuance; expose port 443 for client traffic.
- Require authentication for every API route that reads or changes finance data.
- Keep PostgreSQL private; do not publish its port on the VPS.
- Restrict SSH administration and backup access to the owner.
- Do not commit passwords, tokens, private keys, or backup passphrases.
- Keep encrypted backups outside the VPS and document restoration steps.
- Show a useful error when the phone has no internet connection; do not claim an offline change was saved.

## Acceptance criteria

- The owner can install the private APK on an Android phone and sign in over mobile data or another internet connection.
- The Android app can read and change all in-scope finance data through HTTPS.
- A change made on Android appears in the web client, and a web change appears on Android.
- Anonymous requests cannot read or modify finance data; public registration is unavailable.
- The PostgreSQL service has no public network endpoint.
- The migrated cloud database matches the local source for categories, accounts, movement counts, and balances before cutover.
- An encrypted cloud backup can be restored through the guarded cloud-restore procedure.

## Decisions required before deployment

- Select the VPS provider and a domain name that points to it.
- Decide the backup cadence and retention period.
- Provision the owner login and production secrets outside Git.
- Choose the private APK build and delivery method.

These choices do not change the approved application architecture. No cloud account, paid service, domain, public deployment, or store release is authorized by this design alone.

## References

- [React Native: Use a framework to build React Native apps](https://reactnative.dev/blog/2024/06/25/use-a-framework-to-build-react-native-apps)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Caddy HTTPS quick-start](https://caddyserver.com/docs/quick-starts/https)
