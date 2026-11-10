# Adobe

Open-source [UEFN-Ducky](https://github.com/UEFN-Ducky/UEFN-Ducky) Store plugin. Control **Illustrator**, **Photoshop**, **After Effects** and **Premiere Pro** from the shared `uefn-ducky` MCP (`adobe_*`, `illustrator_*`, `photoshop_*`, `aftereffects_*`, `premiere_*`). Windows COM launches or attaches to Illustrator and Photoshop — no Node, no token, no extra IDE MCP row.

Repo: [UEFN-Ducky/uefn-plugin-adobe](https://github.com/UEFN-Ducky/uefn-plugin-adobe). MIT.

Desktop plugin id `adobe`. Install from the UEFN Ducky Store. Do not sideload.

## Build

The Store ships this plugin compiled and signed (from 1.0.7, UEFN Ducky 1.2.357 or newer):

```bash
py scripts/release.py --publish --changelog "…"   # commit + push, compiled build, upload, publish
py scripts/build_zip.py --compiled                 # compiled zip only, to test
py scripts/build_zip.py                            # readable zip (release.py --plain ships it: escape hatch only)
```

Builds go only through the UEFN Ducky build engine (the UEFN-Ducky checkout next to this repo, or `DUCKY_REPO`), never Nuitka or zig by hand. The engine builds for every x86-64 CPU and then disassembles the backend: it refuses a build with AVX, AVX-512, BMI or any other instruction some PCs lack, and so does the Store on upload. The JSX scripts and `bind.ps1` under `assets/` ship as files; the backend finds them from its own folder in both builds.

Before a release, install the readable and the compiled zip into a throwaway Ducky and check both register the same tools and workflow nodes, and that they still work after the plugin reloads. After it, check the download with the start-up license check (signature, id and version, compiled), not only the signature.

**PhotoCraft** ([storytold/photocraft](https://github.com/storytold/photocraft)) goes through its own loopback control server instead of COM (`photocraft_*`). The first call launches a controllable copy (`--control 47878`, token file in the plugin's local folder, the home folder as read/write root). Overrides: `PHOTOCRAFT_EXE`, `PHOTOCRAFT_CONTROL_PORT`, `PHOTOCRAFT_ROOT`.

**VectorCraft** ([storytold/vectorcraft](https://github.com/storytold/vectorcraft)), the Illustrator counterpart, works the same way (`vectorcraft_*`). The first call launches a controllable copy (`--control 47879`, the home folder as read/write root); its port takes no token. Overrides: `VECTORCRAFT_EXE`, `VECTORCRAFT_CONTROL_PORT`, `VECTORCRAFT_ROOT`.

**After Effects** (`aftereffects_*`, 29 commands + status + raw JSX): each call writes a self-contained job script and runs `AfterFX.exe -r <job>` against the running instance, inside one undo group with dialogs suppressed; the job writes its result JSON under `%LOCALAPPDATA%/UEFN-Ducky/adobe/aftereffects/`. Needs After Effects' "Allow Scripts to Write Files and Access Network" pref. Override: `AE_EXE`.

**Premiere Pro** (`premiere_*`, 31 commands incl. link / unlink, J and L cuts, roll and slip edits, volume in dB + status, bridge install/remove, presets, raw JSX): Premiere runs scripts only inside a panel, so `assets/premiere/cep` ships the Ducky Bridge CEP panel. `premiere_install_bridge` copies it to `%APPDATA%/Adobe/CEP/extensions/com.uefnducky.premiere.bridge` and sets `PlayerDebugMode` (HKCU, CSXS.9–12, restored by `premiere_remove_bridge`). The panel polls `%LOCALAPPDATA%/UEFN-Ducky/adobe/premiere/` for job scripts and writes a heartbeat. Override: `PREMIERE_EXE`.

Shared ExtendScript core: `assets/common/ducky.jsx`. Tests (`py -3 -m pytest backend`) run real built jobs in Node against stub hosts when `node` is on PATH.

Automations + Pipelines tiles: `adobe.status`, `illustrator.read` / `open` /
`save` / `export`, `photoshop.read` / `export`, `aftereffects.read` / `render_frame`,
`premiere.read` / `export_frame`, `adobe.jsx`. Drop-in templates export the open file,
spawn a ducky to draw then export, animate in After Effects, or edit in Premiere.

## License

MIT. Copyright (c) 2026 Mindful Path Company, LLC. See [LICENSE](LICENSE).

Vendored JSX: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
