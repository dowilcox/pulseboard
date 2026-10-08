# Upgrading MUI from v6 to v9

PulseBoard is on Material UI **6.5** (`@mui/material`, `@mui/icons-material`). The latest is **9.4**. This guide is the plan for that upgrade. It was written ahead of time, so re-run the [inventory](#inventory) before starting, because call-site counts drift as the code changes.

|              |                                                                         |
| ------------ | ----------------------------------------------------------------------- |
| **Status**   | Planned, not started                                                    |
| **Surveyed** | 2026-10-08, against Material UI 9.4.0 / `@mui/codemod` 9.4.0            |
| **Path**     | 6.5 → 7.3 → 9.4. **There is no v8**: MUI skipped it to align with MUI X |
| **Effort**   | Small to medium: about half a day to a day, plus visual and keyboard QA |
| **Risk**     | Mostly visual and keyboard behavior; compile errors are easy to find    |

## Overview

About 210 call sites need changes, and roughly 95% are handled by MUI's codemods. The rest are a few manual edits: an import path, four icon names, one theme override, and the Autocomplete `renderInput` callbacks.

Do it in three phases, committing after each one so any step can be reverted on its own:

1. **Move to v7.** Only one change applies: the `Grid2` import path.
2. **Clear deprecated APIs while still on v7.** v7 has both the old props and their `slotProps` replacements, so the codemod output compiles and the app keeps working.
3. **Move to v9.** This removes the deprecated APIs and changes the Autocomplete `renderInput` params, the icon names, and some behavior.

## Prerequisites

These are already met. Check that nothing has regressed:

- React 19, Emotion 11 (`@emotion/react` ≥ 11.5, `@emotion/styled` ≥ 11.3) and TypeScript ≥ 4.9. MUI 9's peer dependencies accept React 17–19.
- **v9 raises the minimum browsers** to Chrome 117, Edge 121, Firefox 121 and Safari / iOS 17.0. Confirm that's acceptable for your users.
- Keep `@mui/material` and `@mui/icons-material` on the same major version.

After each phase, run the usual checks:

```bash
npx tsc --noEmit
npm run test:run
npx vite build
```

The repo has no Prettier (only `.editorconfig`, 4-space indent), so check codemod output for formatting before committing.

## Inventory

Run these from the repo root to refresh the counts in this guide.

```bash
cd resources/js
grep -rn '@mui/material/Grid2' .                                         # Phase 1
grep -rnE '@mui/icons-material/[A-Za-z]+Outline"' .                      # Phase 3: removed icons
grep -rnoE '(primary|secondary)TypographyProps' . | wc -l                # codemod
grep -rnE 'renderTags|getTagProps' . | wc -l                             # codemod
grep -rnoE 'params\.(inputProps|InputProps|InputLabelProps)' . | wc -l   # Phase 3: manual
grep -rnE '\b(imgProps|TransitionProps|inputProps)=' . | wc -l           # codemod; Select inputProps stay
grep -rn 'outlinedPrimary' theme/                                        # manual
grep -rn '<ListItemIcon' . | wc -l                                       # QA: spacing change
```

As of the survey:

| What                                                                                 | Count               |
| ------------------------------------------------------------------------------------ | ------------------- |
| `@mui/material/Grid2` imports                                                        | 3                   |
| System props on `Typography` / `Link` (`color`, `fontWeight`, `fontSize`, `display`) | about 180, 47 files |
| `ListItemText` `primaryTypographyProps` / `secondaryTypographyProps`                 | 10                  |
| Autocomplete `renderTags` / `getTagProps`                                            | 4 sites             |
| Autocomplete `renderInput` using `params.inputProps` / `params.InputProps`           | 10 sites, 9 files   |
| `Avatar` `imgProps`                                                                  | 3                   |
| `Switch` `inputProps`                                                                | 3                   |
| `TextField` `inputProps` (non-Autocomplete)                                          | 1                   |
| `Snackbar` `TransitionProps`                                                         | 1                   |
| Theme `MuiButton.styleOverrides.outlinedPrimary`                                     | 1                   |
| Removed `*Outline` icon imports                                                      | 4                   |
| `<ListItemIcon>` (QA only)                                                           | 13                  |

## Phase 1: move to v7

```bash
npm install @mui/material@^7.3 @mui/icons-material@^7.3
```

### `Grid2` becomes `Grid`

`@mui/material/Grid2` no longer exists in v7. The component it exported is now `@mui/material/Grid`, and the old Grid is now `GridLegacy`. The `size={{ xs: 12, md: 6 }}` API is unchanged. No codemod does this rename: `v7.0.0/grid-props` only converts props on the old Grid, which this app doesn't use.

The 3 files are `Pages/Admin/Dashboard.tsx`, `Pages/Teams/Index.tsx` and `Pages/Teams/Show.tsx`:

```bash
grep -rl '@mui/material/Grid2' resources/js \
  | xargs sed -i '' 's#@mui/material/Grid2#@mui/material/Grid#'
```

(`sed -i ''` is the macOS form; on Linux use `sed -i`.)

Then update the docs:

- `CLAUDE.md`: replace the "MUI Grid v6 must be imported from `@mui/material/Grid2`" note with "Import Grid from `@mui/material/Grid`", and bump "MUI v6" in the stack line.
- `README.md`: bump the "MUI v6" mentions in Tech Stack and the frontend conventions section.

Nothing else in the v7 migration guide applies here. That was checked on the survey date:

- All imports are at most one level deep.
- The app doesn't use `Hidden`, `createMuiTheme`, `StyledEngineProvider`, `onBackdropClick`, `@mui/lab`, `InputLabel size="normal"`, the color helpers (`alpha`, `lighten`, `darken`) or theme module augmentation.

Run the checks, then commit.

## Phase 2: clear deprecated APIs (still on v7)

### 2.1 Run the codemods

Preview with `--dry` first. Run them in this order and review the diff after each:

```bash
npx @mui/codemod@latest deprecations/all resources/js --dry   # preview
npx @mui/codemod@latest deprecations/all resources/js
npx @mui/codemod@latest v9.0.0/system-props resources/js
```

You can run single transforms instead of `deprecations/all`: `list-item-text-props`, `autocomplete-props`, `avatar-props`, `switch-props`, `text-field-props` and `snackbar-props`, each prefixed with `deprecations/`.

What they change here:

| Before                                                                     | After                                                            |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `<Typography color="text.secondary" fontWeight={600}>` (also on `Link`)    | `<Typography sx={{ color: "text.secondary", fontWeight: 600 }}>` |
| `ListItemText primaryTypographyProps={…}` / `secondaryTypographyProps`     | `slotProps={{ primary: …, secondary: … }}`                       |
| Autocomplete `renderTags={(value, getTagProps) => …}`                      | `renderValue={(value, getItemProps) => …}`                       |
| `Avatar imgProps={…}`                                                      | `slotProps={{ img: … }}`                                         |
| `Switch inputProps={…}`                                                    | `slotProps={{ input: … }}`                                       |
| `TextField inputProps={…}`                                                 | `slotProps={{ htmlInput: … }}`                                   |
| `Snackbar TransitionProps={{ onExited }}` (`Contexts/SnackbarContext.tsx`) | `slotProps={{ transition: { onExited } }}`                       |

Notes:

- `system-props` keeps palette colors like `color="primary"` and `color="inherit"` as props on `Link` (those stay supported). Check any dynamic `color={…}` values by hand.
- All the `slotProps` targets above already exist in 7.3, so this phase compiles on v7.
- **Leave the Autocomplete `renderInput` callbacks alone in this phase.** In 7.3 the `params` still carry `InputProps` / `inputProps`; they only move under `params.slotProps` in v9. That rewrite is in [Phase 3](#32-autocomplete-renderinput-params).

### 2.2 Manual: theme `outlinedPrimary` override

v9 removes the variant/color combination class keys from `styleOverrides`. Move the override in `resources/js/theme/index.ts` into a `variants` entry on `root`:

```ts
// Before
MuiButton: {
    styleOverrides: {
        root: { textTransform: "none", borderRadius: harbor.radius.control, fontWeight: 700 },
        outlinedPrimary: {
            borderWidth: 1.5,
            "&:hover": { borderWidth: 1.5 },
        },
    },
},

// After
MuiButton: {
    styleOverrides: {
        root: {
            textTransform: "none",
            borderRadius: harbor.radius.control,
            fontWeight: 700,
            variants: [
                {
                    props: { variant: "outlined", color: "primary" },
                    style: { borderWidth: 1.5, "&:hover": { borderWidth: 1.5 } },
                },
            ],
        },
    },
},
```

### 2.3 Leave these as they are

These look like the props above, but they are still supported and not deprecated in 9.4. Don't change them:

- `Select` `inputProps` used for `aria-label`, 4 sites: `Components/Tasks/FilterBar.tsx`, `PrioritySelector.tsx`, and `TaskSidebar.tsx` (×2).
- `Drawer` `ModalProps={{ keepMounted: true }}` in `Layouts/AuthenticatedLayout.tsx`.

Run the checks, do a quick visual pass, then commit.

## Phase 3: move to v9

```bash
npm install @mui/material@^9.4 @mui/icons-material@^9.4
```

### 3.1 Removed `*Outline` icons

v9 removed 23 legacy icons named `…Outline`, which were duplicates of the `…Outlined` icons. Rename the imports (no codemod):

| File                                                       | Before                                    | After                                       |
| ---------------------------------------------------------- | ----------------------------------------- | ------------------------------------------- |
| `Components/Tasks/TaskCard.tsx`                            | `ChatBubbleOutline`, `CheckCircleOutline` | `ChatBubbleOutlined`, `CheckCircleOutlined` |
| `Components/Tasks/TaskSidebar.tsx`, `Pages/Teams/Show.tsx` | `CheckCircleOutline`                      | `CheckCircleOutlined`                       |

Only the import path needs to change; the local `…Icon` variable names can stay.

### 3.2 Autocomplete `renderInput` params

In v9, `AutocompleteRenderInputParams` no longer has `InputProps`, `inputProps` or `InputLabelProps`. They moved to `params.slotProps.input`, `params.slotProps.htmlInput` and `params.slotProps.inputLabel`. `tsc` will flag every site. There are 10, in:

- `Components/Gitlab/GitlabProjectSearch.tsx`, `GitlabSection.tsx` and `GitlabSidebarControls.tsx`
- `Components/Tasks/AssigneeSelector.tsx`, `DependencySection.tsx`, `FilterBar.tsx` and `LabelSelector.tsx`
- `Pages/Admin/Teams.tsx` and `Pages/Teams/Settings.tsx`

**Spread `params.slotProps` and each slot you override.** `{...params}` already passes `params.slotProps` to the `TextField`. Passing your own `slotProps` afterwards replaces that whole object. If you drop `params.slotProps.input`, you lose the input's `ref`, which anchors the popup, and its `onMouseDown` handler.

Overriding the `aria-label` on the HTML input (for example `LabelSelector.tsx`, `AssigneeSelector.tsx`, `DependencySection.tsx`):

```tsx
// Before (v6/v7)
<TextField
    {...params}
    inputProps={{ ...params.inputProps, "aria-label": "Add labels" }}
/>

// After (v9)
<TextField
    {...params}
    slotProps={{
        ...params.slotProps,
        htmlInput: { ...params.slotProps.htmlInput, "aria-label": "Add labels" },
    }}
/>
```

Adding an end adornment (for example `GitlabSection.tsx`, `Pages/Teams/Settings.tsx`, `Pages/Admin/Teams.tsx`):

```tsx
// Before (v6/v7)
<TextField
    {...params}
    slotProps={{
        input: {
            ...params.InputProps,
            endAdornment: (
                <>
                    {loading && <CircularProgress size={18} />}
                    {params.InputProps.endAdornment}
                </>
            ),
        },
    }}
/>

// After (v9)
<TextField
    {...params}
    slotProps={{
        ...params.slotProps,
        input: {
            ...params.slotProps.input,
            endAdornment: (
                <>
                    {loading && <CircularProgress size={18} />}
                    {params.slotProps.input.endAdornment}
                </>
            ),
        },
    }}
/>
```

If Phase 2's `text-field-props` codemod turned any `inputProps={{ ...params.inputProps }}` into `slotProps={{ htmlInput: { ...params.inputProps } }}`, it still needs the `...params.slotProps` spread and the `params.slotProps.htmlInput` source shown above.

Run the checks, then do the QA pass below before committing.

## QA after v9

These behavior changes don't show up as compile errors:

- [ ] **`ListItemIcon` default min-width drops from 56px to 36px** (13 uses: sidebar, admin nav, menus). Check alignment. Spots that already set `sx={{ minWidth: 36 }}` won't change.
- [ ] **`nativeButton` warnings in the dev console.** ButtonBase-based components now warn when `component` renders a different element than they expect. Watch the console on pages with:
    - `Button` / `ListItemButton` using `component={RouterLink}` (`Welcome`, `Error`, `Teams/Settings`, `Sidebar`, `AdminNav`)
    - `Button component="label"` (`Components/Common/ImageUpload.tsx`)

    If one warns, add `nativeButton={false}`. `RouterLink` (`Components/Common/RouterLink.tsx`) renders an `<a>`.

- [ ] **`MenuItem` now throws outside `Menu` / `MenuList`.** Every current use is inside a `Menu`, a `Select` or a `TextField select`; keep it that way.
- [ ] **Keyboard behavior:**
    - Enter/Space clicks on buttons now bubble to ancestors, and `onClick` receives a `MouseEvent`. Check buttons inside clickable cards (`TaskCard`, the dashboard cards) for double handling.
    - Menus and `Tabs` use roving `tabindex`. Test the account menu, card menus, the board/column menus, and any tabs.
- [ ] **Autocomplete inputs:** the label, assignee, dependency, filter and GitLab project pickers. Check chips, the clear button, popup position (this breaks if the input `ref` was dropped) and the loading spinner.
- [ ] **Snackbar** still runs its exit transition and clears the message (`SnackbarContext`).
- [ ] **`TablePagination`** labels are now formatted with `Intl.NumberFormat` (`Pages/Admin/Users.tsx`), so large counts show separators. Fine unless a test asserts the exact text.
- [ ] **`TextField select` labels** render a `<div>` instead of a `<label>`. Re-check the accessible names of the filter/priority/board/column selects.
- [ ] **Frontend tests:** MUI now detects jsdom by feature detection instead of `NODE_ENV === "test"`. Run `npm run test:run`, especially `ErrorBoundary.test.tsx` and `RichTextDisplay.test.tsx`.

Then commit, and update the "MUI v6" mentions in `CLAUDE.md` and `README.md` to v9 if Phase 1 didn't already.

## Rollback

Each phase is its own commit. To roll back, revert the commit, then run `npm ci` so `node_modules` matches the restored lockfile. Phase 2 also works fine on v7 without Phase 3, so stopping after Phase 2 is a safe resting point.

## References

- [Upgrade to v7](https://mui.com/material-ui/migration/upgrade-to-v7/)
- [Upgrade to v9](https://mui.com/material-ui/migration/upgrade-to-v9/)
- [Supported platforms](https://mui.com/material-ui/getting-started/supported-platforms/)
- [`@mui/codemod` README](https://github.com/mui/material-ui/tree/master/packages/mui-codemod)
