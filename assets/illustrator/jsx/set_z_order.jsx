
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);

    var item = findItemByUUID(params.uuid);
    if (!item) {
      writeResultFile(RESULT_PATH, { error: true, message: "Object not found: " + params.uuid });
    } else {
      var cmdMap = {
        "bring_to_front": ZOrderMethod.BRINGTOFRONT,
        "bring_forward": ZOrderMethod.BRINGFORWARD,
        "send_backward": ZOrderMethod.SENDBACKWARD,
        "send_to_back": ZOrderMethod.SENDTOBACK
      };
      item.zOrder(cmdMap[params.command]);
      writeResultFile(RESULT_PATH, {
        success: true,
        uuid: params.uuid,
        command: params.command,
        newZIndex: getZIndex(item),
        verified: verifyItem(item)
      });
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "set_z_order failed: " + e.message, line: e.line });
  }
}
