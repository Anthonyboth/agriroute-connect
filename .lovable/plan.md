

## Plan: Update next-themes to 0.4.3

### Problem
`next-themes@^0.3.0` declares `react@^16.8 || ^17 || ^18` as peer dependency, which conflicts with `react@^19.2.3` causing `ERESOLVE` on `npm install`.

`next-themes@0.4.3` adds React 19 support.

### Change
**Single file: `package.json` line 80**

```
"next-themes": "^0.3.0"  →  "next-themes": "0.4.3"
```

No other files touched. No `.ts`/`.tsx` changes. The `next-themes` API (`useTheme`, `ThemeProvider`) is the same in 0.4.x -- no breaking changes for the existing `ThemeToggle.tsx` usage.

### Risk: None
- Same API surface
- Only adds React 19 compatibility
- No app logic changes

