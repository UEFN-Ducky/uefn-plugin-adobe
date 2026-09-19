
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;

    var item = findItemByUUID(params.uuid);
    if (!item) {
      writeResultFile(RESULT_PATH, { error: true, message: "Object not found: " + params.uuid });
    } else if (item.typename !== "TextFrame") {
      writeResultFile(RESULT_PATH, { error: true, message: "Object is not a text frame (type: " + item.typename + ")" });
    } else {
      var style = null;
      try {
        if (params.style_type === "character") {
          style = doc.characterStyles.getByName(params.style_name);
        } else {
          style = doc.paragraphStyles.getByName(params.style_name);
        }
      } catch(e) {
        writeResultFile(RESULT_PATH, {
          error: true,
          message: params.style_type + " style not found: " + params.style_name
        });
      }

      if (style) {
        var clearOverrides = params.clear_overrides === true;
        if (params.style_type === "character") {
          style.applyTo(item.textRange, clearOverrides);
        } else {
          for (var pi = 0; pi < item.paragraphs.length; pi++) {
            style.applyTo(item.paragraphs[pi], clearOverrides);
          }
        }
        writeResultFile(RESULT_PATH, {
          success: true,
          styleType: params.style_type,
          styleName: params.style_name,
          verified: verifyItem(item)
        });
      }
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "apply_text_style failed: " + e.message, line: e.line });
  }
}
