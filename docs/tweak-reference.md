# Tweak Reference

Quick guide to every visual knob in the UI. Each section maps to a component you can see on screen, ordered **top-to-bottom**. Jump to a section, find the knob, change the value in `styles.css`.

---

## TopBar

Three glass pills at the top of every page: logo pill (left), theme pill (right), and a centered nav pill that stays fixed while scrolling. The logo + theme pills live in an in-flow row (`.topbar-flow`, `styles.css:186`) that scrolls away; only the nav pill is fixed.

### Surface (`.topbar-pill`)
`styles.css:198`

Shared frosted-glass surface for all three pills. Hardcoded (does **not** use the `--liquid-glass-*` tokens — those drive cards/panels elsewhere):

| Knob | Property | Location | Effect |
|---|---|---|---|
| Blur | `backdrop-filter` | `styles.css:204` | `blur(12px) saturate(1.2)` — frosted look. Higher = blurrier, more GPU |
| Fill | `background` | `styles.css:203` | `rgba(26,29,36,0.65)` alpha — lower = more see-through |
| Border | `border` | `styles.css:206` | `1px solid var(--border-subtle)` |
| Shadow | `box-shadow` | `styles.css:207` | `var(--shadow-lg)` |
| Height | `height` | `styles.css:201` | `46px` (nav/theme pills override to `48px` at `:225`/`:248`) |

**Light mode override** — `[data-theme='light'] .topbar-pill` (`styles.css:211`): fill `rgba(255,255,255,0.5)`, same blur, stronger shadow `0 10px 30px rgba(0,0,0,0.16)`, border `rgba(0,0,0,0.1)`.

**Variants**
- `.topbar-logo-pill` (`:219`) — padding only.
- `.topbar-theme-pill` (`:223`) — `padding: 3px`, `height: 48px`, `overflow: hidden`; `.is-moving` (`:231`) flips to `overflow: visible` so the raised lens can grow past the border.
- `.topbar-nav-pill` (`:246`) — same as theme pill for the nav lens.

**Positioning**
The nav pill is fixed via its wrapper `.topbar-nav-fixed` (`styles.css:236`): `position: fixed; top: var(--topbar-top-gap); left: 0; right: 0; margin: 0 auto; width: fit-content; z-index: 50`. Logo + theme pills are in-flow inside `.topbar-flow` and scroll away.

| Knob | Token | Location | Effect |
|---|---|---|---|
| Top gap | `--topbar-top-gap` | `styles.css:28` | Space between bar and viewport top |
| Flow offset | `--topbar-flow-offset` | `styles.css:31` | Total vertical space (gap + height + margin) used to push `.app-content` down |

### Sliding glass lens (JS-driven)
`TopBar.tsx`

The moving pill behind the active nav link (and the active theme icon) is a `Glass` component from `@samasante/liquid-glass`, animated **imperatively** — there is no CSS transition or keyframe for the slide. React measures the active link, computes a `0..1` horizontal fraction + target width, and drives motion values through `animateGlassValue()`.

**Choreography** (raise → move → lower, no bounce/overshoot):
1. **RAISE** — lens grows taller (`idleH + LENS_RISE`) and ramps refraction `0 → LENS_SCALE_PEAK`.
2. **MOVE** — slides `lensX` to the new fraction + `lensW` to the new width. Spans the whole transit; raise peaks at ~62% of the move so the lens is almost at target when lower begins.
3. **LOWER** — settles height back to `idleH` and refraction back to `0`.

The same constants drive **both** lenses — the nav lens (route change, `useLayoutEffect` at `TopBar.tsx:114`) and the theme lens (theme toggle, `:190`).

**Timing + easing constants** — `TopBar.tsx:19-29`

