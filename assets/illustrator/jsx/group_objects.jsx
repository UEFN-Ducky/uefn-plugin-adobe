
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;
    var uuids = params.uuids;

    var items = [];
    for (var i = 0; i < uuids.length; i++) {
      var item = findItemByUUID(uuids[i]);
      if (item) items.push(item);
    }

    if (items.length === 0) {
      writeResultFile(RESULT_PATH, { error: true, message: "No valid objects found for the given UUIDs" });
    } else {
      var parentLayer = items[0].layer;
      var group = parentLayer.groupItems.add();

      // 順方向で PLACEATEND → items[0] がグループ最下位 (bottom)、最後が最上位 (top)
      // クリッピングマスクでは最上位アイテム（＝配列末尾）がクリップパスになる
      for (var j = 0; j < items.length; j++) {
        items[j].move(group, ElementPlacement.PLACEATEND);
      }

      if (params.name) {
        group.name = params.name;
      }
      if (params.clipped === true) {
        group.clipped = true;
      }

      var uuid = ensureUUID(group);
      writeResultFile(RESULT_PATH, {
        success: true,
        uuid: uuid,
        childCount: group.pageItems.length,
        verified: verifyItem(group)
      });
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "group_objects failed: " + e.message, line: e.line });
  }
}
