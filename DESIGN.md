---
name: kr8bit
description: Self-hosted game library manager
colors:
  primary: "#8288fe"
  primary-light: "#6366f1"
  primary-hover: "#a0a6ff"
  primary-hover-light: "#4f46e5"
  primary-text: "#050608"
  primary-text-light: "#ffffff"
  neutral-bg: "#08090c"
  neutral-bg-light: "#e8ebf0"
  surface-1: "#121419"
  surface-1-light: "#f7f8fb"
  surface-2: "#1a1d24"
  surface-2-light: "#eef0f4"
  surface-3: "#252932"
  surface-3-light: "#d8dce4"
  border-subtle: "#1e2128"
  border-subtle-light: "#d8dde5"
  text: "#e6e8ec"
  text-light: "#1a1d23"
  text-muted: "#8a93a3"
  text-muted-light: "#6b7280"
  success: "#3fb950"
  success-light: "#16a34a"
  warning: "#d4a72c"
  warning-light: "#ca8a04"
  danger: "#e5484d"
  danger-light: "#dc2626"
  nav-library: "#10b981"
  nav-repacks: "#f97316"
  nav-settings: "#8b5cf6"
  glass-surface-dark: "rgba(18, 20, 25, 0.7)"
  glass-surface-light: "rgba(255, 255, 255, 0.5)"
  liquid-surface-dark: "rgba(18, 20, 25, 0.55)"
  liquid-surface-light: "rgba(255, 255, 255, 0.6)"
  tint-dark: "rgba(255, 255, 255, 0.06)"
  tint-light: "rgba(255, 255, 255, 0.35)"
  tint-hover-dark: "rgba(255, 255, 255, 0.1)"
  tint-hover-light: "rgba(255, 255, 255, 0.5)"
  pill-dark: "rgba(26, 29, 36, 0.65)"
typography:
  display:
    fontFamily: "'Onest', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: "1.2"
  headline:
    fontFamily: "'Onest', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "1.2"
  title:
    fontFamily: "'Onest', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.2"
  body:
    fontFamily: "'Onest', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5"
  label:
    fontFamily: "'Onest', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
  mono:
    fontFamily: "'SF Mono', Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  full: "999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-6: "24px"
  space-8: "32px"
  space-12: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-text}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "8px 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "8px 12px"
  input:
    backgroundColor: "{colors.tint-dark}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "8px 12px"
  navigation-pill:
    backgroundColor: "{colors.pill-dark}"
    textColor: "{colors.text-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    height: "48px"
  filter-chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 9px"
  game-card:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0"
---

# Design System: kr8bit

## Overview

**Creative North Star: “The Curator's Vitrine”**

kr8bit is a calm collector's den: a dense library held in a dark, quiet field, with translucent surfaces that reveal rather than conceal. The interface treats each game as an artifact to browse, not a tile in a generic admin grid. Glass is the material language; responsive glow, refraction, and small spring-like motions give controls a pressable, alive quality without changing the work surface into an arcade spectacle.

The same visual grammar survives the light theme: cool gallery neutrals replace the dark room while indigo remains the identifying accent. Active navigation is marked by a moving liquid-glass lens; category accents appear through its refracted copy, not as permanent colored tabs. The application name remains **kr8bit**; the North Star is a design metaphor, not a rename.

**Key Characteristics:**
- Quiet collector's den, built around a browsable game library.
- Three glass treatments: liquid, blurred surface, and blur-free tint.
- Indigo identity with restrained per-section color accents.
- Responsive, spring-led feedback; reduced-motion preferences honored.

## Colors

The palette is a two-theme system: Basement Indigo is the primary accent; cool charcoal and frost neutrals carry most of each screen. Frontmatter's `-light` entries record the light-theme counterparts. Frontmatter names are semantic aliases for the CSS custom properties; the live source remains `web/src/styles.css`.

The glass and tint colors in frontmatter are alpha-bearing fills. Their sidecar tonal ramps are synthetic swatch gradients composited over the corresponding theme canvas; those ramps are not additional UI tokens.

