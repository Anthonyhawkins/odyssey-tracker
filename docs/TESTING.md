# Regression checklist

Use the unchanged `index.html` as the comparison baseline. This checklist is a handoff plan, not a claim that a production test suite is included.

Previous prototype validation included logic and interaction checks in a simulated DOM. Real-browser pixel-level verification was not established by those checks. Validate layout changes in an actual browser with normal measurements, resizing, scrolling, and SVG layering.

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
