# Odysseus Tracker — product requirements

Prepared October 12, 2026 from the accepted prototype and its iteration history. These requirements describe the current product baseline. “Must” records behavior to preserve during future work; it does not imply every scenario has exhaustive automated coverage. Resolve any discrepancy by inspecting the implementation and making the decision explicit rather than silently changing the product.

## 1. Purpose and terms

The product must expose the additional work and inefficiency involved in enterprise delivery while keeping progress toward the primary goal understandable.

| Term | Meaning |
| --- | --- |
| Main quest | The project's primary delivery goal and central questline |
| Objective | A unit of work on an existing questline |
| Side quest | Additional supporting or unexpected work on an independent branch |
| Parallel objective group | Multiple objectives at the same point on one questline, visually grouped together |
| Completion | The card's work is done; completing a card alone is distinct from merging a branch |
| Merge/rejoin | A side questline rejoins the questline it originally branched from |
| Blocker | An explicit dependency on another card; branching alone is not blocking |
| Abandonment | Work on the questline was terminated; retain what happened, why, and when |
| Owner | A person assigned to the card, selected from the project contact bank |

## 2. Project and overview

- Support creating one active project with a name, goal/definition of done, and questline color. The local Go application keeps multiple projects in separate JSON files.
- Use the Odysseus Tracker name and Greek-inspired blue-and-white accents.
- Show explanatory sidebar definitions for main quest, side quest, objective, completion, abandonment, and parallel objectives.
- Allow the overview/metrics to collapse so the map has more space.
- Let the map fill the remaining viewport space and retain zoom, pan, center, and fit controls.
- Offer a Background selector: `dotted-grid` (default), `none`, or `backdrop` using the bundled `map.png`. The backdrop covers the viewport without repeating; background changes do not alter graph geometry or project data. Remember the application preference in `config.yaml` for Go mode, browser storage for static mode, and session memory for embedded previews.
- Do not restore the removed redundant “Quest tree / Independent lanes” legend row above the controls.
- Ask before replacing the current project or loading the example. Support Undo for replacement within an active file. In Go mode, New project creates a separate file; switching files starts a separate session Undo history.
- Show total work, side-quest share, completion, and manually estimated cumulative delay. Do not present cumulative estimates as a schedule forecast or critical path.

## 3. Questline structure and visual flow

### 3.1 Independent branches

- Keep the main questline central and thicker than side questlines.
- A serial objective is added to the same questline; it must not automatically become a side quest.
- A side quest creates an independent branch and may itself have nested side quests or parallel objectives.
- Determine vertical placement relative to work on that questline. Adding work on a separate branch must not force all subsequent cards lower by global creation order.
- A branch must not automatically block its parent. Only explicit blocker relations represent blocking.
- Reuse an available nearby lane when earlier work in that region has finished, rather than always selecting the farthest unused lane.

### 3.2 Lines and nodes

- Use smooth, flowing Git-style curves rather than zigzags or crooked joins.
- Mainline thickness is approximately 7 px in the baseline; side paths approximately 2.5 px.
- Questline color applies consistently to paths, circle/node accents, and card top borders.
- Start nodes show a circled `!` with a white background and questline-colored symbol.
- Merge nodes show a circled `?` in the color of the questline being merged.
- Circles must be large enough, filled, and drawn above line paths so lines do not intrude into the symbols.
- A card's category icon appears in an offset badge near the upper-left corner. Do not confuse category badges with questline topology nodes.

### 3.3 Endpoint controls

At an eligible open endpoint, present the quest actions: `?` complete, `!` create side quest, `.` add serial objective, and `×` abandon questline. Side quest endpoints also offer Rejoin parent. Actions must not be repeated under every intermediate card.

Parallel-group exceptions are specified below: header `.`/`!` actions operate on the group, while normal endpoint controls live outside it.

### 3.4 Merging

- Merge to the originating parent questline, including when it is a side questline, rather than routing all branches to main.
- Draw the merge after the source questline's descendants/work. Do not suggest that the merge happened before that work.
- Anchor the merge event to a fixed historical position on the destination. Appending later objectives must not move an earlier merge to the new endpoint.
- Determine the destination's serial endpoint from parent/child placement, including after moving an older card after newer work. Separate parallel paths are not competing endpoints. If that destination path has multiple serial endpoints, require its placement to be resolved before rejoining.
- Record merge time and show it in the map/history.
- Retain merge-related references during refactoring and protected structural mutations.

