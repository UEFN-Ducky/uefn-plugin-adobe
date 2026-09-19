
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;
    var forceUnlock = params.force_unlock === true;

    var deleted = [];
    var notFound = [];
    var errors = [];

    for (var i = 0; i < params.uuids.length; i++) {
      var uuid = params.uuids[i];
      var item = findItemByUUID(uuid);
      if (!item) {
        notFound.push(uuid);
        continue;
      }

      try {
        var snap = { uuid: uuid, name: item.name || "", type: getItemType(item), layer: getParentLayerName(item) };

        if (item.locked) {
          if (forceUnlock) {
            item.locked = false;
          } else {
            errors.push({ uuid: uuid, message: "Object is locked. Set force_unlock: true to delete it." });
            continue;
          }
        }

        item.remove();
        if (_uuidIndex) { delete _uuidIndex[uuid]; }
        deleted.push(snap);
      } catch (itemErr) {
        errors.push({ uuid: uuid, message: itemErr.message });
      }
    }

    writeResultFile(RESULT_PATH, {
      success: errors.length === 0,
      deletedCount: deleted.length,
      deleted: deleted,
      notFound: notFound,
      errors: errors
    });
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "delete_objects failed: " + e.message, line: e.line });
  }
}
