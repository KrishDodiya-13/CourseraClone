# Lumen

A learning platform built in phases. This repository is currently at the end of
**Phase 1 — Application Foundation & Design System**.

What exists today is the scaffold and the design system every later feature is
built from. There is no authentication, no database schema, no catalogue, no
player and no commerce yet — those arrive in Phases 3 onward.

## Stack

| Layer      | Choice                                            |
| ---------- | ------------------------------------------------- |
| Framework  | Next.js 15 (App Router), React 19                 |
| Language   | TypeScript, `strict` + `noUncheckedIndexedAccess` |
| Styling    | Tailwind CSS v4 (CSS-first config)                |
| Primitives | Radix UI, shadcn-style owned components           |
| Icons      | Lucide                                            |
| Toasts     | Sonner                                            |
| Theming    | next-themes (light / dark / system)               |
| Testing    | Vitest + Testing Library                          |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your own values
npm run dev
```

Open <http://localhost:3000>. The component gallery is at `/design`.

## Scripts

| Command             | Does                       |
| ------------------- | -------------------------- |
| `npm run dev`       | Development server         |
| `npm run build`     | Production build           |
| `npm run start`     | Serve the production build |
| `npm run typecheck` | `tsc --noEmit`             |
| `npm run lint`      | ESLint                     |
| `npm run format`    | Prettier write             |
| `npm test`          | Vitest, single run         |

## Design system

Tokens live in [`src/styles/globals.css`](src/styles/globals.css) and are the
single source of truth for colour, type, spacing, radii and elevation.

- **Palette** — deep pine primary (growth, progress) with a warm apricot accent
  (achievement). Neutrals carry a slight green bias so they sit with the primary
  rather than fighting it; there are no pure greys.
- **Type** — Bricolage Grotesque for display, Plus Jakarta Sans for UI and body,
  JetBrains Mono for data and labels.
- **Themes** — every colour is defined as a token on `:root` and redefined under
  `.dark`. Nothing is hard-coded to one theme.

Components take a `className` prop merged through `cn()`, so any call site can
override styling without forking the component.

### Layout primitives

Use these instead of ad-hoc margin utilities — they are what keeps spacing
consistent across pages:

`Container`, `Section`, `Stack`, `Inline`, `Grid`, `PageHeader`
(see [`src/components/layout/primitives.tsx`](src/components/layout/primitives.tsx)).

### A note on animation

There is one motion primitive, `Reveal`, and it is implemented in CSS.
Framer Motion was trialled for it and removed: for a mount-only fade it cost
40–70 kB on the home route versus 3.3 kB for the CSS equivalent, with no visible
difference. Revisit a library in Phase 7, when drag-reordering the course
builder gives it something real to do.

## Local database

Phase 1 does not use a database. The Compose file is here ready for Phase 3:

```bash
# set POSTGRES_PASSWORD in .env.local first
docker compose up -d
```

It publishes on host port **5433** to avoid colliding with a PostgreSQL server
already running on 5432.

## Project structure

```
src/
├── app/                 routes, layouts, error and loading boundaries
│   └── design/          component gallery
├── components/
│   ├── ui/              primitives (Button, Input, Dialog, …)
│   ├── layout/          shell, providers, layout primitives
│   └── states/          Empty / Error / Loading, on one shared shell
├── lib/                 cn(), env validation
├── styles/              design tokens + global CSS
└── types/               ambient declarations
```

Business logic will live in `src/features/*` from Phase 5 onward; page files
stay thin.