### 3.5 Collision handling

- Large objective groups must not be covered by neighboring lanes/cards.
- Use selective horizontal lane clearance where a group and nearby lane content overlap vertically. Avoid uniformly increasing all lane spacing.
- Preserve smooth curves when adjusting spacing. Do not reintroduce the rejected vertical stretching and obstacle-detour routing without an explicit new design decision.
- Real-browser visual review is required for changes to layout, card measurements, layering, or scroll behavior.

## 4. Parallel objective groups

- Offer a `+` action at eligible open questline nodes to create a parallel objective at that point.
- Allow groups on main, side, and nested questlines, including at questline starts.
- Show a subtle container tinted to the owning questline, indicating that its objectives share one point on that questline.
- Use at most three rows. Keep row populations balanced, differing by no more than one card; allow as many columns as fit and horizontal scrolling for overflow.
- Support at least a 24-card scenario without losing access to cards or controls. This is a validation target, not a hard limit on stored group size.
- Group header has `.` to add an objective to that group and `!` to create a side quest. Do not place per-card “add objective”, “create side quest”, or `? ! . ×` controls inside the box.
- An open group endpoint without an existing serial continuation must expose normal endpoint actions below the container, and Rejoin parent on a side questline.
- Adding a serial objective with the external `.` continues the owning questline outside the group.
- Keep follow-up relationship information in details/tooltips rather than extra labels above cards that break alignment.
- After deletion or movement, rebalance the group. A remaining single card becomes a regular card.

### Density options

| Mode | Baseline content and scale |
| --- | --- |
| Normal | Full summary card with expandable details; approximately 300 px wide |
| Compact | Smaller title/status/category icon plus owner/tag counts and Details; approximately 208 px wide |
| Very compact | Title/category icon/status; approximately 168 px wide |

Reduce spacing and type size with density. All modes retain access to the full editor by clicking the title. Save explicit density on the group anchor. Without an explicit selection, groups over three members default to Compact; smaller groups default to Normal.

## 5. Card fields, states, and categories

- Support title, short description/requirement, category, delay estimate, and card state.
- Provide In progress, Undefined, and Complete states. Undefined uses a dotted card outline.
- Derive blocked display from the explicit dependency, while preserving the underlying card state.
- Show date and time for applicable Created, Updated, Completed, Merged, and Abandoned events, using consistent local formatting.
- Record completion time when a card transitions to Complete, including through editor Save. Reopening clears the applicable completion time consistently with endpoint completion. Ordinary edits preserve existing history; do not invent missing historical completion dates for legacy cards.
- Preserve historical timestamp values across moves; placement correction does not create a new card or rewrite its history.
- Use Tailwind `-500` swatches for questline and tag color selection instead of a free-form color picker.
- Use suitable embedded Lucide icons for categories; preserve licensing when extracting assets.

Current selectable categories: Development; Meeting; Approval Board; External Process; Work Order / Ticket; Feature Exchange; Security Review; Architecture Review; Infrastructure; Compliance; Testing; Deployment; Unexpected Issue; Other. The project root has its own Main Quest representation.

**Unexpected Issue** represents unplanned problems found while doing other work, such as broken environments, errors, or troubleshooting. Use a warning/triangle-alert icon. It is a category, not a fourth lifecycle state.

## 6. Blockers

- Allow selecting a card that blocks another card. The baseline stores one `blockedBy` reference per card.
- Save and visibly draw each relationship between the affected cards as a red dotted connector.
- Use red blocked labels, not yellow.
- Support relations between separate lanes, cards in groups, and cards within the same group.
- When the blocker completes, retain the dependency relationship and show its resolved state (“Dependency completed”) rather than silently removing it.
- Keep connector endpoints aligned as groups scroll horizontally and when layout changes.
- Preserve outgoing and incoming blocker references when moving an eligible card. Prevent deleting a card that other cards still reference as their blocker.

## 7. Links

- Provide card-level CRUD for label/URL pairs, including multiple links.
- Validate supported schemes: HTTP, HTTPS, and mailto.
- Escape labels and URLs in generated markup and use safe external-link attributes.
- Preserve links in card edits, exports, Undo, and moves.

