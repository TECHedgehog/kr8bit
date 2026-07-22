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