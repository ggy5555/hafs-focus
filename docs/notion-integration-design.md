# Notion integration — architecture and security design (NOT DEPLOYED)

**Status:** design only. No OAuth credentials, network sync, Notion API calls, accounts, secrets, or backend service are implemented by this branch. The user explicitly requires separate approval before any deployment or real connection.

## Scope

- Students manage their subjects locally in HAFS Focus.
- After a future opt-in authorization, an authenticated student may choose a Notion data source (database-backed) to mirror their subject catalog.
- One-way source of truth at initial launch: **HAFS Focus -> Notion**.
- Subject create, rename, archive and restore are mirrored. No Notion deletion on an archive.
- Timer data, school schedules, tasks and student identity are **out of sync scope** unless separately approved.
- Notion is optional. All study features continue to work offline if Notion is unavailable.

## Why GitHub Pages alone is insufficient

GitHub Pages serves public static files. A public Notion OAuth connection requires confidential client credentials and token exchange. Secrets cannot be embedded in HTML, JavaScript, localStorage, a manifest, GitHub Actions logs or a public GitHub repository. A minimal HTTPS server-side component is therefore needed. No such server will be deployed by this task.

## Proposed deployment layout (future, subject to approval)

```text
GitHub Pages /hafs-focus/   (existing, public static assets)
          |
          | explicit opt-in after authorization
          v
HTTPS sync API (new, NOT provisioned)
  /api/auth/notion/start
  /api/auth/notion/callback
  /api/auth/notion/status
  /api/auth/notion/disconnect
  /api/sync/subjects
          |
          +-- encrypted credentials storage (per authorized student)
          +-- session / OAuth state / rate-limit store
          +-- subject-ID to Notion page-ID map
          |
          v
Notion REST API (access only to user-authorized workspace resources)
```

Implement the HTTPS API and its private secrets storage in an approved service only after separate deployment approval. Choose hosting and user identity policy during that review; this document is not an authorization to create infrastructure.

## OAuth 2.0 security flow

1. Student clicks `Connect Notion` and sees a clear consent/scope explanation.
2. Backend establishes an authenticated app session (identity and multi-device model **must** be decided before release), generates a cryptographically random one-time `state`, binds it to that session, and stores it server-side with short expiration.
3. Redirect to the **Notion public connection** authorization URL with exact registered callback URI. The student approves the requested pages/workspace resources.
4. Backend callback validates `state`, expiry and single use; validates expected redirect and handles denial. Exchange the returned `code` **only on the server**, using confidential client credentials as required by the Notion OAuth spec.
5. Server securely stores the returned access/refresh tokens, installation/workspace/owner IDs and expiry metadata, never exposing credentials to JavaScript.
6. Frontend receives only a connection status and an app-session reference. The student chooses the target data source they authorized.
7. Disconnect revokes/invalidates the local connection and removes stored secrets according to the current Notion revocation behavior; report partial failure truthfully.

**Important:** Notion authorization is not a substitute for a complete student identity, device linking or cross-device account recovery scheme. Do not expose a public sync endpoint that accepts an arbitrary workspace ID or localStorage-supplied owner ID as proof of authorization. Cross-site cookies and CORS across `github.io` and a separate API domain require special design; avoid long-lived bearer tokens in browser storage. Deploy only once CSRF/session protection and browser compatibility are tested.

## Minimal API contract (draft, not implemented)

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/auth/notion/start` | Initiate state-bound OAuth |
| `GET` | `/api/auth/notion/callback` | Validate state and exchange code |
| `GET` | `/api/auth/notion/status` | Authenticated connection and target availability |
| `POST` | `/api/auth/notion/disconnect` | Disconnect and discard stored tokens |
| `PUT` | `/api/sync/subjects` | Idempotent batch of create/update/archive operations |

The API must validate authenticated identity, accepted `Origin`, CSRF protection, request body sizes, content type, subject ID, name length and operation list. Only an allowlisted frontend origin should be accepted; `Access-Control-Allow-Origin: *` is forbidden for credentialed requests.

## Notion data source schema (draft)

A student selects or authorizes creation of a dedicated `HAFS Focus Subjects` data source.

| Property | Notion type | Meaning |
| --- | --- | --- |
| `Name` | title | Editable visible subject name |
| `HAFS Subject ID` | rich_text | Stable per-student app subject ID |
| `Archived` | checkbox | Hidden/archived in app (not deleted) |
| `Updated At` | date | Last successful push timestamp |

Each server-side installation maps `(student identity, subjectId)` to a Notion page ID. Never use a display name as a key: renames must update the existing page.

Notion API currently distinguishes databases and data sources. Validate the versioned endpoints and page-parent behavior before implementing. Pin the `Notion-Version` HTTP header (the reference currently lists `2026-03-11`), with tested upgrades rather than implicit latest behavior.

## Synchronization rules

- Local data is saved immediately, independent of network status.
- On successful opt-in only, enqueue subject mutations with revision and idempotency keys. Queue handling must not block timer operations.
- One-way sync: no automatic writes from Notion back to local data, to avoid conflicting edits.
- Upsert: look up mapped page ID, create if absent, update only if necessary.
- Rename updates `Name`; archive sets `Archived=true`; restore clears it; never hard-delete Notion pages automatically.
- Retry transient 429/5xx errors with bounded exponential backoff, honoring `Retry-After`. Show `Pending`, `Synced`, `Failed` states in a future UI; never claim sync before acknowledgment.
- If access is revoked or a data source is inaccessible, stop syncing and preserve the local queue; prompt for reconnection without silent writes elsewhere.
- Support idempotent retries and handle eventual partial batch success using a per-subject acknowledgment ledger.
- Offline changes remain on-device; different browsers will not automatically share study records just because Notion is connected.

## Security and privacy acceptance checklist

- No Notion client secret or tokens in the public repo, browser storage or backups.
- HTTPS only; short-lived, non-reusable state; secure session binding and CSRF defense.
- Encrypt tokens at rest using managed key material and restrict backend access.
- Isolate every student's installation, subject-page mappings, sync queue and data source.
- Least-privilege Notion capabilities; only user-authorized content.
- No student names, grades, timetables, study durations or tasks in sync requests for the subject-only launch.
- Minimal audit logs with secrets, codes, student data and raw OAuth responses redacted.
- Rate limiting and retry protection, including 429 handling.
- Disconnect, revoke, retention, incident response and account/data deletion policies specified before release.
- Consent and clear disclosure that Notion is an optional external processor.
- Cross-browser authentication test, including third-party cookie restrictions and multi-device identity behavior.
- Threat-model review before introducing a real API endpoint.

## Approval gates

1. **Approved now:** redesign + local subject catalog + this architecture document.
2. **Not approved yet:** external API deployment, creating Notion developer connection, adding private storage, OAuth testing on real student workspaces, importing or writing Notion pages, or live syncing.
3. Before live implementation, confirm target Notion data source, student sign-in model, hosting provider and consent/privacy wording.

## Primary documentation

- https://developers.notion.com/guides/get-started/authorization
- https://developers.notion.com/reference/intro
- https://developers.notion.com/reference/request-limits
- https://developers.notion.com/guides/get-started/token-security