## 8. Owners and global contact bank

- Allow multiple people to be assigned as card owners.
- Maintain a reusable contact bank for the current project with names and email addresses.
- Provide create, read/select, update, and delete flows; autocomplete/select from existing contacts when assigning a card.
- A shared contact update must propagate to all card assignments.
- Removing an owner from one card must keep the contact in the bank.
- Removing a contact from the global bank must clear its assignments across cards.
- Include contact-bank data in snapshots/exports through the project object.

## 9. Colored tags and global tag bank

- Show colored pill tags on cards and provide CRUD with Tailwind-500 swatches.
- Keep a global tag bank within the project; reuse tags across cards.
- Updating a shared tag's name/color must update every assigned card.
- Removing one card's assignment must retain the shared tag.
- Removing a tag from the bank must clear its card assignments.
- Keep contact and tag bank entries when a card is deleted; deleting a card is not bank cleanup.

## 10. Card details, Notes, and Log

- Open card details as a right-side full-height drawer.
- Notes and Log each open as an additional full-height drawer to the left of card details on wider screens; use an overlay on narrow screens.
- Notes and Log are mutually exclusive auxiliary drawers.
- Notes provides a large plain-text area. No formatting or Markdown rendering is currently implemented.
- Log provides CRUD for timestamped plain-text progress/status entries, newest first. Support entry timestamp editing and show an edited timestamp when appropriate.
- Validate entry text and timestamps. Add must actually work in embedded previews; do not rely solely on unreliable nested-form submission.
- Notes, links, people, tags, and log changes in the card editor are saved with Save changes. Cancel discards the card draft.
- Distinguish adding an entry to the current editor draft from durably saving the card.

## 11. Abandonment

- Provide `×` to terminate an eligible open questline.
- Require a description of why it was abandoned and a valid date/time.
- Show the termination symbol/reason/time and allow editing abandonment details.
- Preserve prior work. Abandonment is not deletion, completion, or automatic merge.
- Close further progression on that questline; Undo can restore the prior open state.
- Owning-questline closure applies to its parallel members and follow-ups, including moves and an Add form opened before closure. A termination on an individual parallel path stays local to that path; nested side questlines remain independent.
- Protect recorded abandonment cards from deletion and movement.

## 12. Safe single-card deletion

Deletion is limited to one eligible card; no cascading/subtree deletion.

Prevent deletion when the card:

- Is the main quest starting card.
- Has any objective or side quest children, checking both parent references and child lists.
- Is referenced as a blocker by another card.
- Anchors other parallel objectives.
- Records a merge, anchors a merge destination, or is an origin used by a merged branch.
- Records abandonment.

An otherwise eligible leaf objective or empty side quest can be deleted, whether open or complete. Show actionable reasons when deletion is unavailable. Ask for confirmation and revalidate relationships when confirming. Remove graph references to the deleted card, rebalance/dissolve groups, retain bank records, and support Undo that restores the entire card and its content.

## 13. Move a leaf objective

Placement correction currently supports one eligible leaf objective, not entire branches or arbitrary drag-and-drop reorder.

### Destinations and interaction

- Choose another existing open objective group, or the single unambiguous endpoint of another open main/side questline.
- For a group destination, add the card as a parallel member. For a questline destination, append it as a serial objective.
- Show a destination picker, then a From/To review and explicit Confirm move. Cancel preserves current placement.
- Do not offer the same source group/questline as a no-op destination. Arbitrary insertion before an existing objective is outside current scope.
- Revalidate source and destination when confirming. If the plan changed, require review again.

### Eligibility and preservation

- Block the main root, side quest roots, cards with children, parallel anchors, merge records/anchors/origins, abandonment records, and work on closed questlines.
- Require pending card edits to be saved or canceled first.
- Reject closed destinations, ambiguous endpoints, and cycles through parent/parallel relationships.
- Preserve ID, all card content, state, timestamps, owner/tag assignments, log, notes, links, and incoming/outgoing blocker references.
- Inherit the destination questline's visual color through topology.
- Update parent/children/parallel references consistently, rebalance the source group, and retain its merge history.
- Undo must restore the original placement and full content.

## 14. Persistence, Undo, and preview

