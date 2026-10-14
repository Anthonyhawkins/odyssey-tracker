# Potential features

Ten proposed enhancements for Odysseus Tracker, focused on someone managing their own projects locally. These are ideas for discussion, not implemented features or committed release plans. Each starts with a user need and a small first version so improvements can ship without replacing the accepted graph/editor architecture.

The application should remain usable offline, keep its single executable distribution, and preserve existing project files. Contacts can continue to describe people involved in the work without becoming application accounts.

## 1. Search and filter the map

**User need:** “Where is that approval task, and which cards mention the staging environment?” Large maps need a faster way to find work than panning and opening cards individually.

**First version:** Search titles, descriptions, notes, and logs in the active project. Show a result list with each card's questline and status. Selecting a result centers the card and offers to open its details. Add filters for status, owner, category, and tag, with a clear reset action and result count.

**Keep it predictable:** Dim nonmatching cards rather than moving or removing them. Keep branches, blockers, and merge context visible. Searching notes/logs should show a short matching excerpt. Filters are a view preference and do not edit the project or create Undo entries.

## 2. A “What can I work on next?” panel

**User need:** “I have a map of everything, but what is ready for my attention today?” The overview counts work; an actionable panel could help turn that overview into a next step.

**First version:** List unfinished cards with no unresolved blocker on an open questline. Separately show blocked work and the card holding it up. Let the user pin a few cards to a personal focus list and jump from an item directly to its map position or editor.

**Keep it predictable:** Explain why each item appears. Planning work and legacy Undefined work should be identified as needing preparation or clarification, rather than automatically treated as Ready. In Review work should be distinguished from work awaiting implementation. Completed, abandoned, and closed work must not become suggestions. Use explicit relationships; do not imply that side quests block their parent or invent a critical-path schedule. Pins stay separate from card status and contact assignments.

## 3. Recover unfinished editor drafts

**User need:** “I was writing investigation notes when I refreshed the page. Can I get that text back?” Applied work already survives through project files, but an unfinished editor draft has a different lifecycle.

**First version:** Keep a recoverable local draft for the active card/project editor when durable storage is available. On reopening, offer **Recover draft** or **Discard draft**, showing the card and draft time. Include pending note/log text, links, owner assignments, and tags.

**Keep it predictable:** A recovered draft is still a draft until Save. Explicit Cancel discards its recovery copy. Store recovery separately from committed card data, and compare the underlying card revision before applying it after a reload. A changed or deleted card needs an explanation and a way to copy/export the draft text. Storage failure must leave editing usable in memory.

## 4. Automatic local backups and named checkpoints

**User need:** “Undo ended when I closed the app. I want to return to yesterday's project or the point before a major reorganization.”

**First version:** Keep a bounded set of previous successful project snapshots and offer a manual **Create checkpoint** action with a name. Show checkpoint date, project name, and card count. Allow read-only inspection before an explicitly confirmed restore, creating a backup of the current project first.

**Keep it predictable:** This is separate from session Undo. Preserve complete snapshots, including IDs, references, banks, unknown compatible fields, and historical timestamps. Validate a restore and check its destination revision before replacing a file. Backup retention and disk use need clear limits. Never silently restore a checkpoint during startup or overwrite newer disk changes.

## 5. Redo and clearer session history

**User need:** “I clicked Undo one time too many. What did I undo, and can I put it back?”

**First version:** Add **Redo** beside Undo, with labels describing the next action in each direction. A small history panel can list recent session actions such as “Moved objective” or “Updated contact,” so the user can understand a change before stepping backward or forward.

**Keep it predictable:** Start with one-step Undo/Redo; jumping across many history entries can wait. A new project mutation clears the redo path. View-only changes should not. Keep history bounded and scoped to the active project session, retain open-editor protections, and restore snapshots rather than replaying potentially stale structural commands. This does not make Undo durable across restarts.

## 6. Reusable project templates

**User need:** “Every service launch needs similar reviews, hosting work, and observability checks. I want to start from my own outline.”

**First version:** Let the user save an existing project as a local template and choose it when creating a separate project file. Provide an explicit choice between copying the project with its history or starting fresh from its work structure. Show what will be carried over before creation.

**Keep it predictable:** The source project must remain untouched. A fresh start needs a deliberate reset of completion, merge/abandonment records, progress logs, and dates, while retaining valid parent/child, parallel, and blocker relationships. Show options for retaining notes, contacts, and tags. Validate the resulting graph and allocate identifiers consistently. Templates should be local and user-maintained; a marketplace or online catalog is unnecessary.

## 7. A more useful project library

**User need:** “I have several projects now. Which did I use recently, and how do I put finished ones out of the way without deleting them?”

