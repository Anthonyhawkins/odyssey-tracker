# Changelog

User-facing changes to Odysseus Tracker are recorded here, newest first. Add upcoming changes under **Unreleased** and move them into a dated version entry when preparing a release.

## Unreleased

## 0.1.0 — 2026-10-12

Initial version.

### Added

- Self-contained Go executable with an embedded frontend and offline browser interface served over loopback HTTP.
- Per-user `config.yaml`, separate project JSON files, project creation/opening/editing/deletion, and last-project resume.
- First-run welcome and getting-started guide, with a built-in enterprise developer portal example.
- Quest map with a central main questline, independent and nested side quests, parallel objective groups, explicit blockers, and historically anchored parent-branch merges.
- Pan, zoom, center, fit, relationship focus, three group density modes, and Dotted grid / None / Backdrop background choices.
- Card details with status, categories, owners, colored tags, links, delay estimates, timestamps, plain-text notes, and progress logs.
- Shared contact and tag banks, project overview, and insights metrics.
- Completion and abandonment history, guarded single-card deletion, reviewed leaf-objective moves, and session Undo.
- Serialized background saves, graph validation, atomic file replacement, stale-write detection, and save recovery/export controls.
- Existing browser-storage compatibility, memory-only preview editing, and compatible JSON exports.
- Public README, illustrated user guide with 13 application screenshots, configuration/migration guide, and reproducible screenshot capture.
- Go checks and frontend logic, browser, compatibility, and appearance regression coverage.
