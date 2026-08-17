# Developer Daily Report API

Backend-first API for generating manual daily reports from read-only Git provider activity.

## Requirements

- Node.js 24+
- PostgreSQL (database integration is added in the next foundation step)

## Setup

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

The health endpoint is available at `GET /api/v1/health`, and Swagger UI is served at
`http://localhost:3000/docs`.

## Quality checks

```powershell
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

API for daily report project
