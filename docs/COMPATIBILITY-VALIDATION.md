# Compatibility and appearance validation

Validated October 12, 2026 after the four behavior fixes, against the original handoff at `6943ce7` and the frozen pre-change fixtures. The only additional product change was the dependency-redraw guard committed as `5b8083b`, described below. No architecture extraction, storage migration, or styling change was made.

## Saved-data and interaction results

The combined regression run passed all 82 logic checks and 19 real Chromium scenarios with no TODOs. Six new browser scenarios in `tests/browser/compatibility.spec.cjs` verify complete workflows rather than relying on VM storage mocks:

| Scenario | Verified behavior |
| --- | --- |
| Frozen `sidequests-v1` example snapshot | Every original field survives loading; Save, actual JSON download, Undo, and real page reload preserve the expected state |
| Legacy string-owner snapshot | Shared contacts migrate through the existing helper; node IDs, references, content, and historical timestamps survive Save/reload/export/Undo |
| Leaf move and deletion | Notes, links, owners, tags, log IDs/timestamps, and card identity survive placement correction; downloaded exports match live state; Undo restores original placement/content and banks; final reload restores the original project |
| Embedded iframe | Editing, creation, movement, deletion, actual exports, and four consecutive Undos work in memory; browser storage remains untouched |
| Storage read failure | Memory editing and structural changes remain usable, exportable, and undoable without durable storage |
| Storage write failure after loading old data | Loaded data remains editable; exports contain current live state; Undo restores it; the existing stored snapshot is not overwritten |

Exports were downloaded through the browser and parsed, not reconstructed from a helper. They contain exactly `{project,nodes}`. Standalone storage retains `sidequests-v1` and `{project,nodes,seq}`. Undo remains session-only and empty after reload. Existing data fields are checked independently of the app's mutation methods for valid graph and bank references.

Save already fills absent optional legacy fields with defaults (`blockedBy`, `days`, `status`, `log`, and `tagIds`). Validation permits those exact existing defaults while checking every original field. This is existing normalization, not a schema migration or an excuse to rewrite historical values.

Tests use fresh nonpersistent contexts and built-in/synthetic fixtures only. Personal browser profiles and data were not accessed. The functional run uses Node.js 22.12.0, Playwright 1.58.2, and its pinned Chromium 145.0.7632.6.

## Appearance comparison

The separate visual run replays all 20 desktop/narrow reference scenes in Chromium 140.0.7339.16, the same build used for the original screenshots. All four sets of recorded viewport, graph, group, and canvas measurements match the original metadata exactly. All 20 image comparisons pass with Playwright's standard perceptual color threshold of `0.2`, allowing **zero** differing pixels above that threshold. This is not a claim of byte-for-byte identity or zero raw pixel variation.

Only the unsaved Log entry timestamp is normalized to the original capture time, `2026-10-12T13:17`; actual saved card and log history is unchanged. The natural-resolution capture uses the same temporary unclipped graph clone as the original reference. No image masks, baseline replacements, new CSS, or viewport/layout changes were used to make comparisons pass.

The report and per-image hashes are preserved in [validation/step-4/visual-comparison.json](validation/step-4/visual-comparison.json). Current screenshots and any future diff images are generated into ignored `test-results/`; the accepted files under `docs/screenshots/` are checked for unchanged hashes during comparison. Exact PNG identity can vary with hover/transition paint timing, so the report distinguishes identical files from comparisons within the documented threshold.

In the recorded run, 18 PNGs are byte-identical to their original files. The desktop Notes scene and natural-resolution map have minor hover/transition paint differences within the stated threshold; their layout geometry is unchanged. The strict zero-color-threshold diagnostic was reviewed before adopting the standard perceptual threshold, and references were not regenerated to hide those differences.

The existing clipped **Start new quest** action at 390 px and the expanded overview pushing the map below the initial viewport remain unchanged. They are known baseline limitations, not new regressions or approved desired behavior.

## Issue found and corrected

Validation exposed a group-scroll event after deletion but before the queued graph render. The previous position map still included the removed card, and `drawBlockingLinks()` tried to read its `blockedBy` field. A focused browser test reproduced the uncaught error deterministically. The one-line guard skips missing cards in a stale position map; the next render still draws every remaining saved dependency. The reproducer and full compatibility run pass after the fix.

## Commands and limits

```sh
npm test
npm run test:requirements
```

Visual reference comparison requires the same Chromium build and macOS/font environment as the reference capture. Supply the absolute path to that existing binary:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/path/to/chromium-140/headless_shell" npm run test:visual
```

The visual command rejects a different browser version and does not update snapshots. It is separate from `npm test`, which uses the current pinned Playwright browser for functional/geometry checks. Both runs start and stop the isolated local test server, and require the runtime Tailwind CDN to be reachable.

These results establish compatibility for the checked fixtures and flows. They do not establish arbitrary damaged-data recovery, JSON import, every graph/collision arrangement, other browser engines, touch behavior, or pixel equivalence on different operating systems and fonts. The manual checklist remains relevant for those cases.
