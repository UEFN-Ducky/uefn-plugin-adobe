
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;
    var autoDetect = (params && params.auto_detect === true);

    if (autoDetect) {
      // Collect all objects with colors and bounds for overlap analysis
      var colorItems = [];

      // Path items
      for (var i = 0; i < doc.pathItems.length; i++) {
        var item = doc.pathItems[i];
        try {
          var b = item.geometricBounds;
          var info = {
            uuid: ensureUUID(item),
            name: item.name || "",
            type: getItemType(item),
            bounds: { left: b[0], top: b[1], right: b[2], bottom: b[3] },
            fillColor: null,
            strokeColor: null
          };
          try { if (item.filled) info.fillColor = colorToObject(item.fillColor); } catch(e2) {}
          try { if (item.stroked) info.strokeColor = colorToObject(item.strokeColor); } catch(e2) {}
          if (info.fillColor || info.strokeColor) colorItems.push(info);
        } catch(e) {}
      }

      // Text frames (foreground text)
      for (var ti = 0; ti < doc.textFrames.length; ti++) {
        var tf = doc.textFrames[ti];
        try {
          var tb = tf.geometricBounds;
          var tInfo = {
            uuid: ensureUUID(tf),
            name: tf.name || tf.contents.substring(0, 30),
            type: "text",
            bounds: { left: tb[0], top: tb[1], right: tb[2], bottom: tb[3] },
            fillColor: null,
            strokeColor: null
          };
          try {
            if (tf.textRanges.length > 0) {
              tInfo.fillColor = colorToObject(tf.textRanges[0].characterAttributes.fillColor);
            }
          } catch(e2) {}
          if (tInfo.fillColor) colorItems.push(tInfo);
        } catch(e) {}
      }

      writeResultFile(RESULT_PATH, { colorItems: colorItems });
    } else {
      // Manual mode: just return success, calculation done in Node.js
      writeResultFile(RESULT_PATH, { colorItems: [] });
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: e.message, line: e.line });
  }
}
