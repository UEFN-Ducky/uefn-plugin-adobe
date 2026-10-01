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

## License

MIT. Copyright (c) 2026 Mindful Path Company, LLC. See [LICENSE](LICENSE).

Vendored JSX: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
