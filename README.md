# WhatsApp Session Service

Backend service that manages WhatsApp multidevice sessions using NestJS and the Baileys library. It exposes HTTP endpoints to start sessions, persists authentication credentials on disk, and relays real-time socket events via an internal event bus.

## Architecture Overview

- `src/context/whatsapp/connection` groups the WhatsApp bounded context.
  - `conn.module.ts` wires repositories, providers, listeners, and use-cases.
  - `application/use-case/start-session.uc.ts` orchestrates session start.
  - `infrastructure/providers/baileys` contains socket/session management.
  - `infrastructure/http/controllers/sessions.controller.ts` exposes REST APIs.
- `EventEmitter2` (via `@nestjs/event-emitter`) broadcasts session status, QR codes, and inbound messages.
- `BaileysLoggerAdapter` funnels Baileys logs into Nest's logging system with optional JSON output.

### Environment Variables

| Variable          | Description                                                 | Default |
| ----------------- | ----------------------------------------------------------- | ------- |
| `PORT`            | HTTP port for NestJS                                        | `3000`  |
| `LOG_FORMAT`      | Set to `json` for structured logs                           | plain   |
| `BAILEYS_DEBUG`   | `true/1/on` to emit verbose Baileys logs                    | `false` |
| `STORAGE_ROOT`    | Base path for Baileys auth files (defaults to `./storage`)  | `./storage` |

`ConfigModule.forRoot({ isGlobal: true })` loads variables from `.env`. Update `.env` and restart the app to change behaviour.

### Running Locally

```bash
pnpm install          # install dependencies
pnpm run start:dev    # start Nest in watch mode
```

Type-check only:

```bash
pnpm exec tsc --noEmit --incremental false
```

### HTTP API

### Exposed API

REST endpoints (see `api.http` for samples):

- `PUT /sessions/:id`

  ```json
  { "provider": "baileys", "phone": "519..." }
  ```

  Boots or ensures a socket, persists auth credentials, and returns a QR/pairing code when available (`status: "starting"`). The body is optional; defaults are `provider="baileys"` and `storage="file"` when omitted.
- `DELETE /sessions/:id`
  Closes the session, detaches listeners, and keeps credentials available for a future reconnect (`status: "closed"`).
- `DELETE /sessions/:id/storage`
  Logs out the device, purges persisted credentials, and marks the session as removed (`status: "removed"`).

Real-time events (via `EventEmitter2`; expose through WebSocket/SSE as needed):

- `session.qr` – QR or pairing code updates.
- `session.status` – connection status (`connecting`, `open`, `close`).
- `session.message` – inbound messages (raw Baileys payload).
- `session.closed` – socket disconnected.
- `session.removed` – device revoked access (HTTP 401); credentials purged.

### Session Lifecycle

1. `startSession` requests credentials from `AuthStorageFactory` (currently file-based).
2. `BaileysSessionProvider` creates a socket with the saved state, storing:
   - WebSocket instance
   - `saveCreds` callback to persist updates
   - Last emitted QR and status
3. `SessionSocketListener` binds Baileys events:
   - Persists credential changes (`creds.update`)
   - Emits messages (`messages.upsert`)
   - Handles connection updates:
     - Emits status/QR events
     - Requests pairing code when the user supplies a phone number
     - On `restartRequired (515)` automatically recreates the socket
     - On device removal (`401`) logs out, wipes persisted credentials, and emits `session.removed`

Session states tracked in the repository:

- `starting` – command issued and awaiting connection
- `ready` – Baileys reported the socket as open
- `closed` – session closed but credentials retained
- `removed` – device logged out and credentials deleted

### Logging

- All Baileys logs route through Nest's `Logger` via `BaileysLoggerAdapter`.
- Enable verbose logging with `BAILEYS_DEBUG=true`.
- Switch to structured JSON with `LOG_FORMAT=json`.
- Example:

  ```text
  [BaileysSessionProvider] LOG: connection open | meta={ sessionId: 'session01' }
  ```

### Storage

- Credentials persist under `./storage/sessions/<sessionId>`.
- On logout/device removal the directory is deleted (via `FileAuthAdapter.clear`).
- Ensure the directory (and parent) is writable.

### Troubleshooting

- **`restart required (515)`**: The listener auto-restarts the socket. Check logs for `Restart required; recreating socket`.
- **Device removed / 401**: The session is logged out, credentials are purged from `./storage`, and `session.removed` is emitted; you must initiate a fresh pairing.
- **Max listeners warning**: `SessionSocketListener` prevents duplicate bindings; ensure you await `listen()` and avoid concurrent calls per session.
- **Auth folder permissions**: Make sure the process can read/write `./storage`.

### Testing

There are currently no automated tests tailored to the WhatsApp flow. Consider adding integration tests for:

- Session start with mocked Baileys socket
- QR propagation
- Restart flow and logout behaviour

Run the existing Nest test commands when you add coverage:

```bash
pnpm run test
pnpm run test:e2e
pnpm run test:cov
```