**First version:** Add title search, sorting by recent activity, pinned projects, and an **Archived** view. Show a compact card count/completion summary and distinguish the currently open file. Archive/unarchive should be explicit actions alongside opening a project.

**Keep it predictable:** Archiving is a library preference, not questline abandonment, completion, or deletion. It must not change card history. Keep title and filename distinct, preserve existing file identity, and decide explicitly how archiving the current project affects last-project resume. Missing/corrupt files should retain actionable messages. Save/cancel and unsaved-write guards must still apply when switching projects.

## 8. Saved map views and bookmarks

**User need:** “Each time I reopen this project, I spend a minute finding the branch I was investigating.”

**First version:** Save named bookmarks such as “Hosting review” or “Observability,” tied to a card/questline and zoom level. Offer a bookmark list and a **Return to last view** option. Remember overview expansion and relevant view preferences per project.

**Keep it predictable:** Anchor a bookmark to a stable card ID and center it using the current layout, instead of relying only on old pixel coordinates. If a card was deleted, mark that bookmark unavailable and let the user remove or retarget it. View state belongs in local application preferences and should not alter topology, timestamps, saved card content, or Undo. Keep the normal Center/Fit controls available.

## 9. Keyboard navigation and accessibility polish

**User need:** “I want to navigate and edit the map without constantly switching to the mouse, and I need clear focus and readable controls.”

**First version:** Make the map's cards and actions navigable by keyboard, with Enter to open details and predictable focus return after a dialog closes. Add a discoverable shortcuts/help panel. Give cards an accessible summary of their title, status, questline, and blocker, rather than requiring someone to interpret SVG curves alone.

**Keep it predictable:** Keyboard actions must use the same eligibility guards and review/confirmation flows as pointer actions. Shortcuts must not intercept typing or bypass editor Save/Cancel. Avoid trapping focus or focusing offscreen controls, and announce save/error states. Improve focus indicators and accessible labels while retaining the accepted default appearance; convey status through text/symbols as well as color.

## 10. Paper-friendly map exports

**User need:** “The expanded PDF is good for zooming on screen, but I want to print a large map or read it on ordinary pages.”

**First version:** Extend PDF export with tiled A4/Letter pages at a readable scale. Add page coordinates and continuation labels for connections crossing page boundaries. Include a small overview/index so the user can locate a branch in the tiles, while retaining the full notes/log appendix.

**Keep it predictable:** Offer this alongside the existing single large-page export. Plan page boundaries around cards/groups where possible, show a preview and estimated page count, and explicitly handle a card larger than one page. Preserve the complete map and historical relationships in the export snapshot, leaving the working map unchanged. A selected-questline export could follow later, with outside blockers/parent connections clearly identified.

## Suggested order and relative effort

These are rough scope estimates based on the current application, not delivery commitments. The first version of each feature should be independently useful.

| Feature | Priority | Relative effort | Reason |
| --- | --- | --- | --- |
| Search and filters | High | Medium | Helps immediately as a project grows |
| Next-work panel | Medium | Medium | Makes explicit relationships actionable |
| Draft recovery | High | Medium | Protects writing that has not been applied yet |
| Backups/checkpoints | High | Medium–large | Protects work beyond a single session |
| Redo/session history | Medium | Medium | Makes editing and correction more understandable |
| Templates | Later | Large | Saves repeated setup but needs careful history resets |
| Project library polish | Medium | Small–medium | Improves navigation without changing graph rules |
| Saved views/bookmarks | Medium | Small–medium | Reduces repeated navigation work |
| Keyboard/accessibility polish | High | Medium | Improves everyday interaction and access |
| Tiled PDF export | Later | Large | Addresses large-map printing without shrinking text |

A sensible starting sequence is search/navigation, basic keyboard/focus improvements, and local backups. Draft recovery is also valuable, but its storage and Save/Cancel rules should be designed before implementation. Tackle template resets and tiled exports after the smaller workflow improvements have settled.

## Rules to carry into implementation

- Keep every proposal local and focused on one user's workflow; introduce no accounts, cloud services, or collaboration requirements.
- Preserve the accepted graph appearance and invariants by default. Make any new view/export behavior explicit and reversible.
- Preserve stable IDs, references, timestamps, shared bank semantics, existing JSON shapes, and the static browser-storage/memory fallback. New durable fields need backward-compatible defaults or an explicit migration.
- Keep editor Save/Cancel, structural mutation guards, and session Undo semantics clear. Do not silently apply drafts or infer structural changes from a view preference.
- Implement one focused first version at a time, update product requirements when a proposal is accepted, and validate its affected flows before broadening scope.

For current behavior, see the [user guide](USER-GUIDE.md) and [requirements](REQUIREMENTS.md). These proposals complement those documents rather than changing their implemented rules.
