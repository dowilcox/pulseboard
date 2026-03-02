# PulseBoard Design System

## Direction

Dense, functional project management UI built for daily use. Flat and quiet — content leads, chrome recedes. Every surface earns its presence. MUI v6 components only, styled via `sx` prop. No Tailwind.

Modern reference points: Linear, Notion, Vercel Dashboard.

---

## Font

**Inter** — the standard for modern product UI. Tighter metrics than Roboto, better optical alignment, purpose-built for screens.

```
fontFamily: '"Inter", "Helvetica Neue", "Arial", sans-serif'
```

Install via `@fontsource/inter` or Google Fonts link. Use `font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11'` for stylistic alternates (straighter 1, open 6/9, no-tail l).

---

## Spacing

Base unit: 8px (MUI theme default). Use the multiplier scale exclusively — never raw pixel values in `sx`.

| Token | Value | Use for |
|-------|-------|---------|
| 0.5   | 4px   | Chip gaps, icon-to-label spacing |
| 1     | 8px   | Tight inline gaps, small padding |
| 1.5   | 12px  | Input padding, compact card padding |
| 2     | 16px  | Standard content padding, standard gap |
| 3     | 24px  | Section spacing, form gaps, card padding on settings pages |
| 4     | 32px  | Page-level vertical breathing room |
| 6     | 48px  | Hero/empty-state vertical padding |

**Defaults:**
- Card/Paper padding: `p: 2.5` (20px) — slightly more air than the current `p: 2`
- Content gap: `gap: 2` (16px)
- Inline element gap: `gap: 1` (8px)
- Section bottom margin: `mb: 3` (24px)
- Form field spacing: `gap: 2.5` (20px)
- Grid container: `spacing={3}`

---

## Depth

**Strategy: Borders-first, shadows rare.** Flat surfaces separated by subtle 1px borders. Shadows reserved only for floating layers (dropdowns, dialogs, popovers).

| Layer | Treatment |
|-------|-----------|
| Page background | `background.default` — no border, no shadow |
| Card / section | `elevation={0}` + `border: 1px solid` + `borderColor: 'divider'` |
| Hover card | `borderColor: 'action.selected'` — border darkens, no shadow |
| Floating (dialog, menu, popover) | `elevation={8}` — the only place shadows appear |
| Sidebar | `borderRight: 1px solid` + `borderColor: 'divider'` — no shadow |
| Auth card | `elevation={2}` — slight lift for the single centered form |

Why: Shadows create visual noise in dense UIs. Borders are crisper, more predictable across light/dark modes, and easier to control. One shadow level for floating elements keeps them feeling distinct without a shadow hierarchy to maintain.

---

## Radius

| Token | Value | Use for |
|-------|-------|---------|
| shape.borderRadius (theme) | 10 | Default for all Paper, Card, Button, Input |
| 1.5 (12px) | 12px | Explicit override for larger cards, modals |
| 0.75 (6px) | 6px | Chips, badges, small tags |
| '50%' | circle | Avatar, status dots, color indicators |
| 99px | pill | Pill-shaped buttons or badges (rare) |

Slightly rounder than the current 8px — softens the UI without looking bubbly.

---

## Color

### Palette

