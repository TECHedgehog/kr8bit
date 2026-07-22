# Tweak Reference

Notes on animation, styling, and behavior modifiers the user may tinker with. Add to this file whenever implementing visual changes the user might want to adjust later.

---

## CSS Animation Properties

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

---

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

---

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

---

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

---

### `animation-iteration-count`

```css
/* Once (default) */
animation-iteration-count: 1;

/* Infinite loop */
animation-iteration-count: infinite;

/* 3 times */
animation-iteration-count: 3;
```

---

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

---

### `animation-delay`

```css
/* Wait 0.5s before starting */
animation-delay: 0.5s;
```

In shorthand: `animation: lens-pulse 0.6s 0.5s cubic-bezier(...) forwards;` (delay goes after duration).

---

### `animation-play-state`

```css
/* Running (default) */
animation-play-state: running;

/* Paused (freeze at current frame) */
animation-play-state: paused;
```

Useful for pausing on hover or controlling via JS.

---

### `transition` — animating property changes

Transitions animate **between values** when a property changes (e.g., `translateX(0)` to `translateX(120px)`). Animations follow a **fixed keyframe timeline**.

```css
transition: translate 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
            width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
            opacity 0.25s ease,
            backdrop-filter 0.3s ease,
            -webkit-backdrop-filter 0.3s ease;
```

Same `cubic-bezier` applies to the slide (translate) and width. The opacity and backdrop-filter fade use gentler `ease`.

**Both run simultaneously**: `transition` handles the smooth slide across, `animation` handles the vertical bounce pulse. That's why the lens slides AND grows at the same time.

---

## Current TopBar Indicator Animation

Located in `web/src/styles.css`:

### Tokens (dark theme)

```css
--lens-blur: blur(10px) saturate(160%);          /* resting blur */
--lens-blur-moving: blur(20px) saturate(220%);   /* distorted while moving */
```

### Tokens (light theme)

```css
--lens-blur: blur(10px) saturate(160%);
--lens-blur-moving: blur(20px) saturate(220%);
```

### Indicator element (`.topbar-indicator`)

- `position: absolute` inside `.topbar-nav` (relative)
- `translate` property handles horizontal slide (set by React via `style`)
- `width` set by React from measured link dimensions
- `opacity` fades in on mount, out when no active link
- `transition` on all three + `backdrop-filter` for blur ramp

### Moving state (`.topbar-indicator--moving`)

Triggered by React adding the class on route change, removed after 600ms:

- Swaps `backdrop-filter` to `--lens-blur-moving` (heavier distortion)
- Runs `lens-pulse` keyframe animation

### Keyframe animation (`lens-pulse`)

```css
@keyframes lens-pulse {
  0%   { transform: scaleY(1); }   /* normal */
  35%  { transform: scaleY(1.4); } /* grow 40% taller */
  70%  { transform: scaleY(0.92); }/* slight undershoot */
  100% { transform: scaleY(1); }   /* settle */
}
```

**Tweak guide:**
- Want taller growth? Increase `1.4` to `1.6` or higher.
- Want less bounce? Remove the `70%` stop (no undershoot).
- Want more bounce? Add more stops with alternating values.
- Want slower? Increase `0.6s` on both `animation` and `transition`.
- Want no bounce at all? Replace `cubic-bezier(0.34, 1.56, 0.64, 1)` with `ease-out`.

### React side (`TopBar.tsx`)

- `useLayoutEffect` measures active link position on route change
- Sets `translate`, `width`, `opacity` via inline style
- `isMoving` state: `true` on route change, `false` after `setTimeout(600)` — must match CSS `animation-duration`
- `NAV_ITEMS` array drives link rendering + ref collection

---

## Glass Tier System

Three-tier glass architecture for visual continuity + performance on low-end hardware (Unraid/Docker).

### Tokens

| Token | Dark | Light | Description |
|---|---|---|---|
| `--liquid-glass-blur` | `blur(32px) saturate(180%)` | `blur(40px) saturate(200%)` | Heavy blur — floating overlays |
| `--liquid-glass-bg` | `rgba(18,20,25,0.55)` | `rgba(230,232,240,0.35)` | Semi-transparent fill — tier 1 |
| `--liquid-glass-edge` | inset white top + dark bottom | stronger white top + inner ring | Glass edge highlights — tier 1 |
| `--glass-blur` | `blur(20px) saturate(160%)` | same | Medium blur — inline containers |
| `--glass-bg` | `rgba(18,20,25,0.7)` | `rgba(255,255,255,0.75)` | Semi-transparent fill — tier 2 |
| `--glass-edge` | inset white top + dark bottom | inset white top | Glass edge highlights — tier 2 |
| `--glass-tint-bg` | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.6)` | Translucent tint, **no blur** — tier 3 |
| `--glass-tint-hover-bg` | `rgba(255,255,255,0.1)` | `rgba(255,255,255,0.8)` | Stronger tint for hover — tier 3 |
| `--glass-tint-edge` | inset white top hairline | inset white top `0.4` | Subtle edge highlight — tier 3 |

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

## View-Toggle Sliding Lens

Same lens system as TopBar, miniaturized. Lives in `GamesPage.tsx` + `styles.css` `.view-toggle-indicator`.

### Differences from TopBar lens

| Knob | TopBar | View-Toggle |
|---|---|---|
| Duration | `0.6s` | `0.4s` (smaller travel distance) |
| Padding | `top: 0` | `top: 3px` (3px inset for pill padding) |
| Track blur | none | `--lens-blur` on `.view-toggle` track |
| Chromatic `::before` | identical | identical (shared gradient) |

### Tweak guide

**Slower/faster slide?** Change `0.4s` on `.view-toggle-indicator` transition + `.view-toggle-indicator--moving` animation.

**No bounce?** Replace `cubic-bezier(0.34, 1.56, 0.64, 1)` with `ease-out`.

**No chromatic sheen?** Remove `.view-toggle-indicator::before` block.

**Want lens to fill more?** Decrease pill padding: `.view-toggle` `padding: 3px` → `2px` or `1px`, and `.view-toggle-indicator` `top: 3px` → `2px` or `1px`.

### React side (`GamesPage.tsx`)

- `useLayoutEffect` measures active icon-button position on view change
- `viewIsFirstRender` ref suppresses transition on mount (matches TopBar pattern)
- `viewSuppressTransition` state removed via `requestAnimationFrame` after first paint
- `onAnimationEnd` removes `--moving` class (no hardcoded timeout)