| Knob | Constant | Location | Value | Effect |
|---|---|---|---|---|
| Move duration | `MOVE_ANIMATION.duration` | `:27` | `0.4s` | Horizontal slide length. Raise/lower overlap inside it |
| Raise duration | `RAISE_ANIMATION.duration` | `:28` | `0.25s` | Grow + refraction ramp. ~62% of move |
| Lower duration | `LOWER_ANIMATION.duration` | `:29` | `0.2s` | Settle back to idle |
| Move/raise ease | `EASE_IN_OUT` | `:19` | `cubicBezier(0.42,0,0.58,1)` | Smooth S-curve, no overshoot |
| Lower ease | `EASE_OUT` | `:22` | `cubicBezier(0.33,1,0.68,1)` | Monotonic settle, slow finish |

Total visible motion ~0.45s (lens lands at 0.4s, finishes shrinking at ~0.45s).

**Geometry + refraction constants** — `TopBar.tsx:33-66`

| Knob | Constant | Location | Value | Effect |
|---|---|---|---|---|
| Peak vertical grow | `LENS_RISE` | `:33` | `20px` | How much taller the lens gets while raised. `0` = flat slide |
| Refraction at rest | `LENS_SCALE_IDLE` | `:50` | `0` | Keeps text crisp when idle |
| Refraction peak | `LENS_SCALE_PEAK` | `:51` | `0.05` | Bend strength during transit. `0` = no distortion |
| Refraction depth | `LENS_DEPTH` | `:57` | `0.7` | How far distortion reaches inward from lens edge (0..1) |
| Lens rim gap | `LENS_MARGIN` | `:41` | `1px` | Gap between lens edge and pill border on all sides |
| Lens corner radius | `LENS_RADIUS` | `:44` | `40` | Corner roundness |
| Container clearance X | `PILL_CLEARANCE_X` | `:65` | `150` | Fixed Glass container width so it never resizes mid-transit |
| Container clearance Y | `PILL_CLEARANCE_Y` | `:66` | `80` | Fixed Glass container height (clears peak height 62) |

**React side**
- `useLayoutEffect` (`:114`) measures the active link on route change via `getBoundingClientRect`, computes the center fraction, and kicks off the three-phase animation. On first mount it sets position directly (no animation) so the lens starts idle on the active tab.
- `transitRef` (`:86`) is a token incremented each route change; stale `onComplete` callbacks from a superseded transit no-op, preventing a late lower from dropping the lens mid-transit.
- A second `useLayoutEffect` (`:174`) re-syncs lens dimensions to the active link's measured rect without animating once a transit settles (`isMoving → false`).
- `document.fonts.ready` re-measures silently after the Onest webfont swaps in (fires once, not on route change).

---

## Recipe: tune top bar lens movement

All knobs are in `TopBar.tsx` — there is no CSS to edit for the slide.

**1. Faster or slower slide**  
`TopBar.tsx:27-29`

Scale the three durations together to keep the raise→move→lower feel. Keep move longest, raise ~62% of move, lower shortest. Example — slower (back to the original feel):
```ts
const MOVE_ANIMATION  = { duration: 0.8, ease: EASE_IN_OUT };
const RAISE_ANIMATION = { duration: 0.5, ease: EASE_IN_OUT };
const LOWER_ANIMATION = { duration: 0.4, ease: EASE_OUT };
```

**2. Less vertical bounce**  
`TopBar.tsx:33`

Lower `LENS_RISE`. `0` = flat slide (no grow/shrink), lens stays at idle height the whole transit.

**3. Less refraction distortion**  
`TopBar.tsx:51` and `:57`

- `LENS_SCALE_PEAK` → `0` kills bend entirely during transit (text stays crisp).
- `LENS_DEPTH` shrinks the distorted region toward the lens edge; `0.5` leaves a flat neutral centre, `0` = no distortion reach.

**4. Different easing**  
`TopBar.tsx:19` and `:22`

Swap `EASE_IN_OUT` / `EASE_OUT` for any `cubicBezier(...)`. Avoid `y1 > 1` — the imperative animator does not clamp overshoot and the lens can drift past the target fraction.

---

## View-Toggle Sliding Lens

Same lens system as TopBar, miniaturized. Lives in the library toolbar in `GamesPage.tsx`.

### Container (`.view-toggle`)
`styles.css:766`

A segmented pill behind the grid/list icon buttons. Uses `--lens-blur` on the track for a frosted track background.

