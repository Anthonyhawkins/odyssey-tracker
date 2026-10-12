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
- [Compatibility validation](docs/COMPATIBILITY-VALIDATION.md): pre-change saved-data workflows and comparison with the captured appearance baseline.

Browser reference screenshots are available in [docs/screenshots/](docs/screenshots/README.md), captured from the unchanged prototype at desktop and narrow viewport sizes. Review the capture notes and existing layout limitations before changing rendering or spacing.

## Current features

| Area | Implemented behavior |
| --- | --- |
| Quest map | Central thicker mainline, independent side and nested questlines, smooth SVG connections, parent-branch merges, lane reuse, zoom/pan/center/fit, relationship focus; Dotted grid, None, or Backdrop background |
| Objectives | Serial objectives and parallel groups on main or side questlines; balanced grids with at most three rows; Normal, Compact, and Very compact display modes |
| Lifecycle | In progress, Undefined, Complete; dependency-derived blocked display; abandonment with reason and date; merge history with date and time |
| Card details | Title, description, category icon, delay estimate, links, multiple owners, colored tags, timestamps, plain-text notes, timestamped progress log |
| Project banks | Reusable contacts and colored tags with CRUD and card assignment |
| Safe changes | Confirmation for replacement/deletion/moves, single-card deletion guards, leaf-objective placement correction, session Undo |
| Overview | Collapsible project overview and metrics; insights dialog; explanatory sidebar |
| Example | Enterprise developer portal with main and side parallel groups, nested branches, completed and undefined work, blockers, merges, and an Unexpected Issue |

## Run the local application

Requires Go 1.24 or newer to build. The resulting binary needs no Go, Node, repository, or network connection at runtime.

```sh
go build -trimpath -o dist/odysseus-tracker .
./dist/odysseus-tracker
```

Open the printed URL (normally `http://127.0.0.1:8042`) in your browser. The first launch presents a welcome and getting-started guide. Create a project or open an existing one through **Projects**. Later launches resume the last opened project. Stop the process with Ctrl+C.

For configuration, file locations, migration from browser storage, and alternate folders, see [Local application guide](docs/LOCAL-APPLICATION.md).

The static prototype remains usable with `python3 -m http.server 8000` and `http://localhost:8000`; this mode uses browser storage rather than project files.

## Technical architecture

- Go serves a loopback HTTP application and embeds `index.html`, `map.png`, and `assets/` into the executable with `go:embed`.
- `config.go` manages YAML settings; `project.go` validates saved graphs; `server.go` provides the project-file API and embedded assets; `main.go` starts and stops the server.
- The accepted HTML retains markup, CSS, graph/editor logic, embedded Alpine.js, and category SVG icons. A small `assets/local-app.js` adapter adds welcome, project selection, and queued file persistence.
- Tailwind's pinned 3.4.17 browser runtime is bundled locally. Styling requires no CDN at runtime; license notices are included in the assets.
- `questApp()` owns the client-side application state and methods.
- The graph combines absolutely positioned HTML cards with SVG paths and nodes. Layout responds to measured card sizes and viewport width.
- Important code areas include `parallelGroups()`, `graphLayout()`, `laneSpacing()`, `parallelGroupHTML()`, `groupEndpointHTML()`, and `renderTree()`.
- Persistence, bank operations, card editing, merge/abandonment operations, deletion, and moving are currently methods on the same Alpine component.
- Category paths come from Lucide v0.468.0, under the ISC license. Preserve the existing attribution/license material when extracting or replacing assets.

## Data and persistence

The application edits one current project at a time. The Go application manages separate project files through its project library. Its main state is a project object, a node dictionary, and an ID sequence counter. Nodes have stable IDs and graph relationships; contact and tag banks live on the project.

In static prototype mode, when opened as a standalone page with storage available, the app saves `{project, nodes, seq}` under the legacy localStorage key `sidequests-v1`. Keep that key or provide an explicit migration when changing it. Embedded preview mode deliberately uses in-memory session state; standalone mode also falls back to memory if browser storage fails. Editing must continue to work in either mode.

In Go mode, project files store `{project,nodes,seq}`. Saves are serialized, validated, and atomically replaced. Revision checks reject stale writes; failures leave editing available in memory with Retry, Reopen, and Export controls. Configuration records the last project and welcome completion.

Undo stores up to 50 state snapshots for the current session. Undo history itself is not persisted across reloads or project switches. This is a convenience for correcting edits, not a durable audit trail.

JSON export currently outputs `{project, nodes}`. It does not include the sequence counter or Undo history. There is no JSON import UI yet. The Go application can open compatible exports placed in its projects folder, validating references and deriving the sequence counter. See the migration guide.

Downloading the HTML does not transfer data stored in the original browser or preview. Export any project data you want to retain separately, and keep it as a backup during migration. This package contains the built-in example, not personal browser-session data.

## Metrics interpretation

The overview displays objective counts, side-quest share, completion, and cumulative estimated delay. Delay is based on manually entered node estimates. It is not a critical-path calculation or a prediction of elapsed calendar time, especially when work is parallel.

## Known scope limits

- No accounts, cloud persistence, or simultaneous collaboration. The HTTP server is restricted to loopback and project API calls require its per-run session token.
- No import feature, drag-and-drop rearranging, subtree movement, or cascading deletion.
- Movement only supports eligible leaf objectives into an existing open group or at another open questline's endpoint.
- Notes and logs are plain text; Markdown rendering is not implemented.
- Prototype layout is custom and heuristic. Very large and unusual graphs need real-browser validation.
- A focused regression suite covers logic and real Chromium interactions/geometry. A separate visual run compares the captured reference scenes in their original browser environment. Coverage remains limited to the documented fixtures and scenarios; see [test commands and coverage](docs/TESTING.md#automated-regression-checks).

## Regression checks

The static prototype needs no build step. Go checks use `go test -race ./...` and `go vet ./...`. File-backed browser checks use `npm run build:local` followed by `npm run test:local`. Frontend tests use Node.js 22 or newer and a pinned Playwright development dependency:

```sh
npm ci
npm run test:browser:install
npm test
```

`npm run test:logic` runs independently without browser dependencies. The seven assertions covering the original four gap areas now pass as regular regressions. `npm run test:requirements` runs that focused set. See [docs/TESTING.md](docs/TESTING.md#automated-regression-checks) for details and browser prerequisites.

## Preserved baseline

The original prototype and subsequent regression checkpoints remain in Git. The Go transition preserves graph layout, editor behavior, card safeguards, stable identifiers, timestamps, and export shape. Appearance comparisons continue to use the original captured scenes; local welcome and project controls are additional application UI.
