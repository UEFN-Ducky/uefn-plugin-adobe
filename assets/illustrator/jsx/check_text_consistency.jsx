
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;
    var filterArtboard = (params && typeof params.artboard_index === "number") ? params.artboard_index : null;

    if (filterArtboard !== null && (filterArtboard < 0 || filterArtboard >= doc.artboards.length)) {
      writeResultFile(RESULT_PATH, {
        error: true,
        message: "Artboard index " + filterArtboard + " is out of range (0-" + (doc.artboards.length - 1) + ")"
      });
    } else {
      var frames = [];
      for (var i = 0; i < doc.textFrames.length; i++) {
        var tf = doc.textFrames[i];
        try {
          var uuid = ensureUUID(tf);
          var abIdx = getArtboardIndexForItem(tf);

          if (filterArtboard !== null && abIdx !== filterArtboard) continue;

          var layerName = getParentLayerName(tf);

          frames.push({
            uuid: uuid,
            contents: tf.contents,
            layerName: layerName,
            artboardIndex: abIdx
          });
        } catch(e) {}
      }

      writeResultFile(RESULT_PATH, {
        totalFrames: frames.length,
        frames: frames
      });
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: e.message, line: e.line });
  }
}