### Indicator (`.view-toggle-indicator`)
`styles.css:780`

**Slide transition** — `styles.css:792`
```css
transition: translate 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
            width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
            opacity 0.25s ease;
```

**Moving state** — `styles.css:817`
```css
animation: lens-pulse 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
```

### Differences from TopBar

| Property | TopBar | View-Toggle |
|---|---|---|
| Duration | `0.6s` | `0.4s` (shorter travel distance) |
| Padding | `top: 0` | `top: 3px` (inset for pill padding) |
| Track blur | none | `--lens-blur` on `.view-toggle` track (`styles.css:770`) |
| Chromatic `::before` | identical | identical (shared gradient, `styles.css:795`) |

### Tweak guide

- **Slower/faster slide?** Change `0.4s` on `.view-toggle-indicator` transition (`styles.css:792`) and `.view-toggle-indicator--moving` animation (`styles.css:820`).
- **No bounce?** Replace `cubic-bezier(0.34, 1.56, 0.64, 1)` with `ease-out` on both.
- **No chromatic sheen?** Remove `.view-toggle-indicator::before` (`styles.css:795`).
- **Want lens to fill more of the pill?** Decrease padding: `.view-toggle` `padding: 3px` → `2px` (`styles.css:774`), and `.view-toggle-indicator` `top: 3px` → `2px` (`styles.css:782`).

### React side (`GamesPage.tsx`)
- `useLayoutEffect` measures active icon-button position on view change
- `viewIsFirstRender` ref suppresses transition on mount (matches TopBar pattern)
- `viewSuppressTransition` state removed via `requestAnimationFrame` after first paint
- `onAnimationEnd` removes `--moving` class (no hardcoded timeout)

---

## Game Card

### Container (`.game-card`)
`styles.css:950`

Border + subtle shadow by default. Tier-3 glass tint (no blur) for performance with many cards.

### Hover glow (`.game-card:hover`)
`styles.css:963`

Three layered shadows activate on hover:

1. **Drop shadow**: `0 8px 24px rgba(0,0,0,0.5)` — depth
2. **Accent glow**: `0 0 24px var(--accent-glow)` — colored halo  
   `--accent-glow` = `rgba(130,136,254,0.25)` (dark, `styles.css:55`) / `rgba(99,102,241,0.2)` (light, `styles.css:100`)
3. **Edge highlight**: `0 1px 0 rgba(255,255,255,0.08) inset` — top rim light

| Knob | Location | Effect |
|---|---|---|
| Drop shadow spread | `24px` in shadow | Larger = softer, more depth |
| Accent glow radius | `24px` in `--accent-glow` shadow | Larger = wider colored halo |
| Accent glow color | `--accent-glow` token | Change alpha for more/less intense color |
| Border color | `border-color: var(--accent)` | Change to `var(--text-muted)` for less emphasis |

### Overlay strip (`.game-card-overlay`)
`styles.css:989`

A gradient + blur strip at the bottom of the card cover, visible on hover.

- `background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)` — fade from bottom
- `backdrop-filter: var(--glass-blur)` — tier-2 blur (`blur(20px) saturate(160%)`)

| Knob | Location | Effect |
|---|---|---|
| Gradient darkness | `0.55` alpha | Higher = darker, more legible text |
| Blur | `--glass-blur` (tier 2, `styles.css:65`) | Remove `backdrop-filter` entirely for zero-blur cards |

---

## Search Bar

`GamesPage.tsx` toolbar, left of the spacer.

### Container (`.library-search`)
`styles.css:731`

Two-state width: collapsed (icon + label) and expanded (full input).

| Knob | Token | Location | Effect |
|---|---|---|---|
| Collapsed width | `--search-collapsed-w` | `styles.css:39` | Fixed pixel width when idle (default `120px`) |
| Expanded width | `--search-expanded-w` | `styles.css:40` | Fixed pixel width when focused/clicked (default `320px`) |
| Expand duration | `width 0.2s` | `styles.css:743` | How fast the bar grows/shrinks. Higher = slower |
| Expand easing | `ease` | `styles.css:743` | `ease` = gentle acceleration. Swap for `ease-out` or `cubic-bezier(...)` |

