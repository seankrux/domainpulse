# Design System: DomainPulse Marketing Site

## 1. Visual Theme & Atmosphere
A dark, clinical monitoring dashboard aesthetic with confident asymmetric layouts and fluid spring-physics motion. The atmosphere is **precision-instrument minimal** — like a well-lit server room at night. High contrast between zinc-black surfaces and emerald signal accents communicates reliability and real-time awareness. Density 5, variance 6, motion 6.

## 2. Color Palette & Roles
- **Canvas Black** (#09090B) — Primary background surface, Zinc-950
- **Surface Raised** (#18181B) — Cards, containers, elevated panels, Zinc-900
- **Surface Mid** (#27272A) — Borders, subtle dividers, Zinc-800
- **Surface High** (#3F3F46) — Strong borders, hover states, Zinc-700
- **Pure White** (#FFFFFF) — Primary text
- **Muted Silver** (#A1A1AA) — Secondary text, descriptions, metadata, Zinc-400
- **Subdued** (#71717A) — Tertiary text, timestamps, Zinc-500
- **Signal Green** (#10B981) — Single accent for CTAs, active states, status dots, focus rings. Saturation ~52%. No other accent colors.
- **Signal Amber** (#F59E0B) — Warning/critical states only (SSL expiry, degraded)
- **Signal Red** (#EF4444) — Error states only (domain down)

**Banned:** Purple, blue-neon, indigo, rose, cyan, violet, or any secondary accent. No gradient text on headers.

## 3. Typography Rules
- **Display:** Geist Variable — Track-tight, -0.04em letter-spacing. Weight-driven hierarchy (700/800 for headers, 500/600 for subheads). Never use weight below 500 for display text.
- **Body:** Geist Variable — Relaxed leading (1.6), 65ch max-width. Use `text-zinc-400` for body, `text-zinc-300` for strong emphasis.
- **Mono:** Geist Mono Variable — For code, timestamps, latency numbers, domain names, metadata. `text-zinc-500` for neutral, `text-emerald-400` for positive metrics.
- **Banned:** Inter, any system font stack fallback. Geist variable font must be the sole sans-serif. Serif fonts (all varieties) banned entirely — this is a monitoring dashboard, not an editorial site.

## 4. Component Stylings
- **Buttons:** Flat, no outer glow. `bg-emerald-500` for primary, `bg-zinc-800` border for secondary. Tactile spring scale on press (0.97). No "Learn more" secondary links — one CTA per section, always the primary action.
- **Cards:** Generously rounded (1rem/2xl). Subtle `border-zinc-800/60` with `bg-zinc-900/40`. Used only when elevation communicates hierarchy (dashboard preview cards, stat panels). Flat dividers for high-density lists.
- **Feature tiles:** Border-grid separator (`gap-px` technique) instead of individual cards. No per-tile accent colors — use consistent emerald icon tinting.
- **Inputs:** Label above, inline error below. Focus ring in emerald. No floating labels.
- **Loading:** Skeletal shimmer matching layout dimensions. No circular spinners.
- **Empty States:** Composed compositions — not just "No data" text.

## 5. Layout Principles
- **Grid-first responsive architecture.** Max-width 6xl (1152px) container containment.
- **Asymmetric hero split.** Left-aligned value prop + right dashboard preview. Centered heroes banned.
- **Mobile-first collapse (< 768px):** All multi-column layouts collapse to single column. Hero stack reverses (content then mockup).
- **No 3-column equal card grids.** Feature grid uses `gap-px` border-grid with staggered per-item transitions.
- **min-h-[100dvh] on full-viewport sections.** Never `h-screen` (prevents iOS Safari catastrophic jump).
- **No horizontal overflow.** Horizontal scroll on mobile is a critical failure.
- **Typography scales via clamp().** `text-[clamp(2.5rem,6vw,4.5rem)]` for hero H1, `text-[clamp(2rem,4.5vw,3.25rem)]` for section headers. Body minimum `1rem`/`14px`.
- **Touch targets:** All interactive elements minimum 44px tap target.
- **Vertical gap scaling:** Section padding uses `py-24 sm:py-32` — proportional reduction on mobile.

## 6. Motion & Interaction
- **Spring physics default:** `stiffness: 400, damping: 25` for hover, `stiffness: 200, damping: 18` for entrance. No linear easing.
- **Perpetual micro-interactions:** Arrow icon bounce (4s loop), status dot pulse (2s loop). Every active component has an infinite loop state.
- **Staggered orchestration:** Cascade delays (0.04–0.08s per item) for waterfall reveals. Never mount lists instantly.
- **Performance:** Animate exclusively via `transform` and `opacity`. Never animate `top`, `left`, `width`, `height`.
- **`useReducedMotion()`** on every animated component. Disable all perpetual loops and spring physics when reduced motion is preferred.

## 7. Anti-Patterns (Banned)
- ❌ No emojis in the marketing site UI (footer checkmark emojis must be removed)
- ❌ No `Inter` font — Geist Variable is the sole sans-serif
- ❌ No generic serif fonts (all serif banned for dashboard/SaaS sites)
- ❌ No pure black (`#000000`) — use Zinc-950 (`#09090B`)
- ❌ No neon/outer glow shadows — `shadow-glow` classes emit green glow, remove
- ❌ No oversaturated accents — only `#10B981` (emerald, 52% saturation)
- ❌ No per-feature accent colors — no indigo/amber/rose/cyan/violet variants
- ❌ No excessive gradient text on large headers — solid emerald for span highlights
- ❌ No 3-column equal card layouts — feature grid must use `gap-px` border technique
- ❌ No generic names or placeholders
- ❌ No fake round numbers (`99.97%`, `2,400+`, `12,500+`) — replace with `[metric]` placeholders or remove entirely. Every stat must be real or absent.
- ❌ No fabricated system metrics — dashboard mock must not display invented latency/uptime numbers
- ❌ No `LABEL // YEAR` formatting
- ❌ No AI copywriting clichés ("Elevate", "Seamless", "Unleash", "Next-Gen")
- ❌ No filler UI text ("Scroll to explore", "Swipe down", scroll arrows, bouncing chevrons)
- ❌ No secondary "Learn more" CTAs — one primary action per section
- ❌ No broken image links — prefer SVG components over external image URLs
