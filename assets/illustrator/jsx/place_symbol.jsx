
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;
    var coordSystem = params.coordinate_system || "artboard-web";

    if (params.action === "place") {
      var sym = null;
      try {
        sym = doc.symbols.getByName(params.symbol_name);
      } catch(e) {
        writeResultFile(RESULT_PATH, { error: true, message: "Symbol not found: " + params.symbol_name });
      }
      if (sym) {
        var si = doc.symbolItems.add(sym);
        if (typeof params.x === "number" && typeof params.y === "number") {
          var abIndex = doc.artboards.getActiveArtboardIndex();
          var abRect = getArtboardRectByIndex(abIndex);
          si.position = webToAiPoint(params.x, params.y, coordSystem, abRect);
        }
        var uuid = ensureUUID(si);
        writeResultFile(RESULT_PATH, { success: true, uuid: uuid, symbolName: params.symbol_name, verified: verifyItem(si) });
      }
    } else if (params.action === "replace") {
      if (!params.uuid) {
        writeResultFile(RESULT_PATH, { error: true, message: "uuid is required for replace action" });
      } else {
        var item = findItemByUUID(params.uuid);
        if (!item || item.typename !== "SymbolItem") {
          writeResultFile(RESULT_PATH, { error: true, message: "Symbol item not found: " + params.uuid });
        } else {
          var newSym = null;
          try {
            newSym = doc.symbols.getByName(params.symbol_name);
          } catch(e) {
            writeResultFile(RESULT_PATH, { error: true, message: "Symbol not found: " + params.symbol_name });
          }
          if (newSym) {
            item.symbol = newSym;
            writeResultFile(RESULT_PATH, { success: true, uuid: params.uuid, newSymbolName: params.symbol_name });
          }
        }
      }
    } else {
      writeResultFile(RESULT_PATH, { error: true, message: "Unknown action: " + params.action });
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "place_symbol failed: " + e.message, line: e.line });
  }
}
