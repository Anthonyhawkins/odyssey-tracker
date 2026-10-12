# User-guide screenshots

These images illustrate the current local Go application for the public README and [user guide](../USER-GUIDE.md). They are separate from the accepted prototype regression references in `docs/screenshots/`.

Captured in real Chromium at 1440 × 1000 on macOS using a fresh browser context, a temporary application folder, and the built-in enterprise developer portal example. No personal project or browser storage was used. The random data-folder label in the project-library image was replaced with “Application data folder / projects”; the rest of the application UI was captured as rendered. The new-project image shows an unsaved example title. No product source or graph data was altered for capture.

Capture browser version, image descriptions, and SHA-256 hashes are recorded in [capture-metadata.json](capture-metadata.json). The script fails on browser errors, failed requests, or external requests, stops the temporary server, and removes its temporary data folder.

To regenerate from the repository root:

```sh
npm ci
npm run test:browser:install
npm run build:local
npm run docs:screenshots
```

Requires Go 1.24+, Node.js 22+, and the pinned Playwright Chromium installation. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing compatible browser. Regeneration intentionally replaces only these guide images, never the original visual-test references. Capturing screenshots verifies the shown UI flows; it does not replace the regression suite.
