# Task: Dark / Light mode

## Goal
Add a dark/light mode toggle to the app. The app currently uses a fixed light theme with hardcoded colors in CSS. This feature should let users switch between light and dark themes, with the preference persisted across page reloads.

## Acceptance criteria
- A toggle button is visible in the app header (e.g. "Dark" / "Light" label or sun/moon icon)
- Clicking it switches the entire UI between light and dark themes
- All surfaces update: background, header, buttons, grid cells, legend text
- Node states (empty, wall, start, end, visited, path) remain clearly distinguishable in both themes
- The selected theme is persisted in `localStorage` and restored on page load
- The app respects the OS-level `prefers-color-scheme` as the default when no preference is saved yet

## Technical notes
- Implement via CSS custom properties (`--color-*` variables) on `:root` / `[data-theme="dark"]`
  — this is the lowest-impact approach given colors are currently hardcoded in `App.css` and `Node.css`
- The toggle should set `data-theme="dark"` on `<html>` (or `<body>`) and save to `localStorage`
- A small `useTheme` hook in `src/hooks/useTheme.ts` can own the toggle logic and persistence
- The toggle button lives in `App.tsx` inside `.app__header`
- Node animation keyframes in `Node.css` also use hardcoded colors — these should be updated to use CSS variables so they look correct in dark mode
- Do not introduce a CSS-in-JS library or Tailwind; plain CSS variables are sufficient

## Out of scope
- Per-node or per-component theming
- Any animation on the theme transition (instant switch is fine)
- Changing the node color palette significantly — dark mode should feel consistent with the existing indigo/yellow/green/red scheme
