# Worked Examples

Additional worked coding examples beyond the single in-body example in `SKILL.md`. This file is loaded lazily (Level 3) only when a rule points here. Each example has a short sample input and the full marker-structured output (`WHAT_CHANGED` -> `VERIFIED` -> `ASSUMED` -> `CHECK`) following the Output Format contract.

The examples below are grounded in this workspace's real code. Every `VERIFIED` fact cites a file that was actually read, so the entries model the read-before-write rule instead of inventing facts.

## Example 1: Multi-file change (each marker scoped to the change)

**Sample input:**
> The `LANGUAGES` constant is defined twice, in the route and the page. Pull it into one shared module so there is a single source of truth.

**Sample output:**
```
WHAT_CHANGED:
Extracted the LANGUAGES constant (and its Language type) into a shared module so src/app/api/read/route.ts and src/app/page.tsx import one definition instead of duplicating it. Added the new shared file and updated both importers.

VERIFIED:
- src/app/api/read/route.ts declares `const LANGUAGES = ["English", "French"] as const;` followed by `type Language = (typeof LANGUAGES)[number];`.
- src/app/page.tsx declares the same `const LANGUAGES = ["English", "French"] as const;` and the same `type Language = (typeof LANGUAGES)[number];`.
- The two definitions are identical, so one shared module satisfies both call sites with no value change.

ASSUMED:
- (inferred) a `src/lib/` directory is the conventional place for shared modules in this workspace; I did not verify that the directory exists or that another shared-module location is already in use.

CHECK:
- Confirm the chosen path (for example src/lib/languages.ts) matches the workspace's existing shared-module convention; if a different shared location is already in use, import from there instead.
- Run the build to confirm both files still compile after the import switch and that no other file redefines its own LANGUAGES.
```

## Example 2: Empty marker section (the `(none)` placeholder)

**Sample input:**
> Rename the `loading` state to `isLoading` in src/app/page.tsx so the name reads as a question.

**Sample output:**
```
WHAT_CHANGED:
Renamed the loading state from `loading` to `isLoading` (and `setLoading` to `setIsLoading`) throughout src/app/page.tsx. Behavior is unchanged; only the identifier and its setter changed.

VERIFIED:
- src/app/page.tsx declares `const [loading, setLoading] = useState(false);`.
- `loading` is read in four places: the early-return guard `if (loading) return;` inside send(), the JSX loading indicator `{loading ? ... : null}`, the sample-fact button condition `!loading`, and the submit button `disabled={loading || !canSend}`.
- `setLoading(true)` runs before the fetch and `setLoading(false)` runs in the finally block, so every read site stays correct under the new name.

ASSUMED:
(none)

CHECK:
- Run the build to confirm no other file imports `loading` from page.tsx. page.tsx is a default export with no named exports, so this is unlikely, but a build verifies it.
```

## Example 3: User-supplied fact (attribution under ASSUMED)

**Sample input:**
> Add a config that pins the function region to the closest one. We're deploying to Vercel.

**Sample output:**
```
WHAT_CHANGED:
Added a `vercel.json` at the workspace root to pin a deployment region. The file declares a regions setting so the function runs in one region instead of the default.

VERIFIED:
- No `vercel.json` exists at the workspace root (confirmed by listing the root directory).
- package.json declares `next` 16.4.2 as a dependency, and next.config.ts already exists at the root alongside package.json.
- package.json lists no Vercel-specific dependency (no `@vercel/*` in dependencies or devDependencies).

ASSUMED:
- User-supplied, not read from source: "we're deploying to Vercel." No Vercel dependency or config exists in the code to confirm this, so it is marked as the user's fact, not the source's.
- Uncertain: the exact Vercel region string (for example cdg1) and whether a region pin is supported for this project's plan; I did not read Vercel's docs.

CHECK:
- Confirm with the user the exact Vercel region to pin.
- Verify the Vercel project is actually linked to this repo before relying on the config.
```
