# Frontend

React/Vite frontend for Helmet Detection Project. The main setup, backend configuration, camera, demo, and testing documentation is in `../../README.md`.

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

By default, the frontend calls the backend at:

```env
VITE_API_BASE_URL=http://localhost:8000
```

If the backend runs on another host or port, update `VITE_API_BASE_URL` in `SourceCode/FE/.env`.

## Checks

```powershell
npm.cmd run lint
npm.cmd run build
```

## Notes

- `dist/` is build output and should not be edited manually.
- `node_modules/` should not be committed.
- Business routes require a logged-in and email-verified user; admin-only routes include User Management, Camera Management, and Audit Logs.
