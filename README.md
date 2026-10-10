# Adobe

Open-source [UEFN-Ducky](https://github.com/UEFN-Ducky/UEFN-Ducky) Store plugin. Control **Illustrator** and **Photoshop** from the shared `uefn-ducky` MCP (`adobe_*`, `illustrator_*`, `photoshop_*`). Windows COM launches or attaches to the apps — no Node, no token, no extra IDE MCP row.

Repo: [UEFN-Ducky/uefn-plugin-adobe](https://github.com/UEFN-Ducky/uefn-plugin-adobe). MIT.

Desktop plugin id `adobe`. Install from the UEFN Ducky Store. Do not sideload.

## Build

```bash
py scripts/build_zip.py
```

Writes `deploy/adobe-1.0.6.ducky-plugin.zip`.

Automations + Pipelines tiles: `adobe.status`, `illustrator.read` / `open` /
`save` / `export`, `photoshop.read` / `export`, `adobe.jsx`. Drop-in templates
export the open file or spawn a ducky to draw then export.

## Next release: ship compiled

This plugin still ships its Python source on the Store. Its next release has to ship compiled and signed, the way Ducky Account and Roguelike do:

1. Give `scripts/release.py` and `scripts/build_zip.py` the compiled build from `uefn-plugin-account` (`build_compiled_zip`, upload by ticket, `--plain` only as an escape hatch).
2. Bump `version` and set `min_app_version` to `1.2.357` or newer (the Store keeps older apps from seeing it).
3. Build only with the UEFN Ducky build engine (UEFN-Ducky `68f4abc` or newer), which compiles and links for baseline x86-64, never with Nuitka or zig run by hand. Before publishing, check the `.pyd` runs on every CPU: `objdump -d <file>.pyd | grep -cE '%(y|z)mm'` must print `0`. Account 1.0.50 and Roguelike 1.12.44 carried the build PC's AVX-512 and stopped Ducky opening on every CPU without it.
4. Publish, then check the download with the start-up license check (signature, id and version, compiled, team access), not only the signature.
5. A compiled build can't `importlib.reload` its own modules (Python raises SystemError), so reload only when running from source. Before publishing, install the source and compiled zips into a throwaway Ducky and check they register the same panel calls, tools and workflow nodes, and that those calls still work after the plugin reloads.

Remove this section once a compiled version is live.

## License

MIT. Copyright (c) 2026 Mindful Path Company, LLC. See [LICENSE](LICENSE).

Vendored JSX: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
