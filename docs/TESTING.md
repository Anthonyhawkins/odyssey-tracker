# Regression checklist

Use the unchanged `index.html` as the comparison baseline. A focused automated regression suite now accompanies this manual checklist; it does not replace the remaining manual scenarios or constitute exhaustive production validation.

Previous prototype validation included logic and interaction checks in a simulated DOM. Real-browser pixel-level verification was not established by those checks. Validate layout changes in an actual browser with normal measurements, resizing, scrolling, and SVG layering.

## Local application checks

Requires Go 1.24 or newer, plus the frontend browser prerequisites below:

```sh
go test -race ./...
go vet ./...
npm run build:local
npm run test:local
```

Go checks cover configuration, file CRUD, revision conflicts, concurrent saves, malformed graphs, compatible exports, legacy fields, traversal/symlink rejection, session/host checks, script escaping, and atomic-write failure preservation. The local real-browser checks cover offline welcome and project CRUD, stale-save export, failure recovery with live edits, a copied binary running outside the repository and restoring its last project after process restart, rapid structural/content saves followed by Undo, and config-backed backdrop persistence without changes to project data or Undo.

The local suite uses port 8766 and temporary data folders; it never opens the user's application folder. Its artifacts go to ignored `test-results-local/`. Build again after frontend changes because assets are embedded at compile time. Cross-compilation verifies compilation only; Windows and Linux binaries still require tests on those operating systems.

The initial Go transition passed the race-enabled Go suite and vet, all five local browser scenarios, the original 82 logic and 19 browser checks, and all 20 appearance comparisons in the original Chromium 140 environment. Coverage is limited to these scenarios.

## Automated regression checks

Requires Node.js 22 or newer. From the repository root:

```sh
npm ci
npm run test:browser:install
npm test
```

The pinned development dependency and `package-lock.json` make installation reproducible. Browser installation downloads Playwright's Chromium into the user cache. Browser tests start their own test-only server on `127.0.0.1:8765` and close it afterward. The port must be free. Every test uses a fresh, nonpersistent browser context; personal browser profiles and project storage are untouched.

| Command | Purpose |
| --- | --- |
| `npm run test:logic` | Node's built-in runner; no npm dependencies or browser installation needed |
| `npm run test:browser` | Real Chromium interactions, measured geometry, persistence, and memory-only flows |
| `npm test` | Logic followed by browser checks |
| `npm run test:requirements` | Focused execution of the seven original gap regressions; all now pass |
| `npm run test:visual` | Separate comparison with the 20 captured reference scenes; requires their Chromium 140 build and matching capture environment |

