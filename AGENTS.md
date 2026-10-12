# Instructions for working on Odysseus Tracker

## Read first

Read `README.md` and the relevant sections of `REQUIREMENTS.md` before changing behavior. For graph/layout changes, also read `docs/DESIGN-DECISIONS.md` and `docs/TESTING.md`. `index.html` is the accepted prototype baseline.

## Working approach

- Make focused, reviewable changes. Preserve current behavior and appearance unless the task explicitly changes them.
- Do not start a framework rewrite, add a backend, or change the product's scope without a concrete request.
- Keep the app usable when browser storage is unavailable and in embedded previews. In-memory state is authoritative; saving must not block editing.
- Update these documents when intentionally changing a product rule. Distinguish existing behavior from proposed work.
- Use Git checkpoints and avoid unrelated cleanup in feature changes.

## Graph invariants

- Keep the main questline central and visually thicker. Preserve smooth flowing curves.
- Space objectives relative to their own questline, not a global order that pushes unrelated work down.
- Branches continue independently and merge back into their originating parent questline.
- Draw a merge after the source branch's work and retain its anchored historical position when later objectives are added.
- Avoid large global lane gaps or jagged obstacle-routing detours. Accepted collision handling widens nearby lanes where groups overlap them vertically.
- Keep white-filled start/merge node circles above paths. `!` marks starts; `?` marks merges in the source questline's color.
- Parallel groups can exist on main, side, and nested questlines. Keep their grids balanced with at most three rows and preserve all three density modes.
- Group headers contain `.` and `!` actions. Do not add per-card quest action strips inside a group. Put normal endpoint controls below an open group when there is no existing serial continuation.
- Render every saved blocker relationship, including those within groups and those whose blocker is complete; visually distinguish resolved dependencies.

## Data and mutation safeguards

- Preserve stable card/contact/tag IDs, graph references, timestamps, and existing saved-data compatibility.
- Preserve the `sidequests-v1` storage key or migrate it explicitly. Export shape and storage shape differ; see README.
- Structural changes must keep `parent`, `children`, and parallel references consistent and prevent cycles/dangling references.
- Delete only an eligible single card. Retain guards for roots, children, blocker dependents, parallel anchors, merge records/anchors/origins, and abandonment records.
- Move only eligible leaf objectives. Retain review/confirmation, unsaved-edit protection, closed-questline restrictions, cycle prevention, and stale-plan revalidation.
- Moves preserve content, ID, blocker references, and historical timestamps; Undo restores the original placement.
- Preserve shared contact/tag bank semantics, card-editor Save/Cancel behavior, and session Undo.
- Escape user text in generated HTML. Preserve link scheme validation and safe external-link attributes. Notes/logs remain plain text unless explicitly changed.

## Validation

Use `docs/TESTING.md` for affected flows. Run meaningful logic checks for structural changes and real-browser checks for rendering, sizing, scroll, and layering changes. Test both standalone persistence and embedded/memory-only editing when relevant.

Do not describe logic tests as visual browser verification. If a check cannot be run, report that limitation. Use the documented commands in `docs/TESTING.md`: `npm run test:logic`, `npm run test:browser`, and the combined `npm test`. Report known TODO assertions separately from passes; `npm run test:requirements` makes those requirements strict.

## Local run

From the repository root: `python3 -m http.server 8000`, then open `http://localhost:8000`. No build step is needed for the baseline.