### Behavior
- **Expand trigger:** input receives focus (click or keyboard tab).
- **Collapse trigger:** input blurs AND the text is empty. If a search is active (text remains), the bar stays expanded so the filter remains visible.
- On initial load with an active `?search=` param, the bar starts expanded.

### Tweak guide
- **Want a wider/narrower collapsed pill?** Change `--search-collapsed-w`.
- **Want a wider/narrower expanded field?** Change `--search-expanded-w`.
- **Faster/slower animation?** Change `0.2s` in `.library-search` transition.
- **Want it to collapse even when text is present?** In `GamesPage.tsx`, remove the `if (!searchInput.trim())` guard inside the `onBlur` handler.

---

## 3D Tilt + Subtle Glow

Pointer-driven 3D tilt + specular light spot that follows the cursor. Applied to `.game-card`, `.topbar`. Search bar gets border-only glow (no tilt).

### CSS tokens (shared)
`styles.css:32-37`

| Token | Value | Purpose |
|---|---|---|
| `--tilt-max` | `6deg` | max tilt per axis |
| `--tilt-perspective` | `900px` | perspective distance (higher = flatter) |
| `--tilt-active-scale` | `1.06` | lift scale when pointer enters element |
| `--tilt-settle-ms` | `400` | reset animation duration (ms) when pointer leaves |
| `--glow-radius` | `400px` | specular disc diameter radius |
| `--glow-strength` | `0.8` | peak specular opacity multiplier |

### CSS tokens (theme-dependent)

| Token | Dark | Light | Purpose |
|---|---|---|---|
| `--glow-color` | `rgba(255,255,255,0.35)` | `rgba(255,255,255,0.65)` | specular tint color |

Dark: `styles.css:83`  
Light: `styles.css:128`

### JS constants (`useTiltGlow.ts`)

| Constant | Value | Purpose |
|---|---|---|
| `GROW_MS` | `250` | grow-in duration when pointer enters |
| `SETTLE_EASE` | `1 - (1-p)^3` | ease-out cubic for reset |

### Tilt base class (`.tilt-glow`)
`styles.css:1102`

Applies `perspective`, `rotateX`, `rotateY`, and `scale` transforms. The `::before` pseudo-element renders the radial gradient specular spot.

### TopBar override (`.topbar.tilt-glow`)
`styles.css:1121`

Forces `--tilt-max: 1deg` so the TopBar barely tilts — keeps it feeling stable.

### Search bar border glow (`.library-search.tilt-glow`)
`styles.css:1126`

Overrides the generic overlay with `mask-composite: exclude` to restrict the gradient to a 1px border halo.

| Knob | Location | Effect |
|---|---|---|
| Border glow thickness | `padding: 1px` in `::before` (`styles.css:1132`) | Increase for thicker halo border |
| Border glow falloff | `--glow-radius` (`styles.css:36`) | Larger = softer falloff along the border |
| Glow strength | `--glow-strength: 0.25` override (`styles.css:1128`) | Higher = brighter search border |

### Tweak guide

- **More/less tilt?** Increase/decrease `--tilt-max`. `14deg` = dramatic, `4deg` = subtle, `0deg` = off.
- **Faster/slower reset?** Decrease/increase `--tilt-settle-ms`. `200` = snappy, `800` = floaty.
- **Bigger/smaller glow?** `--glow-radius`: larger = softer, smaller = sharper.
- **Stronger/weaker light?** `--glow-strength`: higher = brighter specular spot. `--glow-color` alpha: higher = more opaque tint.
- **Disable on a specific element?** Remove `tilt-glow` class from that element's JSX.
- **Disable entirely?** Set `--tilt-max: 0deg` and `--glow-strength: 0` in `:root`.

---

## Glass Tier System

Three-tier glass architecture for visual continuity + performance on low-end hardware (Unraid/Docker).

### Tokens (dark theme)
`styles.css:64-77`

### Tokens (light theme)
`styles.css:109-122`

