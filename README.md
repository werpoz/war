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

Use `api.http` (VSCode REST client) as a quick reference. Core endpoints:

- `POST /sessions` – body: `{ "sessionId": "session01", "phone": "519..." }`
  - Boots a socket, persists auth creds, and resolves with the QR/pairing code.
- `DELETE /sessions/:id` – closes a session and cleans in-memory state.

Events emitted through `EventEmitter2`:

- `session.qr` – QR or pairing code updates.
- `session.status` – connection status (`connecting`, `open`, `close`).
- `session.message` – inbound messages (raw Baileys payload).
- `session.closed` – socket disconnected and removed.
- `session.removed` – device revoked access (HTTP 401 from WhatsApp).

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
     - On device removal (`401`) calls `logout` and emits `session.removed`

### Logging

- All Baileys logs are routed through Nest `Logger`.
- Enable verbose logging with `BAILEYS_DEBUG=true`.
- Switch to structured JSON logs with `LOG_FORMAT=json`.

Example log entry:

```sh
[BaileysSessionProvider] LOG: connection open | meta={ sessionId: 'session01' }
```

### Storage

Baileys credentials are persisted under `./storage/sessions/<sessionId>`. Ensure the directory is writable in your environment.

### Troubleshooting

- **`restart required (515)`**: The listener auto-restarts the socket. Check logs for `Restart required; recreating socket`.
- **Device removed / 401**: The session is logged out and `session.removed` is emitted; you must initiate a fresh pairing.
- **Max listeners warning**: The listener guards against duplicate bindings; if you still see warnings, verify that `listen()` is not called repeatedly for the same session without awaiting completion.
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
