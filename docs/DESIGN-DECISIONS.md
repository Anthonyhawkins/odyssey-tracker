# Design decisions to preserve

These notes preserve product choices from the prototype iteration, not a complete architecture decision record. Use them to understand why an apparently simpler change might regress the accepted behavior.

## Git-style flow, independent work

The map should resemble a Git commit flow diagram with smooth branches and rejoins. Side quests expose supporting work without making the main quest automatically wait. Blocking is a separate explicit relationship. Cards on a branch are spaced according to that branch's work, not a global creation counter that makes unrelated branches staircase downward.

## Historical merges

A rejoin goes to the branch's actual parent questline. The merge is drawn after the source branch's work and anchored to where it happened on the destination. Appending new work must not rewrite that history visually. Existing `mergeAfterId`, ordering, and timestamp fields matter during refactoring; treat them as graph history rather than disposable layout decorations.

Moves can place an older-ID objective after a newer one. New merges therefore identify the destination's serial endpoint from parent/child relationships, excluding independent parallel paths, instead of taking the highest numeric ID. Ambiguous serial endpoints prevent a new rejoin rather than guessing an anchor. Existing saved merge anchors, coordinates, ordering, and timestamps are retained.

## Smooth curves and selective spacing

An experiment stretched questlines vertically and introduced more collision routing to protect large groups. The user rejected it because lanes became too far apart and connections lost their flowing appearance. Smooth curves were restored, then spacing was corrected with selective horizontal lane clearance around vertically overlapping groups.

Preserve this accepted balance. Do not replace it with global oversized lane spacing, hard elbows, zigzags, or automatic obstacle detours without an explicit reconsideration of the design. Visual checks should include both dense groups and ordinary small branches.

## Groups instead of many apparent branches

Parallel objectives belong to one questline point. A subtle group container makes that relationship visible. The grid must be balanced, at most three rows deep, and scroll horizontally when necessary. A three-way density choice allows large groups without removing access to full details.

Per-card quest action strips inside groups were removed. Group header `.` and `!` actions add a parallel objective or side quest. Ordinary endpoint controls live below the whole group, where they can continue or finish the owning questline. Extra follow-up labels above cards were also removed because they broke alignment.

## Color, categories, and lifecycle are distinct

Questline color expresses topology and is shared by paths, nodes, and card borders. Category icons express the kind of work. State expresses progress. Unexpected Issue is a category for troubleshooting/unplanned work; Undefined is a state with a dotted outline. Do not use a single field for these separate meanings.

Use Tailwind-500 swatches rather than an unrestricted color picker. Greek-inspired blue-and-white accents and the Odysseus Tracker name are the accepted branding. Circled `!`/`?` nodes need white fill and top-layer rendering because the thicker mainline previously showed through them.

## Rich detail without clutter

Keep the canvas summaries compact and expose full data through the card detail drawer. Notes and Log are full-height auxiliary drawers to its left, not small inline accordion fields. Plain text is intentional for this baseline. Project overview/metrics can collapse; the redundant graph legend row stays removed.

## Preview is usable without saving

Embedded preview interactions previously failed when they depended on storage or form behavior. The live component is authoritative, storage is optional, and direct button handlers are used where form submission proved unreliable. New code must preserve actual Add/Save behavior in memory-only previews.

## Correct placement without rewriting history

Deletion and movement are deliberately narrow. Delete one safe card at a time. Move an eligible leaf objective to a group or another questline's endpoint. Protect relationship anchors, children, and historical termination/merge records. Moves retain identity/content/timestamps and have a review step plus Undo; they are not a new card creation or whole-branch rearrangement.

## Incremental maintenance

The single-file implementation is a prototype baseline, not an architectural commitment. Extract code gradually with regression checks. A backend, new framework, import workflow, or production data model should be chosen for an actual product requirement rather than assumed as part of the handoff.

## Local Go application

The requested binary uses a loopback server and browser UI, with per-user data and a CLI override. Go embeds the accepted frontend and a pinned local Tailwind runtime. A small adapter handles file operations around the existing component; graph algorithms and editor/mutation rules remain in the accepted implementation.

The project filename identifies the file independently of later title edits. Same-title creation produces another filename instead of replacing data. Configuration stores application settings and last selection; each JSON stores the existing project/node/sequence snapshot. Exports retain their earlier shape, and opening compatible exports derives a safe sequence.

Live edits remain authoritative while serialized saves run in the background. Atomic replacement protects the previous file from interrupted writes; revision checks refuse stale saves. A visible failure offers Retry, Export, and confirmed Reopen. Switching waits for writes and refuses an open editor or unresolved save failure. Undo applies within the current project's session; switching or creating a separate project starts fresh history. Whole-file deletion is explicitly confirmed and cannot be undone.