| Token | Dark | Light | Tier | Description |
|---|---|---|---|---|
| `--liquid-glass-blur` | `blur(32px) saturate(180%)` | `blur(40px) saturate(200%)` | 1 | Heavy blur — floating overlays |
| `--liquid-glass-bg` | `rgba(18,20,25,0.55)` | `rgba(230,232,240,0.35)` | 1 | Semi-transparent fill |
| `--liquid-glass-edge` | inset white + dark bottom | stronger white + inner ring | 1 | Glass edge highlights |
| `--glass-blur` | `blur(20px) saturate(160%)` | same | 2 | Medium blur — inline containers |
| `--glass-bg` | `rgba(18,20,25,0.7)` | `rgba(255,255,255,0.75)` | 2 | Semi-transparent fill |
| `--glass-edge` | inset white + dark bottom | inset white top | 2 | Glass edge highlights |
| `--glass-tint-bg` | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.6)` | 3 | Translucent tint, **no blur** |
| `--glass-tint-hover-bg` | `rgba(255,255,255,0.1)` | `rgba(255,255,255,0.8)` | 3 | Stronger tint for hover |
| `--glass-tint-edge` | inset white top hairline | inset white top `0.4` | 3 | Subtle edge highlight |

### Tier → Element mapping

| Tier | Blur | Used on |
|---|---|---|
| 1 — Liquid Glass | 32px | Dropdowns (`sort-menu`, `filter-menu`), tooltip, toast, modal, TopBar |
| 2 — Glass Surface | 20px | Search box, `.card`, `.scan-progress`, view-toggle track, game-card overlay |
| 3 — Glass Tint | none | Buttons, icon-buttons, inputs, status-badge, error banner, game-list-row hover, theme-toggle hover, dropdown item hover |

### Tweak guide

**Want heavier/lighter blur?**
- Tier 1: adjust `--liquid-glass-blur` (higher = blurrier, more GPU).
- Tier 2: adjust `--glass-blur`.
- Tier 3: no blur by design — safest for many elements (50+ game cards).

**Want more/less transparency?**
- Lower alpha = more see-through. E.g. dark tier 1 `rgba(18,20,25,0.4)` = thinner.
- Light theme tier 1 is already very thin (`0.35`) — lower risks unreadable text.

**Want stronger/weaker edge highlights?**
- Tier 1 `--liquid-glass-edge`: increase white alpha (`0.08` → `0.15`) for more shine.
- Tier 3 `--glass-tint-edge`: currently a single hairline. Add bottom shadow for more depth:
  ```css
  --glass-tint-edge: inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.15);
  ```

**Game card overlay strip:**
- `.game-card-overlay` uses `--glass-blur` (tier 2) + gradient fade. Change gradient alpha (`0.55` dark) for more/less legibility.
- Remove `backdrop-filter` on `.game-card-overlay` for zero-blur cards (tier 3 tint only).

---

## Appendix: Animation Primitives Reference

Moved here from the original doc. Use this section if you need to understand the CSS mechanics behind the knobs above.

### `@keyframes` — defining the sequence

Defines **what values** a property passes through over time:

```css
@keyframes lens-pulse {
  0%   { transform: scaleY(1); }   /* start: normal size */
  35%  { transform: scaleY(1.4); }  /* 35% in: grow 40% taller */
  70%  { transform: scaleY(0.92); } /* 70% in: shrink slightly below */
  100% { transform: scaleY(1); }    /* end: back to normal */
}
```

- `0%` and `100%` can also be written `from` and `to`.
- Omitting `0%` uses the element's current value.
- Omitting `100%` snaps back to initial after the animation ends (unless `forwards` is set).
- **Fewer stops between 0% and 100%** = less springy. More stops with alternating values = more bounces.

### `animation` shorthand

```css
animation: <name> <duration> <timing-function> <delay> <iteration-count> <direction> <fill-mode> <play-state>;
```

Current value on `.topbar-indicator--moving`:

```css
animation: lens-pulse 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
```

| Property | Value | Meaning |
|---|---|---|
| `animation-name` | `lens-pulse` | which `@keyframes` to run |
| `animation-duration` | `0.6s` | total time start to finish |
| `animation-timing-function` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | easing curve (see below) |
| `animation-fill-mode` | `forwards` | keep the final keyframe value after done |

### `animation-fill-mode`

What happens before and after the animation runs:

```css
/* Snaps back to original value when done (default) */
animation-fill-mode: none;

