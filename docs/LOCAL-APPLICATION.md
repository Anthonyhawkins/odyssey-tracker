# Local application guide

For a walkthrough of the interface, see the [illustrated user guide](USER-GUIDE.md).

## Build and start

```sh
go build -trimpath -o dist/odysseus-tracker .
./dist/odysseus-tracker
```

Build with Go 1.24 or newer. On Windows, use `go build -trimpath -o dist/odysseus-tracker.exe .` and run that executable. Open the browser URL printed by the process, normally `http://127.0.0.1:8042`. Stop with Ctrl+C. Copy the executable anywhere; all frontend assets are embedded and runtime internet access is unnecessary. Node and Playwright are development/test dependencies only.

The welcome explains main quests, side quests, parallel objectives, blockers, and getting started. After dismissal it is remembered in configuration. **Getting started** reopens the guide. **Projects** creates, opens, and deletes project files. Restarting the process resumes the last selected project; a missing or invalid file produces a notice rather than being replaced.

## Configuration and file locations

The default folder comes from Go's per-user configuration directory:

| Platform | Typical application folder |
| --- | --- |
| macOS | `~/Library/Application Support/odysseus-tracker` |
| Linux | `$XDG_CONFIG_HOME/odysseus-tracker`, or `~/.config/odysseus-tracker` |
| Windows | `%AppData%\odysseus-tracker` |

The process prints its selected data folder. On first launch it creates `config.yaml` and a `projects/` directory. A new configuration looks like:

```yaml
listen: 127.0.0.1:8042
projects_dir: projects
last_project: ""
welcome_seen: false
background: dotted-grid
```

**Background** in the map toolbar offers **Dotted grid**, **None**, and **Backdrop**. Backdrop uses the embedded `map.png`, centered and scaled to cover the viewport. The application remembers this choice as `background: dotted-grid | none | backdrop` in configuration, separately from project JSON and Undo. Older configs without this field default to the dotted grid.

`projects_dir` is relative to the application folder or an absolute path. The app maintains `last_project` and `welcome_seen`. Stop the app before editing configuration. Invalid settings fail startup without replacing the config. The server only accepts loopback addresses.

```sh
./dist/odysseus-tracker --data-dir ./tracker-data --listen 127.0.0.1:8043
```

`--data-dir` chooses another config/data folder. `--listen` overrides the configured address for this run without changing the setting. Each running instance should use its own folder; concurrent processes sharing files are not a supported collaboration workflow.

## Project files and saving

Creation derives a lowercase filename from the title, such as `developer-portal.json`. Duplicate names get numeric suffixes. Editing the title keeps the filename stable. Files contain `{project,nodes,seq}`; contacts/tags live inside the project and IDs, references, timestamps, notes, and logs retain their existing shapes. Compatible unknown project/card fields are retained. The initial reader limits are 16 MiB and 10,000 cards; structural references and identifier safety are validated.

Saving an editor applies changes in memory immediately and queues a file save. **Saving…** and **Saved to file** indicate disk progress. Atomic replacement preserves the previous file if a write fails before replacement. Revision conflicts prevent an older tab from overwriting newer disk content.

On a write error, continue editing in memory and use **Retry save** after resolving the cause. **Export JSON** downloads the live state as a backup. **Reopen saved file** explicitly discards unsaved changes after confirmation. Project switching waits for saves and refuses unresolved failures or an open editor. Save or cancel that editor first.

For a readable report, **Export PDF** opens a separate expanded map and notes/log appendix, then the browser print dialog. Select Save as PDF; see the [PDF instructions](USER-GUIDE.md#12-export-an-expanded-map-as-pdf) for page settings. PDF export leaves project files unchanged.

Session Undo covers up to 50 edits in the active project. Creating or opening another project clears session history; restarting does too. **Delete file** deletes an entire project after confirmation and cannot be undone. Card deletion retains all existing eligibility guards and Undo behavior.

## Bring existing browser data across

The Go application does not automatically copy or modify the old `sidequests-v1` browser storage. Keep the original page and browser data until migration is verified.

1. In the existing standalone page or embedded preview, use **Export JSON** and retain a backup.
2. Start the binary once to create its folders, then stop it.
3. Copy the export into its configured projects folder with a filename such as `my-project.json`. Use lowercase letters, numbers, hyphens, or underscores, beginning with a letter or number; maximum basename length is 101 characters.
4. Start the binary and choose the file through **Projects**. The reader accepts exports containing `{project,nodes}` and derives a safe sequence counter; snapshots containing `seq` also work.
5. Check cards, branches, banks, and history before removing your original backup.

There is no import dialog yet. Invalid project files stay on disk and appear with an error in the library. JSON exports continue to omit `seq` and session Undo. The static prototype remains available and retains its storage key and memory-only fallback behavior.

## Development checks

See [Testing](TESTING.md) for Go checks, the offline file-backed browser suite, and the original logic/browser/appearance regressions. Rebuild the binary whenever embedded assets change. Windows and Linux cross-builds establish compilation, not platform runtime verification.
