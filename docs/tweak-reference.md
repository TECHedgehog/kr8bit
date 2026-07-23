# Tweak Reference

Quick guide to every visual knob in the UI. Each section maps to a component you can see on screen, ordered **top-to-bottom**. Jump to a section, find the knob, change the value in `styles.css`.

---

## TopBar

Floating glass pill at the top of every page. Contains the logo, nav links, and theme toggle.

### Container (`.topbar`)
`styles.css:181`

The pill shape itself. Uses tier-1 liquid glass tokens:

| Knob | Token | Location | Effect |
|---|---|---|---|
| Blur strength | `--liquid-glass-blur` | `styles.css:66` (dark), `:111` (light) | Higher = blurrier background behind the bar, more GPU |
| Fill opacity | `--liquid-glass-bg` alpha | `styles.css:67` (dark), `:112` (light) | Lower = more see-through |
| Edge shine | `--liquid-glass-edge` white alpha | `styles.css:68` (dark), `:113` (light) | Higher = stronger rim light on top edge |
| Top gap | `--topbar-top-gap` | `styles.css:28` | Space between bar and viewport top |
| Max width | `--topbar-max-w` | `styles.css:30` | Wider = bar stretches further on large screens |

### Nav lens indicator (`.topbar-indicator`)
`styles.css:224`

The sliding pill behind the active nav link. Two systems run at the same time:

**1. The slide (CSS transition)**  
`styles.css:236`

React measures the active link and sets `translate` + `width` via inline style. The transition smooths the jump:

```css
transition: translate 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
            width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
            opacity 0.25s ease,
            backdrop-filter 0.3s ease,
            -webkit-backdrop-filter 0.3s ease;
```

| Knob | Value | Effect |
|---|---|---|
| Slide duration | `0.6s` | Higher = slower horizontal slide |
| Slide overshoot | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `y1` > 1 = spring/overshoot. Lower toward `1.0` = less spring |
| Fade speed | `opacity 0.25s` | How fast the lens appears/disappears |
| Blur ramp | `backdrop-filter 0.3s` | How fast blur changes when moving starts/stops |

**2. The vertical pulse (CSS keyframe animation)**  
`styles.css:262`

Triggered by adding `.topbar-indicator--moving` on route change. The lens stretches vertically while it slides:

```css
.topbar-indicator--moving {
  animation: lens-pulse 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
```

`@keyframes lens-pulse` — `styles.css:269`
```css
@keyframes lens-pulse {
  0%   { transform: scaleY(1); }    /* normal height */
  35%  { transform: scaleY(1.4); }  /* stretch 40% taller */
  70%  { transform: scaleY(0.92); } /* slight undershoot */
  100% { transform: scaleY(1); }    /* settle back */
}
```

| Knob | Value | Effect |
|---|---|---|
| Pulse duration | `0.6s` in animation | Must match transition duration for sync |
| Pulse overshoot | `cubic-bezier(...)` | Same easing curve as the slide |
| Bounce height | `scaleY(1.4)` at `35%` | Higher = taller stretch. `1.0` = no stretch |
| Undershoot | `70%` stop with `0.92` | Remove this line for less wobble |

**Chromatic sheen** (`::before` pseudo-element) — `styles.css:239`  
A subtle rainbow gradient overlay that catches light. Remove the `.topbar-indicator::before` block to kill the sheen entirely.

**Resting blur vs moving blur**
- Resting: `--lens-blur` (`blur(10px) saturate(160%)`) — `styles.css:71`
- Moving: `--lens-blur-moving` (`blur(20px) saturate(220%)`) — `styles.css:72`

### React side (`TopBar.tsx`)
- `useLayoutEffect` measures active link position on route change
- Sets `translate`, `width`, `opacity` via inline style (uses `offsetLeft` / `offsetWidth`, NOT `getBoundingClientRect` — avoids double-scaling from `.topbar.tilt-glow` transform)
- `isMoving`: adds `--moving` class on route change; `onAnimationEnd` removes it when the keyframe finishes
- `suppressTransition` state suppresses the first-mount slide via `requestAnimationFrame`
- `fontReady` + `document.fonts.ready` re-measures silently after the Onest webfont swaps in (fires once, not on route change)

---

## Recipe: reduce extent of top bar selector movement

Three ways, from subtle to zero:

**1. Less overshoot on the slide (subtle)**  
`styles.css:236` and `styles.css:265`

Lower the `1.56` in both the transition and animation `cubic-bezier` toward `1.0`:
```css
cubic-bezier(0.34, 1.2, 0.64, 1)
```
Try `1.1` for barely any spring, `1.0` for no overshoot at all.

**2. Smaller vertical bounce (moderate)**  
`styles.css:269`

Reduce the peak stretch and remove the undershoot:
```css
@keyframes lens-pulse {
  0%   { transform: scaleY(1); }
  50%  { transform: scaleY(1.15); }  /* was 1.4 */
  100% { transform: scaleY(1); }
}
```

**3. No bounce at all (flat)**  
`styles.css:236`, `styles.css:265`, `styles.css:269`

- Replace `cubic-bezier(0.34, 1.56, 0.64, 1)` with `ease-out` on both transition and animation
- Flatten the keyframe:
```css
@keyframes lens-pulse {
  0%, 100% { transform: scaleY(1); }
}
```
Or simply remove the `animation` line from `.topbar-indicator--moving` entirely.

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