### Primary
- **Basement Indigo** (`primary`, `primary-light`): global accent for selected states, focus borders, active controls, and the logo. The light theme shifts the same identity to a deeper indigo for contrast.
- **Indigo Lift** (`primary-hover`, `primary-hover-light`): theme-specific hover state for primary actions.

### Secondary
- **Shelf Emerald** (`nav-library`): Library icon color visible through the active nav lens.
- **Repack Amber** (`nav-repacks`): Repacks icon and page accent; localized to that surface.
- **Settings Violet** (`nav-settings`): Settings icon color visible through the active nav lens.
- **Status colors** (`success`, `warning`, `danger`): semantic progress, caution, and error states. Light-theme variants are paired in frontmatter.

### Neutral
- **Vitrine Black** (`neutral-bg`): dark-theme canvas.
- **Gallery Frost** (`neutral-bg-light`): light-theme canvas.
- **Layered neutrals** (`surface-1`–`surface-3`, including light variants): cards, controls, and borders step away from their theme's canvas.
- **Readable contrast** (`text`, `text-muted`, including light variants): primary content and secondary labels.

**The Two-Theme Rule.** Keep each semantic role paired across `[data-theme='dark']` and `[data-theme='light']`; do not substitute unrelated one-off colors for a theme-specific token.

## Typography

Onest is the UI voice; SF Mono is reserved for paths, technical values, scan details, and logs. Onest is bundled at weights 400, 500, 600, and 700. A few isolated badges request weight 800 in CSS, but that face is not bundled; do not treat it as an available font asset. The CSS uses a compact rem scale from `--text-xs` through `--text-3xl`; body copy uses a 1.5 line-height and headings use 1.2. The display role is rare (the not-found title); page titles and card headings use the smaller headline/title roles.

Labels and eyebrows are compact and often uppercase with generous tracking. That treatment belongs to section markers and status labels, not paragraphs. Keep long game titles readable; truncate at rest and use the existing marquee behavior only where the component supports it.

## Layout

The app uses a centered content frame capped at 1400px, with the top bar occupying a stable flow slot while its navigation pill remains fixed above scrolling content. The library is a virtualized grid: columns respond to available width, while cover sizes are user-selectable (130px, 160px, or 190px; 160px default). Grid gaps use the spacing scale rather than breakpoint-specific column counts.

Responsive changes are structural, not merely compressed. At 900px the filter sidebar moves above the library; at 720px the game detail dialog becomes a bottom sheet and metadata becomes one column; at 700px settings navigation stacks; at 560px scanner controls and summary grids stack. Other established breakpoints are 1200px (sidebar position), 850px (repack comparison), and 600px (empty-state copy). Full breakpoint inventory is in `.impeccable/design.json`.

## Elevation & Depth

Depth is primarily optical, not a stack of opaque cards. Tier 1 liquid glass uses `liquid-surface-dark` / `liquid-surface-light` and `--liquid-glass-blur` (32px dark, 40px light, with theme-specific saturation) for tooltips and the game detail card. Tier 2 blurred glass uses `glass-surface-dark` / `glass-surface-light` and `--glass-blur` (20px, 160% saturation) for ordinary cards, search, and selected menus. Tier 3 tint uses `tint-dark` / `tint-light` and has no backdrop blur; it is the default for buttons, fields, and the 50+ card library grid. This keeps the dense surface viable on the documented homelab targets. The card-cover lens has its own, lighter blur and refracts only on hover.

At-rest depth comes from translucent fills and inset edge highlights. Shadows mark state or floating affordances: cards gain a lift shadow on hover, while pills, tooltips, and the detail card use their established surface shadows. Dark and light shadow values, glass edge insets, and the no-full-screen-blur constraint live in the sidecar.

**The Blur Budget Rule.** Preserve the tier split: do not add backdrop blur to each dense grid card or to the full-screen detail backdrop. The detail card already carries its own glass blur; the backdrop stays a plain dim overlay to avoid repeated rasterization during motion and video playback.

## Shapes

The shape language moves from gently rounded rectangles for content panels to full capsules for controls, badges, and floating navigation. Use the established small, medium, large, and full-radius tokens; do not invent a new radius tier for one component. Game artwork keeps its portrait 2:3 ratio. The top bar, icon controls, filter chips, and close affordance share capsule geometry, with labels revealed on hover or keyboard focus where that behavior exists.

