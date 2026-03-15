# Mach-Zero Web App — React & Next.js Conventions

> Based on Vercel/Next.js official best practices (v16). This file governs all code in `apps/web/`.

---

## 1. Server vs Client Components

### Default to Server Components
- Pages and layouts are Server Components by default — keep them that way unless interactivity is needed.
- Fetch data (Prisma, QuestDB, fetch) directly in Server Components — never expose secrets to the client.
- Only add `"use client"` to the **smallest leaf component** that needs interactivity. Never mark an entire page as a Client Component when only one button needs state.

### Use Client Components only when you need:
- State (`useState`, `useReducer`)
- Event handlers (`onClick`, `onChange`)
- Effects (`useEffect`, `useLayoutEffect`)
- Browser APIs (`window`, `localStorage`, `navigator`)
- Custom hooks that use any of the above

### Composition pattern — interleave Server + Client
```tsx
// Server Component (page.tsx) — no "use client"
import { InteractiveWidget } from "@/components/ui/InteractiveWidget";

export default async function Page() {
  const data = await prisma.thing.findMany();
  return (
    <div>
      <h1>Static heading</h1>              {/* Server-rendered */}
      <InteractiveWidget items={data} />   {/* Client boundary */}
    </div>
  );
}
```

### Pass Server Components as children to Client Components
```tsx
// Client wrapper
'use client'
export function Modal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return open ? <div className="modal">{children}</div> : null;
}

// Server parent
import Modal from "./Modal";
import ServerContent from "./ServerContent"; // Server Component
export default function Page() {
  return <Modal><ServerContent /></Modal>;
}
```

---

## 2. Data Fetching

### Server Components — direct DB/API access
```tsx
// Preferred: fetch data in Server Components
export default async function DashboardPage() {
  const strategies = await prisma.strategyConfig.findMany();
  return <StrategyList strategies={strategies} />;
}
```

### Client Components — use SWR with polling
```tsx
'use client'
import useSWR from 'swr';
const fetcher = (url: string) => fetch(url).then(r => r.json());

export function LiveData() {
  const { data, error, isLoading } = useSWR('/api/trades', fetcher, {
    refreshInterval: 5000,
  });
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  return <TradeTable data={data} />;
}
```

### Parallel data fetching — use Promise.all
```tsx
// BAD — sequential (slow)
const strategies = await fetch('/api/strategies').then(r => r.json());
const pools = await fetch('/api/capital').then(r => r.json());

// GOOD — parallel (fast)
const [strategies, pools] = await Promise.all([
  fetch('/api/strategies').then(r => r.json()),
  fetch('/api/capital').then(r => r.json()),
]);
```

### Deduplicate with React.cache for Server Components
```tsx
import { cache } from 'react';
export const getTenant = cache(async (id: string) => {
  return prisma.tenant.findUnique({ where: { id } });
});
```

---

## 3. Error Handling

### Expected errors — return values, NOT thrown exceptions
```tsx
// In API routes / Server Actions
if (!res.ok) {
  return { error: "Failed to create strategy" };  // Return error state
}
// DON'T: throw new Error("Failed to create strategy");
```

### Add error.tsx to every route segment
```tsx
// app/dashboard/error.tsx
'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-900/20 p-6">
      <h2 className="text-red-400 font-semibold">Something went wrong</h2>
      <p className="text-sm text-zinc-400 mt-2">{error.message}</p>
      <button onClick={reset} className="mt-4 rounded-md bg-accent px-4 py-2 text-sm text-white">
        Try again
      </button>
    </div>
  );
}
```

### Add global-error.tsx at app root
```tsx
// app/global-error.tsx
'use client'
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html><body>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </body></html>
  );
}
```

### Add loading.tsx for streaming/skeleton states
```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return <div className="animate-pulse space-y-4">
    <div className="h-8 w-48 rounded bg-zinc-800" />
    <div className="grid grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 rounded-lg bg-zinc-800" />
      ))}
    </div>
  </div>;
}
```

### Client-side error handling in event handlers
```tsx
// Error boundaries DON'T catch event handler errors.
// Handle manually with try/catch + state:
const [error, setError] = useState<string | null>(null);

const handleAction = async () => {
  try {
    await fetch('/api/something', { method: 'POST' });
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unknown error');
  }
};
```

---

## 4. Component Patterns

### File naming
- Components: `PascalCase.tsx` (e.g., `StrategyCard.tsx`)
- Hooks: `camelCase.ts` prefixed with `use` (e.g., `usePositions.ts`)
- Utilities: `camelCase.ts` (e.g., `utils.ts`)
- API routes: `route.ts` (Next.js convention)
- Types: co-locate in `types/index.ts` for shared types

