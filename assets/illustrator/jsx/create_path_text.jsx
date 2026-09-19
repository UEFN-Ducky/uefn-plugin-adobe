
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;
    
function findFontCandidates(fontName) {
  var candidates = [];
  var searchLower = fontName.toLowerCase();
  for (var fi = 0; fi < app.textFonts.length; fi++) {
    var f = app.textFonts[fi];
    if (f.name.toLowerCase().indexOf(searchLower) >= 0 ||
        (f.family && f.family.toLowerCase().indexOf(searchLower) >= 0)) {
      candidates.push({ name: f.name, family: f.family });
      if (candidates.length >= 10) break;
    }
  }
  return candidates;
}


    var pathItem = findItemByUUID(params.path_uuid);
    if (!pathItem) {
      writeResultFile(RESULT_PATH, { error: true, message: "Path not found: " + params.path_uuid });
    } else if (pathItem.typename !== "PathItem" && pathItem.typename !== "CompoundPathItem") {
      writeResultFile(RESULT_PATH, { error: true, message: "Object is not a path (type: " + pathItem.typename + ")" });
    } else {
      var targetLayer = resolveTargetLayer(doc, params.layer_name);
      var tf = targetLayer.textFrames.pathText(pathItem);

      var rawContents = params.contents || "";
      tf.contents = rawContents.split(String.fromCharCode(10)).join(String.fromCharCode(13));

      if (params.name) tf.name = params.name;

      var charAttrs = tf.textRange.characterAttributes;
      var fontCandidates = null;

      if (params.font_name) {
        try {
          charAttrs.textFont = app.textFonts.getByName(params.font_name);
        } catch(e) {
          fontCandidates = findFontCandidates(params.font_name);
        }
      }

      if (typeof params.font_size === "number") {
        charAttrs.size = params.font_size;
      }

      var uuid = ensureUUID(tf);
      var resultData = { success: true, uuid: uuid, verified: verifyItem(tf) };
      if (fontCandidates !== null) {
        resultData.font_warning = "Font '" + params.font_name + "' not found. Text frame created with default font.";
        resultData.font_candidates = fontCandidates;
      }
      writeResultFile(RESULT_PATH, resultData);
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "create_path_text failed: " + e.message, line: e.line });
  }
}