| Token | Light | Dark | Notes |
|-------|-------|------|-------|
| primary.main | `#6366f1` | `#818cf8` | Indigo — keep, it's excellent |
| secondary.main | `#ec4899` | `#f472b6` | Pink — accent only, use sparingly |
| background.default | `#fafafa` | `#191919` | Warm neutral base (Notion/Raycast-inspired) |
| background.paper | `#ffffff` | `#262626` | Warm surface, clear separation from base |
| text.primary | `rgba(0,0,0,0.87)` | `rgba(255,255,255,0.87)` | MUI default |
| text.secondary | `rgba(0,0,0,0.55)` | `rgba(255,255,255,0.55)` | Softer than MUI default for less visual noise |
| divider | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.10)` | Subtle but visible on blue-gray surfaces |

### Priority Colors (centralize as a constant — currently duplicated in 6 files)

```ts
export const PRIORITY_COLORS = {
  urgent: '#ef4444',
  high:   '#f97316',
  medium: '#6366f1', // use primary instead of blue for cohesion
  low:    '#94a3b8', // slate instead of pure grey, warmer
  none:   'transparent',
} as const;
```

### Status Colors

```ts
export const STATUS_COLORS = {
  success: '#22c55e',
  warning: '#f59e0b',
  error:   '#ef4444',
  info:    '#6366f1', // primary
} as const;
```

### Color Rules
- Use `text.secondary` for all non-primary text — labels, metadata, timestamps, captions
- Use `action.hover` for hover backgrounds (not custom opacity values)
- Never use raw hex in component `sx` — define in theme or constants
- Primary color appears on: CTAs, active navigation, links, focus rings. Nowhere else.

---

## Typography

Tighter, more deliberate hierarchy. Inter enables better weight differentiation.

| Role | Variant | Weight | Size | Letter-spacing | Usage |
|------|---------|--------|------|----------------|-------|
| Page title | h5 | 600 | 1.5rem | `-0.02em` | Top of page, one per view |
| Section heading | subtitle1 | 600 | 1.125rem | `-0.01em` | Card titles, panel headers |
| Sub-heading | subtitle2 | 600 | 0.875rem | `0` | Field group labels, sidebar sections |
| Body | body2 | 400 | 0.875rem | `0` | All content text |
| Caption/meta | caption | 500 | 0.75rem | `0.01em` | Timestamps, counts, secondary info |
| Label | caption | 600 | 0.75rem | `0.02em` | Form field labels, column headers |
| Stat number | h4 | 700 | 2rem | `-0.03em` | Dashboard metric values |
| Overline | overline | 600 | 0.625rem | `0.1em` | Sidebar category labels (uppercase) |

### Rules
- `fontWeight: 600` is the primary emphasis weight — use for any text that needs to stand out
- `fontWeight: 400` for body, `500` for slightly emphasized body (names in lists)
- Negative letter-spacing on headings (h4-h6) for tighter, more modern feel
- Positive letter-spacing only on overlines and uppercase labels
- `color="text.secondary"` on all non-primary text — don't leave it as default black

---

## Buttons

| Type | Props | When |
|------|-------|------|
| Primary CTA | `variant="contained"` | One per section/dialog — the main action |
| Secondary | `variant="outlined"` | Cancel, back, alternative actions |
| Tertiary/Ghost | `variant="text"` | Inline actions, less important options |
| Destructive | `variant="outlined" color="error"` | Delete, disconnect, revoke — outlined to reduce visual weight |
| Destructive confirm | `variant="contained" color="error"` | Only inside a confirmation dialog |
| Icon action | `<IconButton size="small">` | Toolbars, row actions, close buttons |

### Rules
- `textTransform: 'none'` — global theme override, never undo it
- `size="small"` for all non-hero contexts (tables, toolbars, cards)
- `disableElevation` on all contained buttons — flat buttons match the border-based depth strategy
- Use `startIcon` for buttons with icons, not icon + text side by side
- One contained button per visual group. If two actions sit together, one is contained, one is outlined or text.
- `fullWidth` in dialogs and narrow forms only

---

## Cards & Surfaces

### Standard card
```tsx
<Paper
  variant="outlined"      // border, no shadow
  sx={{ p: 2.5, borderRadius: 1.5 }}
>
```

### Settings / form section
```tsx
<Paper
  variant="outlined"
  sx={{ p: 3, borderRadius: 1.5 }}
>
```

### Auth card (centered single form)
```tsx
<Paper
  elevation={2}
  sx={{ width: '100%', maxWidth: 440, px: 4, py: 4, borderRadius: 1.5 }}
>
```

### Stat card (dashboard)
```tsx
<Paper
  variant="outlined"
  sx={{ p: 2.5, borderRadius: 1.5 }}
>
  <Typography variant="caption" color="text.secondary" fontWeight={600}>Label</Typography>
  <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>42</Typography>
</Paper>
```

### Empty state
```tsx
<Box sx={{ py: 8, textAlign: 'center' }}>
  <Icon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
  <Typography variant="subtitle1" fontWeight={600}>No items yet</Typography>
  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
    Description text
  </Typography>
  <Button variant="contained">Create first</Button>
</Box>
```

---

## Dialogs

```tsx
<Dialog
  open={open}
  onClose={handleClose}
  maxWidth="sm"
  fullWidth
  PaperProps={{ sx: { borderRadius: 1.5 } }}
>
  <DialogTitle sx={{ pb: 1 }}>
    <Typography variant="subtitle1" fontWeight={600}>Title</Typography>
  </DialogTitle>
  <DialogContent sx={{ pt: '8px !important' }}>
    {/* content */}
  </DialogContent>
  <DialogActions sx={{ px: 3, py: 2 }}>
    <Button variant="text">Cancel</Button>
    <Button variant="contained" disableElevation>Confirm</Button>
  </DialogActions>
