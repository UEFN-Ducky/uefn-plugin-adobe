
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;

    var targetLayer = null;
    try {
      targetLayer = doc.layers.getByName(params.target_layer);
    } catch(e) {
      writeResultFile(RESULT_PATH, { error: true, message: "Layer not found: " + params.target_layer });
    }

    if (targetLayer) {
      var placement = (params.position === "end")
        ? ElementPlacement.PLACEATEND
        : ElementPlacement.PLACEATBEGINNING;

      var movedCount = 0;
      for (var i = 0; i < params.uuids.length; i++) {
        var item = findItemByUUID(params.uuids[i]);
        if (item) {
          item.move(targetLayer, placement);
          movedCount++;
        }
      }

      var verifiedItems = [];
      for (var vi = 0; vi < params.uuids.length; vi++) {
        var vItem = findItemByUUID(params.uuids[vi]);
        if (vItem) verifiedItems.push(verifyItem(vItem));
      }
      writeResultFile(RESULT_PATH, {
        success: true,
        movedCount: movedCount,
        targetLayer: params.target_layer,
        verified: verifiedItems
      });
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "move_to_layer failed: " + e.message, line: e.line });
  }
}
