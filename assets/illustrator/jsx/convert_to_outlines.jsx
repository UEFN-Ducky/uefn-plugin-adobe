
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;
    var target = params.target;
    var count = 0;
    var hasError = false;

    if (target === "selection") {
      var sel = doc.selection;
      if (sel && sel.length > 0) {
        for (var i = sel.length - 1; i >= 0; i--) {
          try {
            if (sel[i].typename === "TextFrame") {
              sel[i].createOutline();
              count++;
            }
          } catch(e) {}
        }
      }
    } else if (target === "all") {
      var frames = doc.textFrames;
      for (var i = frames.length - 1; i >= 0; i--) {
        try {
          frames[i].createOutline();
          count++;
        } catch(e) {}
      }
    } else {
      // target is a layer name
      try {
        var layer = doc.layers.getByName(target);
        frames = layer.textFrames;
        for (var i = frames.length - 1; i >= 0; i--) {
          try {
            frames[i].createOutline();
            count++;
          } catch(e) {}
        }
      } catch(e) {
        hasError = true;
        writeResultFile(RESULT_PATH, { error: true, message: "Layer not found: " + target });
      }
    }

    if (!hasError) {
      writeResultFile(RESULT_PATH, { success: true, convertedCount: count, verified: { convertedCount: count } });
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "Failed to convert to outlines: " + e.message, line: e.line });
  }
}
