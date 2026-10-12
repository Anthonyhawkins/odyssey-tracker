# Odysseus Tracker

Odysseus Tracker makes the work behind enterprise delivery visible. A simple goal—launch a service, provision hosting, deploy an application—often creates additional reviews, approvals, tickets, dependencies, and unexpected issues. The tracker records that work as a map of main objectives, independent side quests, parallel objectives, and merges.

The visual model takes inspiration from Git commit flow diagrams: a central main questline with smooth branches that can continue independently and rejoin their originating questline. The name and blue-and-white styling refer to Odysseus and the Odyssey.

## Handoff baseline

This package contains the accepted single-file prototype and documentation prepared on October 12, 2026. The original `index.html` is preserved at Git checkpoint `6943ce7` as an unchanged copy of the final downloaded `side-quests.html` prototype (source version 60). The current file includes focused behavior corrections tracked by the regression suite. Documentation describes implemented behavior and preserves decisions made during iteration; it is not a promise that every possible graph has been tested.

Start by running and understanding this baseline. Make small, reviewable changes and preserve its appearance, interactions, and existing data before introducing a new architecture.


## Documents

- [REQUIREMENTS.md](REQUIREMENTS.md): implemented product rules and acceptance criteria.
- [AGENTS.md](AGENTS.md): concise instructions for Codex and other coding agents.
- [Design decisions](docs/DESIGN-DECISIONS.md): accepted choices and approaches that were tried and rejected.
- [Testing checklist](docs/TESTING.md): manual regression scenarios and priorities for future automated tests.

Browser reference screenshots are available in [docs/screenshots/](docs/screenshots/README.md), captured from the unchanged prototype at desktop and narrow viewport sizes. Review the capture notes and existing layout limitations before changing rendering or spacing.

## Current features

| Area | Implemented behavior |
| --- | --- |
| Quest map | Central thicker mainline, independent side and nested questlines, smooth SVG connections, parent-branch merges, lane reuse, zoom/pan/center/fit, relationship focus |
| Objectives | Serial objectives and parallel groups on main or side questlines; balanced grids with at most three rows; Normal, Compact, and Very compact display modes |
| Lifecycle | In progress, Undefined, Complete; dependency-derived blocked display; abandonment with reason and date; merge history with date and time |
| Card details | Title, description, category icon, delay estimate, links, multiple owners, colored tags, timestamps, plain-text notes, timestamped progress log |
| Project banks | Reusable contacts and colored tags with CRUD and card assignment |
| Safe changes | Confirmation for replacement/deletion/moves, single-card deletion guards, leaf-objective placement correction, session Undo |
| Overview | Collapsible project overview and metrics; insights dialog; explanatory sidebar |
| Example | Enterprise developer portal with main and side parallel groups, nested branches, completed and undefined work, blockers, merges, and an Unexpected Issue |

## Technical architecture

- One HTML file contains markup, CSS, application logic, embedded Alpine.js, and embedded category SVG icons.
- Tailwind CSS is loaded through `https://cdn.tailwindcss.com`; styling therefore still needs that network dependency. This is not a fully offline bundle.
- `questApp()` owns the client-side application state and methods.
- The graph combines absolutely positioned HTML cards with SVG paths and nodes. Layout responds to measured card sizes and viewport width.
- Important code areas include `parallelGroups()`, `graphLayout()`, `laneSpacing()`, `parallelGroupHTML()`, `groupEndpointHTML()`, and `renderTree()`.
- Persistence, bank operations, card editing, merge/abandonment operations, deletion, and moving are currently methods on the same Alpine component.
- Category paths come from Lucide v0.468.0, under the ISC license. Preserve the existing attribution/license material when extracting or replacing assets.

## Data and persistence

The application manages one current project. Its main state is a project object, a node dictionary, and an ID sequence counter. Nodes have stable IDs and graph relationships; contact and tag banks live on the project.

When opened as a standalone page with storage available, the app saves `{project, nodes, seq}` under the legacy localStorage key `sidequests-v1`. Keep that key or provide an explicit migration when changing it. Embedded preview mode deliberately uses in-memory session state; standalone mode also falls back to memory if browser storage fails. Editing must continue to work in either mode.

Undo stores up to 50 state snapshots for the current session. Undo history itself is not persisted across reloads. This is a convenience for correcting edits, not a durable audit trail.

JSON export currently outputs `{project, nodes}`. It does not include the sequence counter or Undo history. There is no JSON import UI yet. A future importer must validate references and derive a safe next ID; it must not assume exports have the same shape as localStorage snapshots.

Downloading the HTML does not transfer data stored in the original browser or preview. Export any project data you want to retain separately, and keep it as a backup until an import feature is implemented. This package contains the built-in example, not personal browser-session data.

## Metrics interpretation

The overview displays objective counts, side-quest share, completion, and cumulative estimated delay. Delay is based on manually entered node estimates. It is not a critical-path calculation or a prediction of elapsed calendar time, especially when work is parallel.

## Known scope limits

- No accounts, server persistence, collaboration, project library, or authorization.
- No import feature, drag-and-drop rearranging, subtree movement, or cascading deletion.
- Movement only supports eligible leaf objectives into an existing open group or at another open questline's endpoint.
- Notes and logs are plain text; Markdown rendering is not implemented.
- Prototype layout is custom and heuristic. Very large and unusual graphs need real-browser validation.
- A focused regression suite now covers logic and real Chromium interactions/geometry. It is not exhaustive pixel-level or cross-browser validation; see [test commands and coverage](docs/TESTING.md#automated-regression-checks).

## Regression checks

The app still needs no build step. Tests use Node.js 22 or newer and a pinned Playwright development dependency:

```sh
npm ci
npm run test:browser:install
npm test
```

`npm run test:logic` runs independently without browser dependencies. The seven assertions covering the original four gap areas now pass as regular regressions. `npm run test:requirements` runs that focused set. See [docs/TESTING.md](docs/TESTING.md#automated-regression-checks) for details and browser prerequisites.

## Suggested development order

1. Run the example, capture visual references, and complete the testing checklist.
2. Add focused automated checks for graph invariants, merge anchoring, deletion/move guards, and persistence compatibility.
3. Extract application logic and styles into files in small steps, comparing behavior after each step.
4. Make the styling build reproducible and remove the runtime CDN dependency if offline/reliable distribution becomes a requirement.
5. Choose persistence and application architecture based on the next product goal. A backend or framework migration is a separate decision.

## First Codex task

> Read AGENTS.md, README.md, REQUIREMENTS.md, and index.html. Explain the architecture and identify gaps between the implementation and requirements. Do not modify files yet. Then propose a small-step development plan that preserves the accepted appearance, graph behavior, and saved-data compatibility.

Official Codex documentation: [IDE extension](https://learn.chatgpt.com/docs/codex/ide) and [AGENTS.md instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