Tailwind is bundled locally; browser rendering checks require no CDN. Tests explicitly wait for utility CSS; missing CSS is a test failure, not an accepted unstyled result. For a managed environment with an existing Chromium binary, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` may supply its absolute executable path. Prefer the pinned browser installed by the command above for comparable results.

Browser screenshots, failure traces, and runner output go into ignored `test-results/`. Reference screenshots under `docs/screenshots/` are never automatically overwritten. The default suite asserts interaction and geometry invariants. The separate visual suite compares reference images with a perceptual color threshold of `0.2` and allows zero differing pixels above that threshold; it also requires exact recorded geometry. See [compatibility and appearance validation](COMPATIBILITY-VALIDATION.md) for the browser-version requirement, timestamp normalization, results, and limitations.

### Background selector validation

The background change passed all 82 logic checks, the 19 existing browser scenarios, four focused background scenarios at 1600px/390px in static and embedded modes, all six local-app browser scenarios, Go race checks, and vet. Real Chromium screenshots of the backdrop were inspected at desktop and narrow widths. Checks compare graph paths, geometry, snapshots, Undo, and saved file revisions before/after background changes, and load the actual PNG. The original pixel-reference suite was not rerun for this change because the requested toolbar control intentionally changes those screenshots; reference files were left untouched.

### PDF export validation

Browser checks generate actual Chromium PDFs with `preferCSSPageSize` and background colors. They verify expanded Normal cards, all 24 members of a wide parallel group, dependency paths/opaque markers, literal safe text, multipage notes/log appendix, custom map and A4 page dimensions, and preservation of live state/storage/Undo. Tests also check open drafts, blocked/denied pop-ups, retry after print cancellation, and refusal of oversized maps. The local suite verifies export from the embedded binary without changing the project file or revision.

The native print dialog is stubbed in automated tests; calling Print and retry are verified separately from actual headless PDF generation. A generated PDF was read with macOS PDFKit to verify searchable card/notes/log text and page dimensions; rendered map/appendix pages were visually inspected. This does not claim manual native-dialog or cross-browser verification. Original pixel references were not regenerated because the requested Export PDF header control intentionally changes the chrome.

Validation passed: 82 logic checks, 23 established browser scenarios, four PDF export scenarios, seven local-app scenarios, and Go race tests/vet. The 140-line notes fixture produced five searchable PDF pages (one map and four A4 appendix pages), including the final note and log entries.

For manual validation, save a PDF through the real browser dialog, check mixed page sizes, every group member, full descriptions/URLs/timestamps, long notes/log pagination, and unchanged working state after both saving and canceling. Try popup denial and standalone/embedded/file-backed modes. Settings vary by browser; see the [user guide](USER-GUIDE.md#12-export-an-expanded-map-as-pdf) and [MDN printing guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing).

### Quest states and category validation

The current editor offers Planning, Ready, In Progress, In Review, and Complete, with conditional legacy Undefined support. Focused checks cover saving/reloading each state, completion/reopening history, Undo and moves, legacy edits, derived blocker/abandonment display, and Operations/Bug icons. Real Chromium checks exercise every state and both categories at all three densities in standalone and embedded modes; local-file checks reload every state from disk. PDF checks include an In Review/Bug card. The In Review rendering was inspected in a browser screenshot. Validation passed: 95 logic checks, 29 Chromium browser scenarios, eight local-app scenarios, and Go race tests/vet. Original prototype references remain unchanged; current lifecycle labels and new icons are intentional UI changes.

### Logic coverage

- The helper loads the actual inline `questApp()` from `index.html` into an isolated VM. It defers DOM/render callbacks and emulates storage/export boundaries; it does not duplicate product methods or claim visual verification.
- Independent graph validation checks IDs, reciprocal parent/child lists, parallel/blocker/merge references, bank references, and structural cycles after ordinary mutations.
- Tests cover additions and branch-relative positioning, 4/9/24-member row allocation in all density modes, density persistence, deletion/move guards, confirmation revalidation, cancellation, full content/timestamp preservation, group dissolution, and Undo.
- Frozen example and synthetic legacy-owner fixtures cover `sidequests-v1`, export/storage shape differences, owner migration, safe ID allocation with an old sequence, optional storage, shared banks, editor drafts, log validation, safe links, replacement confirmation, and the 50-snapshot Undo limit. See [fixture provenance](../tests/fixtures/README.md).

### Browser coverage

- Complete baseline/legacy save, actual download, Undo, and real reload workflows; moves/deletion with rich content; embedded and storage-read/write failure exports and structural Undo.
- Central trunk thickness, curved paths, opaque markers after paths in SVG order, group header actions, and external endpoint placement.
- Nested merge to the parent lane, source work before the merge, and stable earlier merge anchoring after a destination append.
- Actual 24-card rendering in all densities, access to the last card through scrolling, adjacent card clearance, editor access, and saved density after reopening the origin.
- Dependencies across lanes and within a group, retained resolved connectors, and connector endpoint changes/alignment during horizontal group scrolling.
- Legacy storage loaded into a real page; saved notes survive reopening the origin, while Cancel preserves storage.
- Embedded iframe and storage-access failures: Add log updates the draft, Save applies it in memory, and Cancel discards a later edit.
- Overview sizing, adjacent desktop drawers, mutually exclusive Notes/Log, and narrow overlays.

### Original requirements gaps and their fixes

These executable desired-behavior assertions remain in `tests/logic/known-gaps.test.cjs` with their original G1–G4 labels. All seven now run as ordinary regressions with no TODO classifications. `npm run test:requirements` runs this focused set; it now succeeds.

| Gap | Assertions | Required behavior |
| --- | --- | --- |
| G1: editor completion history (fixed) | G1a, G1b | Completion through Save sets `completedAt`; reopening handles the applicable timestamp consistently with endpoint completion |
| G2: parallel closure (fixed) | G2 | A parallel follow-up inherits abandonment closure from its owning questline |
| G3: merge tip after a move (fixed) | G3 | Rejoin targets the actual destination endpoint after moving an older-ID leaf after newer work |
| G4: Undo in dialogs (fixed) | Three G4 cases | Keyboard application Undo is suppressed in contact, tag, and insights dialogs |

The accepted original is preserved at checkpoint `6943ce7`. G1–G4 are fixed in the current implementation. Full manual checks, broad graph collision coverage, touch/pan behavior, other browsers, and pixel comparisons remain outstanding.

### Initial validation results

Validated October 12, 2026 with Node.js 22.12.0, Playwright 1.58.2, and its pinned headless Chromium 145.0.7632.6:

- Logic: 61 passes and seven executed TODO assertions; no unexpected failures.
- Browser: all eight scenarios pass, including 24-card rendering in all densities, dependency scrolling, and embedded/storage-failure editing.
- Strict known requirements: seven failures, reproducing G1–G4 as documented above.
- `index.html` remains byte-for-byte identical to accepted checkpoint `6943ce7`.

The reference screenshots were captured earlier in Chromium 140.0.7339.16. They remain unchanged; this suite uses geometry/interaction checks rather than treating cross-version pixel differences as acceptance results.

### Completion-history and dialog Undo corrections

On October 12, 2026, G1 and G4 were promoted to ordinary regression assertions. Logic validation reports 68 passes with two remaining TODOs (G2/G3); all ten Chromium scenarios pass. New checks include completion at card creation, preservation of legacy history, Undo of a completion transition, visible editor history, and keyboard behavior on active dialog buttons.

### Owning-questline closure correction

G2 now runs as an ordinary regression assertion. Logic validation reports 77 passes with one remaining TODO (G3); all eleven Chromium scenarios pass. Added checks cover both merged and abandoned owning lines, parallel follow-ups, stale Add/Move confirmation, local parallel termination, independent nested side quests, disabled controls, and Undo restoration.

### Merge anchoring correction and completed gap fixes

G3 now runs as an ordinary regression assertion. Final logic validation reports 82 passes with no TODOs; all twelve Chromium scenarios pass, and the seven focused requirement regressions pass. New cases exercise moves of older-ID leaves into main and side questlines, subsequent nested rejoins and appends, independent parallel paths, ambiguous destinations, saved merge history, and Undo. The browser move/rejoin/append scenario confirms that the merge is after the moved destination card and retains its anchor, coordinate, order, and timestamp after later work is added.

All four original gap areas are fixed. Markup, CSS, the existing layout/routing formulas, frozen compatibility fixtures, and accepted reference screenshots were preserved. No storage migration or architecture extraction was introduced.

### Dependency redraw during deletion

End-to-end compatibility validation reproduced a group-scroll event between deleting a card and the next render. The prior measured position map still included the removed card, causing `drawBlockingLinks()` to read its missing `blockedBy` field. The renderer now ignores positions whose cards no longer exist. A deterministic Chromium regression fires that scroll before rerender and verifies that the remaining saved dependency still draws without an uncaught error.

### Compatibility and reference comparison

Step 4 validation reports 82 logic passes, 19 Chromium scenario passes, and 20 reference-image comparisons within the documented visual threshold, with exact reference geometry. Details, report hashes, normalization rules, and remaining limitations are in [COMPATIBILITY-VALIDATION.md](COMPATIBILITY-VALIDATION.md). The original fixtures and screenshots remain unchanged.

## Baseline setup

Completed baseline capture on October 12, 2026 against unchanged prototype commit `6943ce7`. See [browser references and observations](screenshots/README.md). These checked setup items record work performed, not a pass for the full regression checklist below.

- [x] Serve the app locally and load the example. Commit a Git checkpoint before changes.
- [x] Capture screenshots for the full map, main parallel group, pink observability group, nested branch, merge node, undefined card, and Notes/Log drawers.
- [x] Check wide desktop and narrow viewport behavior, with overview expanded and collapsed. Existing narrow-layout limitations are recorded with the screenshots.
- [ ] Keep personal project data separate. Export it before destructive testing; export does not currently have a matching import UI.
- [x] Test changes in a fresh browser profile/origin when useful; avoid overwriting personal storage while resetting the example. Captures used an isolated browser context with only built-in example data.

## Map and layout

- [ ] Main questline stays central/thicker; ordinary branches remain close and readable.
- [ ] Add serial work on a side questline and verify placement is relative to that questline.
- [ ] Add a side quest and a nested side quest; each advances independently without making its parent blocked automatically.
- [ ] Rejoin a nested branch into its parent side questline, not main.
- [ ] Source merge exits after its work. Add later destination objectives and confirm the earlier merge remains before them.
- [ ] Start/merge nodes have opaque white fill, correct symbol/color, and sit above paths.
- [ ] Add a large group near other lanes: no cards/lanes cover it; unrelated lanes do not spread excessively.
- [ ] Curves remain smooth at zoom levels and across lane reuse/merges.
- [ ] Pan, zoom, center, fit, and relationship focus work; map fills available height.
- [ ] Background choices show the original dotted grid, a plain canvas, or the bundled map backdrop without moving cards/paths. Check pan/zoom/fit in backdrop mode, reload persistence in Go/static mode, and embedded session editing. Old configs default to the grid; changing the preference leaves project data and Undo intact.

## Groups

- [ ] Create groups on main, a side quest, a nested questline, and a questline start.
- [ ] Add enough objectives to test 4, 9, and 24 cards; rows differ by at most one card and never exceed three.
- [ ] Scroll horizontally to reach all members; connectors stay aligned.
- [ ] Check Normal, Compact, and Very compact; reduced summaries retain full editor access.
- [ ] Explicit density selection survives edits/reload in standalone mode.
- [ ] Header `.` adds a parallel objective and `!` adds a side quest.
- [ ] No per-card quest action strips or labels above cards break alignment.
- [ ] An eligible open group exposes external `? ! . ×` controls and Rejoin parent when applicable.
- [ ] External `.` continues the owning questline outside the group; an existing serial continuation suppresses duplicate endpoint controls.
- [ ] Remove/move a member, rebalance, and verify a one-card group becomes a regular card.

## Cards, dependencies, and banks

- [ ] Create/edit/save/cancel all basic fields and all three states. Undefined has a dotted outline.
- [ ] Unexpected Issue uses the intended warning category icon, not a special lifecycle state.
- [ ] Color swatches affect lines, nodes, and card borders consistently.
- [ ] Add a blocker between separate lanes, within a group, and between groups; red dotted lines appear.
- [ ] Complete the blocker: the relationship remains visible and resolves; blocked badges are red when active.
- [ ] Add/edit/remove links; reject unsupported URL schemes; labels render as text.
- [ ] Create a contact and assign it to two cards. Rename it and verify both update.
- [ ] Remove one assignment: bank entry remains. Remove bank entry: assignments clear.
- [ ] Repeat shared update/remove tests with colored tags.
- [ ] Check applicable card/merge/abandonment date-and-time labels and local formatting.

## Notes and Log

- [ ] Open Notes to the left of card details, then Log. Only one auxiliary drawer is open; narrow viewport overlay is usable.
- [ ] Enter multiline plain text and save the card. Reopen and verify exact text.
- [ ] Add/edit/delete log entries, change entry timestamp, and check newest-first ordering and edited label.
- [ ] Empty text or invalid date produces a visible validation error.
- [ ] Adding an entry to the draft works in embedded preview. Save changes persists it; cancel discards it.
- [ ] Text that resembles HTML renders as text rather than executable markup.

## Abandonment and deletion

- [ ] Abandon an endpoint with a reason/date; reject missing/invalid input.
- [ ] Show termination history, preserve prior work, allow reason/date editing, and close further progression.
- [ ] Undo abandonment restores prior state.
- [ ] Delete an eligible leaf and an eligible empty side quest after confirmation.
- [ ] Block deletion for main root, children, blocker dependents, parallel anchors, merge records/anchors/origins, and abandonment records; reasons are clear.
- [ ] Cancel deletion makes no change. A relationship added after dialog opening blocks confirmation.
- [ ] Undo restores full content, links, notes, logs, assignments, position, and group membership; banks survive deletion.

## Leaf objective moves

- [ ] Move an eligible objective to another open group; it becomes a parallel member.
- [ ] Move one to another open questline's unambiguous endpoint; it becomes serial.
- [ ] Review From/To and cancel without change; confirm only the reviewed valid plan.
- [ ] Keep stable ID, card content, status, owner/tag assignments, history timestamps, and blocker references.
- [ ] Destination color is inherited; source group rebalances/dissolves; previous merges do not shift.
- [ ] Undo restores the full original placement and content.
- [ ] Block root/side-root moves, child/parallel/merge anchors, recorded termination, closed source/destination, no-op destination, ambiguous endpoints, and cycles.
- [ ] Unsaved card edits block movement until saved/canceled.
- [ ] Mutate source/destination after review and verify confirmation requires a fresh review or rejects the move.

## Persistence, Undo, and export

- [ ] Standalone edits survive reload on the same origin under `sidequests-v1`.
- [ ] Embedded preview and storage-failure fallback still support create/edit/log/bank/move/delete actions without durable saving.
- [ ] Memory-only notice is visible; reload behavior is explained.
- [ ] Undo works through toolbar/toast and Ctrl/Cmd+Z where appropriate; typing in fields retains normal text undo.
- [ ] Loading an example or replacing the project asks first and supports Undo.
- [ ] JSON export parses and includes project banks and all current nodes; do not expect `seq` or Undo history in it.
- [ ] Refactoring retains compatibility with a pre-refactor standalone snapshot.

## Recommended automation priorities

1. Graph invariants: unique IDs, valid parent/children/parallel/blocker/merge references, no structural cycles.
2. Merge anchoring under destination appends and branch-relative layout.
3. Move/delete eligibility, stale confirmation checks, exact content/timestamp preservation, and Undo.
4. Group membership, balanced row allocation, density persistence, and endpoint controls.
5. Browser tests for real card sizes, smooth curves, node layering, group scroll/blocker alignment, and memory-only Add behavior.
6. Persistence/export compatibility and draft Save/Cancel semantics.

Introduce an actual test runner and documented commands when adding automation. Do not commit scratch-only validation scripts as if they were a portable suite without adapting their dependencies and fixtures.
