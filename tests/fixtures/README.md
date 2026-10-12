# Saved-data fixtures

`baseline-v1.json` is a frozen `{project,nodes,seq}` snapshot of the built-in example from unchanged prototype commit `6943ce7`, captured through `questApp().loadDemo()` with rendering deferred. It includes stable card/contact/tag/log IDs, nested graph links, merge anchors/order/timestamps, and rich card content. Browser rendering can subsequently calculate `mergeY`; this logic fixture does not fabricate those measurements. Do not regenerate the fixture from refactored code merely to make a compatibility test pass.

`legacy-owner.json` is a minimal synthetic legacy snapshot with string owners, no contact/tag banks, historical dates, notes, links, and a blocker reference. Tests verify the existing owner compatibility helper without rewriting other node fields.

The small mutation graph in `tests/helpers/app.cjs` isolates safety scenarios. Tests that deliberately introduce inconsistent references say so explicitly; ordinary mutations must pass independent graph checks for reciprocal links, valid references, bank assignments, and structural cycles.
