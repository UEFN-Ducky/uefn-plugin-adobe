
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;
    var coordSystem = params.coordinate_system || "artboard-web";

    var filePath = params.file_path;
    var imgFile = new File(filePath);
    if (!imgFile.exists) {
      writeResultFile(RESULT_PATH, { error: true, message: "Image file not found: " + filePath });
    } else if (/\\.svgz?$/i.test(filePath)) {
      writeResultFile(RESULT_PATH, {
        error: true,
        message: "place_image does not support SVG files. SVG placed via PlacedItems becomes a non-editable linked artwork and often leaves broken link items in the document. Use import_svg_as_editable to bring SVG content in as editable Illustrator paths/text."
      });
    } else {
      var targetLayer = resolveTargetLayer(doc, params.layer_name);

      var placed = targetLayer.placedItems.add();
      try {
        placed.file = imgFile;
      } catch (linkErr) {
        // Setting .file failed — remove the orphaned PlacedItem so no broken link remains
        try { placed.remove(); } catch (rmErr) {}
        writeResultFile(RESULT_PATH, {
          error: true,
          message: "Failed to link image file (likely unsupported or corrupt): " + linkErr.message + ". The empty placed item was removed."
        });
        return;
      }

      // Position
      if (typeof params.x === "number" && typeof params.y === "number") {
        var abRect = (coordSystem === "artboard-web") ? getActiveArtboardRect() : null;
        var pos = webToAiPoint(params.x, params.y, coordSystem, abRect);
        placed.left = pos[0];
        placed.top = pos[1];
      }

      if (params.name) {
        placed.name = params.name;
      }

      // Embed if requested — embed() transforms PlacedItem into RasterItem
      var resultItem = placed;
      if (params.embed === true) {
        // Mark with a temporary tag before embed so we can find the resulting RasterItem
        var tag = "__place_image_embed_" + (new Date()).getTime();
        placed.name = tag;
        placed.embed();
        // After embed(), 'placed' is no longer valid. Find the RasterItem by name.
        var foundEmbedded = false;
        for (var ri = 0; ri < doc.rasterItems.length; ri++) {
          if (doc.rasterItems[ri].name === tag) {
            resultItem = doc.rasterItems[ri];
            foundEmbedded = true;
            break;
          }
        }
        if (!foundEmbedded) {
          writeResultFile(RESULT_PATH, { error: true, message: "embed() succeeded but resulting RasterItem could not be found" });
          return;
        }
        // タグ名をクリア（ユーザー指定名があれば復元、なければ空文字に）
        resultItem.name = params.name || "";
      }

      var uuid = ensureUUID(resultItem);
      var bounds = resultItem.geometricBounds;
      var widthPt = bounds[2] - bounds[0];
      var heightPt = -(bounds[3] - bounds[1]);
      if (widthPt < 0) widthPt = -widthPt;
      if (heightPt < 0) heightPt = -heightPt;

      writeResultFile(RESULT_PATH, {
        uuid: uuid,
        coordinateSystem: coordSystem,
        type: params.embed ? "embedded" : "linked",
        filePath: filePath,
        widthPt: widthPt,
        heightPt: heightPt,
        verified: verifyItem(resultItem, coordSystem, abRect)
      });
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "Failed to place image: " + e.message, line: e.line });
  }
}
