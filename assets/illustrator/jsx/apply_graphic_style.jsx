
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;

    var style = null;
    try {
      style = doc.graphicStyles.getByName(params.style_name);
    } catch(e) {
      writeResultFile(RESULT_PATH, { error: true, message: "Graphic style not found: " + params.style_name });
    }

    if (style) {
      var appliedCount = 0;
      for (var i = 0; i < params.uuids.length; i++) {
        var item = findItemByUUID(params.uuids[i]);
        if (item) {
          if (params.merge === true) {
            style.mergeTo(item);
          } else {
            style.applyTo(item);
          }
          appliedCount++;
        }
      }
      var verifiedItems = [];
      for (var vi = 0; vi < params.uuids.length; vi++) {
        var vItem = findItemByUUID(params.uuids[vi]);
        if (vItem) verifiedItems.push(verifyItem(vItem));
      }
      writeResultFile(RESULT_PATH, {
        success: true,
        styleName: params.style_name,
        appliedCount: appliedCount,
        merge: params.merge === true,
        verified: verifiedItems
      });
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "apply_graphic_style failed: " + e.message, line: e.line });
  }
}
