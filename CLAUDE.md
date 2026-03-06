# GoyCattleHerder CRM — Claude Collaboration Guide

## Project Overview

A full-stack CRM for solar/construction project management, commission tracking, permit management, lead conversion, and team collaboration.

**Live URL:** https://apex-crm-chi.vercel.app
**Deployment:** Vercel CLI (`npx vercel --prod` from project root). No Git-based auto-deploy — must be triggered manually.

## Tech Stack

- **Framework:** Next.js 14.1.0 (App Router), React 18, TypeScript
- **Styling:** Tailwind CSS 3.4.17 + CSS custom properties design system in `globals.css`
- **Database/Auth:** Supabase (Postgres + Auth + Realtime)
- **Charts:** Recharts
- **Icons:** lucide-react
- **Fonts:** Inter (body + display), JetBrains Mono (monospace) — loaded via `next/font/google`

## Project Structure

```
app/
├── layout.tsx              # Root layout (fonts, AuthProvider, ToastProvider, ThemeToggle)
├── page.tsx                # Main dashboard (~1050 lines, all tabs rendered here)
├── globals.css             # Design system: CSS vars, glass cards, KPI glows, animations
├── login/page.tsx          # Auth (sign in, sign up with join code, password reset)
├── pending-approval/page.tsx
├── components/
│   ├── AuthProvider.tsx    # Auth context (session, profile, role, org)
│   ├── Sidebar.tsx         # Collapsible sidebar nav (desktop), localStorage-persisted
│   ├── MobileNav.tsx       # Bottom tab bar (mobile)
│   ├── ActiveSessions.tsx  # Session management UI (Settings tab)
│   ├── DashboardCharts.tsx # Recharts pie/bar charts
│   ├── KanbanBoard.tsx     # Drag-and-drop pipeline
│   ├── ProjectDetailPanel.tsx
│   ├── SettingsPanel.tsx   # CRM config (manager+ only)
│   ├── Toast.tsx           # Toast notification system
│   ├── ThemeToggle.tsx     # Dark/light mode
│   └── ... (15+ more components)
├── api/
│   ├── auth/sessions/route.ts  # Session tracking (service role key, bypasses RLS)
│   ├── auth/auto-confirm/      # IP-based auto-confirm on signup
│   ├── report/                 # PDF report generation
│   ├── solar/                  # Google Solar API proxy
│   └── ...
lib/
├── projectService.ts       # Supabase browser client + all CRUD operations
├── authService.ts          # Auth helpers (signIn, signUp, registerSession, etc.)
├── roles.ts                # RBAC: Role type, TAB_ACCESS, PERMISSIONS
├── statusConfig.ts         # Centralized status labels/colors/classes
└── leadService.ts          # Lead CRUD + conversion
supabase/migrations/        # SQL migrations (run via Supabase Management API)
```

## Key Architecture Decisions

### Authentication & RBAC
- Roles: `superadmin > admin > manager > sales_rep` (numeric levels 4/3/2/1 in `lib/roles.ts`)
- `TAB_ACCESS` controls which tabs each role can see
- `PERMISSIONS` object controls granular actions (delete, bulk ops, approvals, etc.)
- RLS enforced at DB level; API routes use service role key to bypass when needed
- Session tracking: `user_sessions` table, registered on login, viewable in Settings > Active Sessions

### Design System
- Dark theme with glassmorphism (`glass-card`, `glass-card-elevated`)
- CSS custom properties for all colors, surfaces, shadows, transitions
- Light mode via `.light-mode` class with CSS variable overrides
- KPI glow cards with color variants (green/purple/blue/amber)
- Accent color: `#06d6a0` (teal), secondary: `#00b4d8` (ocean), tertiary: `#8b5cf6` (violet)
- Font variables must point directly at Next.js font vars (`--font-inter`), NOT through intermediate vars (nested `var()` breaks font resolution)

### Layout
- Sidebar navigation (collapsible, desktop) + bottom nav (mobile)
- `page.tsx` renders all tab content conditionally based on `activeTab` state
- Tab transitions via `tab-content-enter` CSS class with `key={activeTab}`

## Environment Variables (required in `.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ACCESS_TOKEN=          # For Management API (migrations)
GOOGLE_SOLAR_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_KEY=
AUTO_CONFIRM_IPS=               # Comma-separated IPs for auto-approval
```

The `.env.local` file is gitignored. Ask the project owner for credentials.

## Database

Supabase project ref: `ojmuepmgaepvskyuawgs`

Key tables: `profiles`, `projects`, `commissions`, `permits`, `leads`, `contacts`, `activity_log`, `project_notes`, `organizations`, `settings`, `user_sessions`, `communications`

Migrations are in `supabase/migrations/` and can be run via the Supabase Management API:
```bash
curl -X POST "https://api.supabase.com/v1/projects/<ref>/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "<SQL>"}'
```

## Commit Convention

**This repo is maintained by multiple Claude Code instances.** To keep each other in sync:

1. **Always write detailed commit messages.** Include:
   - What changed and why
   - Files modified with brief description of each change
   - Any database migrations that need to be run
   - Any new environment variables required
   - Breaking changes or things the next developer needs to know

2. **Always pull before starting work:** `git pull origin main`

3. **Format:**
   ```
   <type>: <short summary>

   <detailed description of all changes>

   Files changed:
   - path/to/file.tsx — description of change
   - path/to/file.ts — description of change

   DB migrations: (if any)
   - migration_name.sql — description

   Co-Authored-By: Claude <model> <noreply@anthropic.com>
   ```

   Types: `feat`, `fix`, `refactor`, `style`, `chore`, `docs`

4. **Never force-push to main.**

5. **After deploying**, note the deployment in the commit or a follow-up message.

## Getting Started (for a new Claude instance)

1. Read this file first
2. Check `lib/roles.ts` for the RBAC system
3. Check `app/page.tsx` for the main dashboard structure (it's large — ~1050 lines)
4. Check `app/globals.css` for the design system
5. Ask the user for `.env.local` credentials
6. Run `npm install` then `npm run dev` (or `npx vercel dev` if Vercel CLI is configured)
7. `git pull origin main` before every session to get the latest changes