/* Keeps the 100% keyframe value after finishing */
animation-fill-mode: forwards;

/* Applies the 0% value before the animation starts (during delay) */
animation-fill-mode: backwards;

/* Both: applies 0% during delay AND keeps 100% after */
animation-fill-mode: both;
```

### `cubic-bezier()` — the easing curve

```
cubic-bezier(x1, y1, x2, y2)
```

Two control points describing a curve from `(0,0)` to `(1,1)`:
- **X axis** = time (0 → 1, left to right)
- **Y axis** = progress (0 → 1, bottom to top)

Current value: `cubic-bezier(0.34, 1.56, 0.64, 1)`

```
y=1.56 ···●
y=1.00 ──────────────●─────  (overshoots above 1 = overshoot)
y=0.50 ──────────────╱────────
y=0.00 ●──╱─────────────────
       x=0   x=0.34   x=0.64   x=1
```

The `1.56` y-value shoots past `1.0` → **overshoot**. Then `0.64/1` pulls back → settles.

**Tweaking the curve:**

```css
/* Linear — constant speed, no overshoot */
cubic-bezier(0, 0, 1, 1)
/* or */
linear

/* Ease-out — fast start, slow finish */
cubic-bezier(0, 0, 0.2, 1)
/* or */
ease-out

/* Ease-in-out — slow start AND finish */
cubic-bezier(0.42, 0, 0.58, 1)
/* or */
ease-in-out

/* Gentle spring-ish overshoot (current) */
cubic-bezier(0.34, 1.56, 0.64, 1)

/* More violent spring */
cubic-bezier(0.2, 2.5, 0.4, 1)

/* No overshoot, silky settle */
cubic-bezier(0.16, 1, 0.3, 1)

/* Undershoot first (pull back before forward) */
cubic-bezier(0.5, -0.3, 0.5, 1)
```

**Rules of thumb:**
- Higher `y1` > 1 = more overshoot at the start.
- Lower `y1` < 0 = undershoot (pulls back before going forward).
- `y2` < 1 = settles gently. `y2` = 1 = snaps to final value.

### `animation-iteration-count`

```css
/* Once (default) */
animation-iteration-count: 1;

/* Infinite loop */
animation-iteration-count: infinite;

/* 3 times */
animation-iteration-count: 3;
```

### `animation-direction`

```css
/* Normal: 0% → 100% */
animation-direction: normal;

/* Reverse: 100% → 0% */
animation-direction: reverse;

/* Alternate: forward then backward each iteration */
animation-direction: alternate;

/* Alternate-reverse: backward first */
animation-direction: alternate-reverse;
```

### `animation-delay`

```css
/* Wait 0.5s before starting */
animation-delay: 0.5s;
```

In shorthand: `animation: lens-pulse 0.6s 0.5s cubic-bezier(...) forwards;` (delay goes after duration).

### `animation-play-state`

```css
/* Running (default) */
animation-play-state: running;

/* Paused (freeze at current frame) */
animation-play-state: paused;
```

Useful for pausing on hover or controlling via JS.

### `transition` — animating property changes

Transitions animate **between values** when a property changes (e.g., `translateX(0)` to `translateX(120px)`). Animations follow a **fixed keyframe timeline**.

```css
transition: translate 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
            width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
            opacity 0.25s ease,
            backdrop-filter 0.3s ease,
            -webkit-backdrop-filter 0.3s ease;
```

Same `cubic-bezier` applies to the slide (`translate`) and `width`. The `opacity` and `backdrop-filter` fade use gentler `ease`.

**Both run simultaneously**: `transition` handles the smooth slide across, `animation` handles the vertical bounce pulse. That's why the lens slides AND grows at the same time.