### Props interface — always typed, named `Props`
```tsx
interface Props {
  strategy: StrategyConfig;
  onEdit: (strategy: StrategyConfig) => void;
}

export function StrategyCard({ strategy, onEdit }: Props) { ... }
```

### Named exports for components (not default)
```tsx
// GOOD
export function StrategyCard({ ... }: Props) { ... }

// AVOID (except for pages — Next.js requires default export for page.tsx)
export default function StrategyCard({ ... }: Props) { ... }
```

### Style constants co-located with component
```tsx
const STATUS_STYLES: Record<StrategyStatus, { bg: string; text: string; label: string }> = {
  RUNNING: { bg: "bg-green-900/30", text: "text-green-400", label: "Running" },
  PAUSED:  { bg: "bg-yellow-900/30", text: "text-yellow-400", label: "Paused" },
  // ...
};
```

### Use `cn()` utility for conditional classes (not ternaries in className)
```tsx
// GOOD
<div className={cn("rounded-lg p-4", isActive && "border-accent", size === "lg" ? "text-xl" : "text-sm")} />

// AVOID
<div className={`rounded-lg p-4 ${isActive ? 'border-accent' : ''}`} />
```

---

## 5. Context & State Management

### Context providers — render as deep as possible
```tsx
// GOOD — provider wraps only the subtree that needs it
<html><body>
  <TradingModeProvider>{children}</TradingModeProvider>
</body></html>

// AVOID — wrapping the entire <html> element
<TradingModeProvider>
  <html><body>{children}</body></html>
</TradingModeProvider>
```

### Custom hooks for context access
```tsx
// Always provide a custom hook with error guard
export function useTradingMode() {
  const ctx = useContext(TradingModeContext);
  if (!ctx) throw new Error("useTradingMode must be used within TradingModeProvider");
  return ctx;
}
```

### Prefer SWR/polling over manual setInterval for server data
```tsx
// GOOD — SWR handles dedup, focus revalidation, error retry
const { data } = useSWR('/api/strategies', fetcher, { refreshInterval: 5000 });

// AVOID — manual polling with useEffect + setInterval
useEffect(() => {
  const id = setInterval(() => fetch('/api/strategies'), 5000);
  return () => clearInterval(id);
}, []);
```

---

## 6. Forms & Mutations

### Use Server Actions for form submissions
```tsx
// app/actions.ts
'use server'
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  type: z.string(),
});

export async function createStrategy(prevState: any, formData: FormData) {
  const validated = schema.safeParse(Object.fromEntries(formData));
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }
  await prisma.strategyConfig.create({ data: validated.data });
  revalidatePath('/strategies');
}
```

### Use `useActionState` for form state + pending
```tsx
'use client'
import { useActionState } from 'react';
import { createStrategy } from '@/app/actions';

export function CreateForm() {
  const [state, formAction, pending] = useActionState(createStrategy, { errors: {} });
  return (
    <form action={formAction}>
      <input name="name" />
      {state.errors?.name && <p className="text-red-400 text-xs">{state.errors.name}</p>}
      <button disabled={pending}>{pending ? 'Creating...' : 'Create'}</button>
    </form>
  );
}
```

### Validate on both client (HTML attrs) AND server (Zod)
```tsx
<input name="email" type="email" required />  {/* Client-side */}
// + Zod validation in Server Action           {/* Server-side */}
```

---

## 7. Project Structure

```
apps/web/
├── app/                    # Next.js App Router
│   ├── (routes)/           # Route groups for organization
│   │   ├── dashboard/
│   │   │   ├── page.tsx    # Server Component (default)
│   │   │   ├── loading.tsx # Streaming skeleton
│   │   │   └── error.tsx   # Error boundary
│   │   └── strategies/
│   ├── api/                # API routes (route.ts)
│   ├── layout.tsx          # Root layout (Server Component)
│   ├── global-error.tsx    # Global error boundary
│   └── globals.css         # Tailwind + CSS variables
├── components/
│   ├── ui/                 # Primitive/shared components (Button, Input, Modal, Badge)
│   ├── layout/             # App shell (Header, Sidebar, Navigation)
│   ├── dashboard/          # Dashboard-specific components
│   ├── strategies/         # Strategy-specific components
│   └── trades/             # Trade-specific components
├── hooks/                  # Custom React hooks (usePositions, useTrades, etc.)
├── contexts/               # React Context providers
├── lib/                    # Utilities, DB client, helpers
│   ├── db.ts               # Prisma singleton (server-only)
│   ├── utils.ts            # Shared utilities (cn, formatPrice, etc.)
│   └── questdb.ts          # QuestDB query helper (server-only)
├── types/                  # TypeScript type definitions
│   └── index.ts            # All shared types
├── actions/                # Server Actions (form mutations)
└── prisma/                 # Database schema + seed
```

