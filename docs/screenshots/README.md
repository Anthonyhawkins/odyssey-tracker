# Accepted prototype browser references

Captured October 12, 2026 from unchanged `index.html` at baseline commit `6943ce7`. These images preserve the existing rendering for comparison; they do not establish that every layout or product requirement passes.

## Capture environment

- Real headless Chromium 140.0.7339.16, controlled through an existing external Playwright 1.58.2 installation.
- Desktop viewport: 1600 × 1000 CSS pixels. Narrow viewport: 390 × 844 CSS pixels. Device scale factor: 1.
- Locale: `en-US`. Timezone: `America/Chicago`.
- Served at `http://127.0.0.1:8000`, with the runtime Tailwind CDN available.
- A fresh nonpersistent browser context loaded only the built-in example: 26 cards, two parallel groups, and no personal project data. The context was closed after capture.
- No page errors or failed requests were recorded in the completed capture run. Browser measurements are in [capture-metadata.json](capture-metadata.json).
- `index.html` was not edited. Only navigation, overview collapse, scrolling, and opening drawers were used for ordinary screenshots. No card content was saved or structural mutations performed.

## Desktop references

| Scenario | Screenshot |
| --- | --- |
| Overview expanded | [desktop-overview-expanded.png](desktop-overview-expanded.png) |
| Overview collapsed | [desktop-overview-collapsed.png](desktop-overview-collapsed.png) |
| Entire map through Fit all | [desktop-full-map-fit.png](desktop-full-map-fit.png) |
| Entire map at natural resolution | [desktop-full-map-natural.png](desktop-full-map-natural.png) |
| Main parallel group | [desktop-main-group.png](desktop-main-group.png) |
| Pink observability group and its endpoint | [desktop-observability-group.png](desktop-observability-group.png) |
| Nested compliance branch | [desktop-nested-branch.png](desktop-nested-branch.png) |
| Nested merge into infrastructure | [desktop-merge-node.png](desktop-merge-node.png) |
| Undefined mainline card | [desktop-undefined-card.png](desktop-undefined-card.png) |
| Notes beside card details | [desktop-notes-drawer.png](desktop-notes-drawer.png) |
| Log beside card details | [desktop-log-drawer.png](desktop-log-drawer.png) |

The natural-resolution map is a 3280 × 4179 image of a temporary unclipped DOM clone of the already rendered graph at 100% zoom. Computed card positions, SVG geometry, and group sizes were retained; the layout was not recomputed at a larger viewport. A pale background was applied to that clone for readability. Use the ordinary viewport screenshots to compare application chrome, clipping, canvas background, and scrolling. The clone was removed immediately after capture.

The fitted map is shown at approximately 16% zoom. Other viewport references use 100% zoom. Some focused screenshots include outer workspace scrolling performed by bringing the target into view. The card details panel is scrolled to the Notes/Log controls in the desktop drawer references.

## Narrow references

| Scenario | Screenshot |
| --- | --- |
| Overview expanded, initial viewport | [narrow-overview-expanded.png](narrow-overview-expanded.png) |
| Overview expanded, workspace scrolled to map | [narrow-expanded-map-scrolled.png](narrow-expanded-map-scrolled.png) |
| Overview collapsed | [narrow-overview-collapsed.png](narrow-overview-collapsed.png) |
| Observability group rows | [narrow-observability-group.png](narrow-observability-group.png) |
| Group header and actions | [narrow-group-header.png](narrow-group-header.png) |
| Group horizontally scrolled to next column | [narrow-group-scrolled.png](narrow-group-scrolled.png) |
| External endpoint actions and Rejoin parent | [narrow-group-endpoint.png](narrow-group-endpoint.png) |
| Notes overlay | [narrow-notes-drawer.png](narrow-notes-drawer.png) |
| Log overlay | [narrow-log-drawer.png](narrow-log-drawer.png) |

## Observations and existing limitations

- The desktop example retains a thicker central mainline, smooth branch/merge curves, white-filled start/merge nodes, a nested merge into infrastructure, tinted groups, and dotted Undefined cards. Group header actions and external observability endpoint controls are visible. This is review of the example only, not exhaustive collision testing.
- Collapsing the desktop overview increases the map viewport height from 556.5 to 739.5 CSS pixels without changing the measured graph size.
- At 390 px wide, the header action row clips the rightmost **Start new quest** button. This existing limitation is preserved, not approved as desired behavior.
- With the narrow overview expanded, the map starts below the initial viewport (canvas top at 927 px) and has a 180 px minimum height. Workspace scrolling reaches it. Collapsing the overview provides a 292 px canvas starting at 502 px.
- Narrow groups have three rows and horizontal overflow. Their header text truncates; density selection, `.`/`!` actions, the next column, and external endpoint controls can be reached by scrolling. A whole group is taller than the visible narrow canvas.
- Notes and Log appear beside card details on desktop and as full-width overlays on narrow screens. Opening Log closes Notes; the existing example log appears newest first.

The remaining regression scenarios in [docs/TESTING.md](../TESTING.md) remain outstanding. This capture did not test 24-card rendering, all density modes, edited-state persistence/reload, storage failures, embedded previews, move/delete/Undo mutations, or cross-browser and touch behavior. No portable test harness or project dependency was added; the one-off capture driver was kept outside the repository.
