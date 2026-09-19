
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;

    var group = findItemByUUID(params.uuid);
    if (!group) {
      writeResultFile(RESULT_PATH, { error: true, message: "Object not found: " + params.uuid });
    } else if (group.typename !== "GroupItem") {
      writeResultFile(RESULT_PATH, { error: true, message: "Object is not a group (type: " + group.typename + ")" });
    } else {
      var childUuids = [];
      var children = [];
      for (var ci = 0; ci < group.pageItems.length; ci++) {
        children.push(group.pageItems[ci]);
      }
      for (var mi = 0; mi < children.length; mi++) {
        var childUuid = ensureUUID(children[mi]);
        childUuids.push(childUuid);
        children[mi].move(group, ElementPlacement.PLACEBEFORE);
      }
      group.remove();

      var verifiedChildren = [];
      for (var vi = 0; vi < children.length; vi++) {
        verifiedChildren.push(verifyItem(children[vi]));
      }
      writeResultFile(RESULT_PATH, {
        success: true,
        releasedCount: childUuids.length,
        childUuids: childUuids,
        verified: verifiedChildren
      });
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "ungroup_objects failed: " + e.message, line: e.line });
  }
}