### Key rules:
- **`lib/db.ts`** and **`lib/questdb.ts`** are server-only — never import in Client Components
- **`components/ui/`** — generic, reusable primitives (no business logic)
- **`components/{feature}/`** — feature-specific components with business logic
- **Colocate** tests, stories, and utils next to their component when possible

---

## 8. Styling

### Tailwind CSS 4 with CSS custom properties
- All colors defined as CSS variables in `globals.css`
- Dark mode only (`<html className="dark">`)
- Use semantic tokens: `bg-card`, `border-border`, `text-accent`

### Color semantics for trading:
| Context           | Color          | Usage                    |
|-------------------|----------------|--------------------------|
| Positive P&L      | `text-green-400` | Profits, positive values |
| Negative P&L      | `text-red-400`   | Losses, negative values  |
| Neutral            | `text-zinc-500`  | Zero values, labels      |
| Accent / Primary   | `text-accent`    | Links, active states     |
| MOCK mode          | `text-blue-400`  | Paper trading indicators |
| LIVE mode          | `text-red-400`   | Live trading indicators  |
| Risk warnings      | `text-orange-400` | Risk limit badges       |

### Responsive: mobile-first breakpoints
```tsx
<div className="grid grid-cols-1 gap-4 lg:grid-cols-2" />
```

---

## 9. API Routes

### Standard response shape
```tsx
// Success
return NextResponse.json(data);
return NextResponse.json(data, { status: 201 });

// Error
return NextResponse.json(
  { error: "Human-readable message", detail: String(error) },
  { status: 400 }
);
```

### Always validate request body
```tsx
const body = await request.json();
const { id, status } = body;
if (!id) {
  return NextResponse.json({ error: "id is required" }, { status: 400 });
}
```

### Use transactions for multi-step mutations
```tsx
await prisma.$transaction([
  prisma.capitalAllocation.delete({ where: { strategyId: id } }),
  prisma.strategyConfig.delete({ where: { id } }),
]);
```

---

## 10. Performance

### Minimize client bundle — push `"use client"` to leaves
```tsx
// Layout stays a Server Component
export default function Layout({ children }) {
  return (
    <nav>
      <Logo />          {/* Server Component — no JS shipped */}
      <SearchBar />     {/* Client Component — only this ships JS */}
    </nav>
  );
}
```

### Use `loading.tsx` for route-level streaming
Every data-fetching route should have a `loading.tsx` with meaningful skeletons.

### Use `<Suspense>` for component-level streaming
```tsx
import { Suspense } from 'react';
<Suspense fallback={<TableSkeleton />}>
  <TradeTable />
</Suspense>
```

### Avoid waterfalls — fetch in parallel
```tsx
// In Server Components, start fetches before awaiting
const strategiesPromise = getStrategies();
const poolsPromise = getPools();
const [strategies, pools] = await Promise.all([strategiesPromise, poolsPromise]);
```

---

## 11. Security

### Environment variables
- Server-only secrets: `DATABASE_URL`, `NEXTAUTH_SECRET` — no `NEXT_PUBLIC_` prefix
- Client-safe values: `NEXT_PUBLIC_BRIDGE_WS_URL` — prefixed with `NEXT_PUBLIC_`
- Never import `lib/db.ts` or `lib/questdb.ts` in Client Components

### Use `server-only` package for server modules
```tsx
// lib/db.ts
import 'server-only';
import { PrismaClient } from '@prisma/client';
```

### API route safety
- Always validate input (required fields, types, enums)
- Check valid state transitions before mutating
- Use HTTP 428 for confirmation-required actions (LIVE mode gates)
- Strip sensitive fields from generic update endpoints

---

## 12. TypeScript

### Strict mode enabled — no `any` escape hatches
- `strict: true` in `tsconfig.json`
- Use `unknown` instead of `any` for dynamic data
- Prefer `Record<string, unknown>` over `Record<string, any>`

### Shared types in `types/index.ts`
- All types that cross component/API boundaries go in `types/index.ts`
- Component-local types (like `Props`) stay in the component file
- Prisma types come from the generated client — don't duplicate

### Use discriminated unions for status/mode types
```tsx
type StrategyStatus = "RUNNING" | "PAUSED" | "STOPPED" | "PENDING";
type TradingMode = "MOCK" | "LIVE";
```
