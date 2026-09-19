---
name: connection
description: Adobe COM heal, status states, official MCP probe
---

# Adobe connection

Transport is Windows COM: `Illustrator.Application` / `Photoshop.Application`.

Two Illustrator editions can run at once (2026 + Beta). `GetActiveObject` often
binds the **empty Beta**. Tools therefore:

1. NativeOM on Illustrator windows that show a `.ai` title
2. `BindToMoniker` / `GetObject` on the open file path or document name
3. `GetActiveObject` only if that instance already has documents
4. `CreateObject` last — and never launch a second edition if one is running

PowerShell `DoJavaScript` first; `TYPE_E_LIBNOTREGISTERED` falls back to `cscript`.

`adobe_status` heals only when nothing is running. If a `.ai` window exists,
the file is open — call `illustrator_get_document_info`.

Official Illustrator Beta MCP (`http://127.0.0.1:18412/v1/mcp`) is a **bonus line**
on `adobe_status.official_mcp.reachable`. Never ask for a token.

Do not install CEP panels or set `PlayerDebugMode`.