- Browser-local storage is optional. Live component state must remain editable when saving is unavailable.
- Embedded previews use session memory; standalone storage failures also fall back to memory, with a visible notice.
- Static standalone localStorage uses `sidequests-v1` and stores `{project,nodes,seq}`.
- Export JSON uses `{project,nodes}`; there is no import UI yet.
- Undo supports up to 50 prior project/node/sequence snapshots in the current session, through controls and Ctrl/Cmd+Z outside text inputs and active dialogs.
- Undo is not durable audit history. Do not persist temporary modal or draft state as project data accidentally.
- Preserve legacy compatibility helpers and stable IDs when separating or migrating the code.

## 15. Example coverage

Keep a complex enterprise developer portal example, including a main parallel group, a pink observability side questline with its own group, a nested side quest, serial follow-ups, completed and undefined cards, explicit blocker relations, parent-branch merges, and an Unexpected Issue card with owners, links, notes, and progress entries. Keep the example representative when adding a feature; avoid breaking unrelated behaviors to make a new example.

## 16. Explicitly outside this baseline

A JSON import dialog, accounts, cloud persistence, simultaneous collaboration, critical-path scheduling, Markdown rendering, arbitrary drag-and-drop ordering, whole-branch movement, and cascade deletion remain outside the implemented scope.

## 17. Local runnable application

The requested Go application extends the prototype baseline:

- Build a self-contained executable embedding the frontend, including its styling dependency. Serve the UI in a browser through a loopback HTTP server.
- Default to a per-user application folder; allow an alternate folder and listen address through CLI flags.
- Generate `config.yaml` for listen address, projects folder, last project, and welcome completion. Reject invalid configuration without overwriting it.
- Store each project as a separate `<project-name>.json` containing `{project,nodes,seq}`. Derive filenames from the initial title, keep them stable on title edits, and avoid overwriting same-title projects.
- Show an explanatory first-run welcome and getting-started guide; reopen it on request. Resume the last selected project when available; report missing/corrupt files without destroying them.
- Provide project creation, opening, update, and confirmed whole-file deletion. Whole-file deletion cannot be undone; guarded card deletion remains separate.
- Keep editing authoritative in memory while background saves run. Show failures and allow retry, export, or confirmed reopening of saved data. Prevent switching with an open editor or unsaved write failure.
- Serialize saves; validate graph references, prevent stale overwrites using revisions, and replace files atomically. Retain existing IDs, card/project fields, timestamps, and export shape. Accept compatible exports without `seq` by deriving it.
- Keep static/embedded preview and `sidequests-v1` behavior usable. File-backed mode does not silently import, overwrite, or delete browser storage.
- Preserve accepted graph geometry, appearance, density modes, bank semantics, Save/Cancel, and per-project session Undo.

## 18. PDF export through browser printing

- Offer Export PDF for an active project; open a separate read-only print snapshot and invoke the browser print dialog. Users select Save as PDF. No PDF service or runtime dependency is required.
- Require open card/project drafts to be saved or canceled before exporting. Export applied in-memory state, including when disk saving is unavailable.
- Render every card expanded in Normal density with full titles, descriptions, owners, links/URLs, tags, state, delays, and timestamps. Unclip parallel groups so all members appear, including groups wider than the live viewport.
- Reuse the accepted renderer, measuring expanded cards and updating paths/spacing within the snapshot. Preserve topology, blockers (including resolved ones), mainline thickness, marker layering, and historical merge references.
- Include project title, goal, export date/time, card count, and card references. Add complete plain-text notes and progress logs in a paginated appendix, keyed to those references, retaining entry and edit timestamps.
- Use a plain background, hide editing controls, and export the map as one custom-sized page followed by A4 appendix pages. Refuse map dimensions above the first version's 18,000 CSS-pixel limit on either axis instead of clipping content. Tiled maps remain future work.
- Leave live nodes/project, group density, expanded-card state, zoom/pan, saved files/storage, timestamps, and session Undo untouched. Report blocked pop-ups and preparation errors; retain a Print / Save as PDF button for retry after canceling the browser dialog.
- Test real Chromium PDF generation/page dimensions and print styling, expanded group coverage, safe text, long appendix pagination, and state/file preservation in static, embedded, and Go modes. Native print-dialog settings remain browser-dependent.