</Dialog>
```

### Rules
- `maxWidth="sm"` for standard CRUD dialogs
- `maxWidth="md"` only for complex forms (SSO config, multi-section)
- Always `fullWidth`
- Cancel is `variant="text"`, not `"outlined"` — reduce visual competition with CTA
- Dialog border radius: `1.5` (12px)

---

## Layout

### Primitives
- **Box** is the only layout primitive. Do not use Stack.
- Row: `display: 'flex', alignItems: 'center', gap: 1`
- Row spaced: add `justifyContent: 'space-between'`
- Column: `display: 'flex', flexDirection: 'column', gap: 2`
- Form column: `display: 'flex', flexDirection: 'column', gap: 2.5`

### Page grid
```tsx
<Grid container spacing={3}>
  <Grid size={{ xs: 12, sm: 6, md: 4 }}>  {/* 3-col */}
  <Grid size={{ xs: 12, sm: 6, md: 3 }}>  {/* 4-col */}
</Grid>
```

### Sidebar
- Width: 260px, permanent drawer
- Right border: `borderRight: 1px solid`, `borderColor: 'divider'`
- No shadow

### Detail panel (Drawer)
```tsx
<Drawer anchor="right" sx={{ width: { xs: '100%', sm: '50%', md: '40%' }, maxWidth: 600 }}>
```

---

## Icons

| Context | Size | How |
|---------|------|-----|
| Default UI | 20px | `fontSize="small"` |
| Tiny inline (meta) | 14-16px | `sx={{ fontSize: 14 }}` |
| Button icon | inherited | Via `startIcon` / `endIcon` prop |
| Empty state | 48px | `sx={{ fontSize: 48, color: 'text.disabled' }}` |
| Large empty state | 56px | `sx={{ fontSize: 56, color: 'text.disabled' }}` |

### Avatars
| Context | Size |
|---------|------|
| App bar | 32x32 |
| Activity feed | 28x28 |
| Dropdown item | 24x24 |
| Card assignee | 24x24 |
| Mini inline | 20x20 |

---

## Chips & Badges

| Type | Height | Font size | Radius |
|------|--------|-----------|--------|
| Task label (on card) | 20px | 0.7rem | 6px |
| Count badge | 20px | 0.7rem | 6px |
| Filter chip | 24px | 0.75rem | 6px |
| Standard chip | 28px | 0.8125rem | theme default |

---

## Motion

Minimal, functional transitions. Motion communicates state change, never decorates.

| Element | Property | Duration | Easing |
|---------|----------|----------|--------|
| Hover background | background-color | 150ms | ease |
| Border color change | border-color | 150ms | ease |
| Opacity fade | opacity | 200ms | ease |
| Dialog enter | transform + opacity | 200ms | ease-out |
| Drawer slide | transform | 250ms | ease-out |
| Collapse/expand | height | 200ms | ease |

### Rules
- Never animate color or font-size
- `transition: 'background-color 150ms ease'` on any hoverable surface
- `transition: 'border-color 150ms ease'` on cards that highlight on hover
- Avoid bounce/spring easing — this is a productivity tool, not a consumer app
- No entry animations on page load — content appears instantly
- Drag-and-drop transitions handled by dnd-kit (already configured)

---

## Hover & Interactive States

| Element | Idle | Hover | Active/Pressed |
|---------|------|-------|----------------|
| Card | `borderColor: 'divider'` | `borderColor: 'action.selected'` | — |
| Table row | transparent | `bgcolor: 'action.hover'` | — |
| Sidebar item | transparent | `bgcolor: 'action.hover'` | `bgcolor: 'action.selected'` |
| Icon button | transparent | `bgcolor: 'action.hover'` | — |
| Text link | `color: 'primary.main'` | underline | — |

### Focus
- Use MUI's built-in focus-visible ring (`:focus-visible` outline)
- Never remove focus indicators
- Primary color focus ring on interactive elements

---

## Anti-Patterns (Do Not)

- **No raw hex in components** — all colors via theme tokens or named constants
- **No `elevation` > 0 on cards** — use `variant="outlined"` instead
- **No Stack** — use Box with flex
- **No Tailwind classes** — MUI `sx` only
- **No inline `style` props** — always `sx`
- **No custom scrollbar styling** — use browser defaults
- **No gradients** — flat, solid colors only
- **No blur/glass effects** — they hurt performance and readability
- **No icon-only buttons without `aria-label`**
- **No disabled buttons without a tooltip explaining why**
