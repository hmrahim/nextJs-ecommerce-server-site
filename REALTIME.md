# Realtime (Socket.IO) Integration

## What changed

### Backend (`backend/`)
- **New dep**: `socket.io`
- **`src/utils/socket.js`** — Socket.IO server with JWT auth, admins join the `admins` room, exposes `emitChange(resource, action, payload)`.
- **`src/utils/realtimePlugin.js`** — Mongoose plugin that auto-emits realtime events on `save`, `insertMany`, `findOneAndUpdate`, `updateOne/Many`, `findOneAndDelete`, `deleteOne/Many`, etc. — for **every model**.
- **`src/config/database.js`** — registers the plugin globally **before** any model loads (`mongoose.plugin(realtimePlugin)`).
- **`src/server.js`** — wraps `app` in `http.createServer` and calls `initSocket(server)`.

No controller/route code had to change. Any create/update/delete on any model now broadcasts:
```
event: "resource:change"
data:  { resource: "Product", action: "create" | "update" | "delete", id, at }
```
plus narrower events: `Product:create`, `Product:change`, etc.

### Frontend (`frontend/`)
- **New dep**: `socket.io-client`
- **`src/lib/socket.js`** — singleton client, attaches the next-auth JWT.
- **`src/hooks/useRealtimeSync.js`** — listens for `resource:change` and invalidates every react-query whose key includes the matching resource fragment.
- **`src/app/(admin)/_components/AdminLayoutClient.jsx`** — mounts `useRealtimeSync()` once for the entire admin dashboard.

Result: every admin page that uses `useQuery` auto-refreshes on backend CRUD — no per-page wiring needed.

## Env vars
- Backend: existing `CLIENT_ORIGIN`, `JWT_SECRET` (already used). No new vars.
- Frontend (optional): `NEXT_PUBLIC_SOCKET_URL`. Defaults to `NEXT_PUBLIC_API_URL` (stripping trailing `/api`).

## Install
```bash
cd backend  && npm install
cd frontend && npm install
```

## Adding a new resource mapping
If a new model uses query keys that don't match its lowercase name, add an entry to `RESOURCE_MAP` in `src/hooks/useRealtimeSync.js`.
