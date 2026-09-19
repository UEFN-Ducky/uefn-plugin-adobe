
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;
    var coordSystem = params.coordinate_system || "artboard-web";

    var targetLayer = null;
    var layerError = false;
    if (params.target_layer) {
      try {
        targetLayer = doc.layers.getByName(params.target_layer);
      } catch(e) {
        writeResultFile(RESULT_PATH, { error: true, message: "Layer not found: " + params.target_layer });
        layerError = true;
      }
    }

    if (!layerError) {
      var results = [];
      for (var i = 0; i < params.uuids.length; i++) {
        var item = findItemByUUID(params.uuids[i]);
        if (!item) continue;

        var dup;
        if (targetLayer) {
          dup = item.duplicate(targetLayer, ElementPlacement.PLACEATEND);
        } else {
          dup = item.duplicate();
        }

        if (params.offset) {
          var dx = params.offset.x || 0;
          var dy = params.offset.y || 0;
          if (coordSystem === "artboard-web") {
            dup.translate(dx, -dy);
          } else {
            dup.translate(dx, dy);
          }
        }

        // 複製は元オブジェクトの note(UUID含む)を継承するため、新しいUUIDを強制割り当て
        var newUuid = generateUUID();
        try {
          var dupNote = dup.note || "";
          var oldUuid = extractUUIDFromNote(dupNote);
          if (oldUuid) {
            // UUID部分だけ置換し、メタデータ(::key=value)は保持
            dup.note = newUuid + dupNote.substring(36);
          } else {
            dup.note = newUuid;
          }
        } catch(e) {
          // note 書き込み不可の場合はそのまま
        }
        results.push({ sourceUuid: params.uuids[i], newUuid: newUuid, verified: verifyItem(dup) });
      }

      writeResultFile(RESULT_PATH, {
        success: true,
        duplicatedCount: results.length,
        items: results
      });
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "duplicate_objects failed: " + e.message, line: e.line });
  }
}
