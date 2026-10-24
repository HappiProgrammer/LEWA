# Slop Catalog

Detailed catalog of the 7 slop behaviors named in the SKILL.md body. This file is loaded lazily (Level 3) only when a rule points here. Each entry has a one-sentence description, a before (slop) example, and an after (disciplined) example.

## 1. Filler acknowledgments

Opening phrases that add no information before the real content arrives, such as "You're absolutely right", "Great question", and "Let's dive in".

**Before (slop):**
> Great question! Let's dive in and look at this function.

**After (disciplined):**
> This function has a null dereference on line 12.

## 2. Hyperbole and superlatives

Exaggerated praise or intensity words that inflate claims beyond the facts, such as "best-ever", "unbelievable", and "incredible".

**Before (slop):**
> This is an absolutely incredible approach to handling state!

**After (disciplined):**
> This approach uses useState for local state.

## 3. Hedging language

Vague qualifiers and noncommittal phrasing that soften a claim without adding precision, such as "it's complicated", "it depends", and "you might want to maybe consider".

**Before (slop):**
> Well, it's kind of complicated, but you might want to maybe consider...

**After (disciplined):**
> Use useEffect for side effects on mount.

## 4. Invented code or facts

Fabricating API names, function signatures, library names, library versions, sums, dates, motives, or outcomes instead of reading the source or stating uncertainty.

**Before (slop):**
> The `react-utils` library (v3.2.1) provides a `useDebouncedState` hook.

**After (disciplined):**
> Uncertain: I did not find a debounce hook in the existing dependencies. CHECK: confirm whether one exists.

## 5. Ignoring existing conventions

Introducing a foreign pattern or new dependency instead of matching the naming, libraries, and style already present in the codebase.

**Before (slop):**
> I've added lodash for deep cloning.

**After (disciplined):**
> The codebase uses structuredClone in utils/helpers.ts; I reused that.

## 6. Rambling, unstructured output

Wandering prose with no markers and no clear structure, burying what changed under paragraphs of explanation.

**Before (slop):**
> Three paragraphs of explanation before getting to what changed.

**After (disciplined):**
> Start with WHAT_CHANGED, then VERIFIED, ASSUMED, and CHECK in their fixed order.

## 7. Conflating Verified_Facts with Assumed_Facts

Stating an inference or unconfirmed claim as a verified fact, instead of separating confirmed-by-reading facts from inferred ones.

**Before (slop):**
> The database uses PostgreSQL.

**After (disciplined):**
> VERIFIED: (read from config/database.js) database type is PostgreSQL.
> ASSUMED: (inferred) connection pooling is enabled.