## Components

### Buttons
- **Primary:** solid accent fill, theme-specific high-contrast text, full capsule, compact horizontal padding. Hover shifts to the theme-specific hover accent; disabled controls reduce opacity.
- **Default:** translucent tint, subtle border and inset highlight, full capsule. Hover strengthens the border and tint.
- **Ghost / Danger:** ghost removes the filled surface; danger uses semantic red text and border, with a subtle red hover fill.
- **IconButton:** 36px square pill-glass control; icon-only by default, with an accessible label and optional tooltip. Active state uses the accent; press feedback scales down briefly.
- Keep visible keyboard focus; use the application's component-specific focus treatment rather than removing focus indication.

### Inputs / Fields
- Global inputs use the blur-free tint tier, a subtle border, full capsule radius, and compact padding. Focus shifts the border to the accent.
- The library search is a tier-2 glass capsule that expands from 120px to 320px. Its focus border changes to the accent; empty search may collapse on blur.
- Settings fields may use the denser small-radius field variant. Preserve its distinct focus-visible outline.

### Chips
- Filter chips are compact capsules on a surface-2 fill, with muted text at rest. Selected chips shift text and border to the accent.
- Status colors remain semantic; do not recolor neutral filter controls as status badges.

### Cards / Containers
- Ordinary `.card` surfaces use tier-2 glass, large radius, and space-4 padding.
- Game cards use a blur-free transparent/tinted shell with a subtle edge. Hover adds accent edge, glow, and lift; the cover remains portrait. The title lens appears on hover and is not permanently layered over the artwork.
- Scanner cards use solid theme surfaces and medium radii for information hierarchy and stable progress display.

### Navigation
- The top bar is a 48px pill surface with theme-specific translucency. Links stay muted at rest; the active route is indicated by a liquid-glass lens rather than a persistent active text color.
- Lens transition choreographs raise, horizontal move, and lower; route/theme changes share the same motion grammar. Per-route icon accents live in refracted content.
- At narrow widths, hide link labels while retaining their icon and accessible name.

### Tooltip
- Use the liquid-glass tier, small radius, compact label typography, and a short opacity fade. Tooltip content must not become the only accessible name for an icon control.

### Game Detail Dialog
- Centered, liquid-glass card at desktop widths; at 720px and below, anchor it to the bottom as a sheet with a top-only rounded edge.
- Keep dim backdrop free of blur. Preserve the focus-trapped dialog behavior, close affordance, and responsive one-column content.

### Scanner
- Keep the scan header, status marker, progress stages, and run summary easy to scan. Use the semantic status palette for progress phases and errors; paths and error details use SF Mono.

### Signature: Liquid-Glass Lens
- `@samasante/liquid-glass` drives TopBar route/theme lenses and the Settings navigation lens. Keep lens optics in the component's existing tune/context boundary; don't approximate the refraction with a static gradient or permanent colored tab.

## Do's and Don'ts

### Do:
- **Do** use CSS custom properties from `web/src/styles.css` as the source of truth; keep dark/light counterparts aligned by semantic role.
- **Do** keep active navigation expressed through the moving lens, with route color visible through its refracted copy.
- **Do** keep dense card collections in the blur-free tier; use hover lift and the cover lens for stateful depth.
- **Do** preserve the game-cover aspect ratio, virtualized responsive grid, and bottom-sheet dialog behavior.
- **Do** respect `prefers-reduced-motion`; pointer-driven tilt/glow is gated for reduced-motion and coarse-pointer contexts.

### Don't:
- **Don't** add a new branded color or surface recipe where a semantic token already exists.
- **Don't** apply backdrop blur to every game card or to the full-screen dialog backdrop.
- **Don't** turn the active top-bar route into a permanently tinted tab; the lens carries that state.
- **Don't** rely on motion, hover, or tooltip alone to communicate control name or keyboard focus.
- **Don't** copy obsolete selectors or values from `docs/tweak-reference.md` when they conflict with current `web/src/styles.css`.
