
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;
    var uuids = params.uuids;

    if (!uuids || uuids.length === 0) {
      doc.selection = null;
      writeResultFile(RESULT_PATH, { success: true, selected: [], deselected: true });
    } else {
      var notFound = [];
      var items = [];

      for (var i = 0; i < uuids.length; i++) {
        var item = findItemByUUID(uuids[i]);
        if (item) {
          items.push(item);
        } else {
          notFound.push(uuids[i]);
        }
      }

      doc.selection = items;

      // Post-operation verification: 実際の選択状態を読み返す
      var actualSel = doc.selection;
      var verified = [];
      for (var k = 0; k < actualSel.length; k++) {
        var sel = actualSel[k];
        var selUuid = "";
        try { selUuid = sel.note || ""; } catch(e2) {}
        verified.push({ uuid: selUuid, name: sel.name || "", type: getItemType(sel) });
      }

      var result = {
        success: true,
        verified: { selectionCount: verified.length, selection: verified }
      };
      if (notFound.length > 0) result.notFound = notFound;
      writeResultFile(RESULT_PATH, result);
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "select_objects failed: " + e.message, line: e.line });
  }
}
