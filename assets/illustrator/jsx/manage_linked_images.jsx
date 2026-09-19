
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
    } else if (item.typename !== "PlacedItem") {
      writeResultFile(RESULT_PATH, { error: true, message: "Object is not a linked image (type: " + item.typename + ")" });
    } else {
      if (params.action === "relink") {
        if (!params.new_path) {
          writeResultFile(RESULT_PATH, { error: true, message: "new_path is required for relink" });
        } else {
          var newFile = new File(params.new_path);
          if (!newFile.exists) {
            writeResultFile(RESULT_PATH, { error: true, message: "File not found: " + params.new_path });
          } else {
            item.relink(newFile);
            writeResultFile(RESULT_PATH, {
              success: true,
              action: "relink",
              uuid: params.uuid,
              newPath: params.new_path,
              verified: verifyItem(item)
            });
          }
        }
      } else if (params.action === "embed") {
        var tag = "__embed_" + (new Date()).getTime();
        item.name = tag;
        item.embed();
        var resultUuid = null;
        for (var ri = 0; ri < doc.rasterItems.length; ri++) {
          if (doc.rasterItems[ri].name === tag) {
            doc.rasterItems[ri].name = "";
            resultUuid = ensureUUID(doc.rasterItems[ri]);
            break;
          }
        }
        if (resultUuid) {
          var embeddedItem = null;
          for (var ei = 0; ei < doc.rasterItems.length; ei++) {
            if (ensureUUID(doc.rasterItems[ei]) === resultUuid) {
              embeddedItem = doc.rasterItems[ei];
              break;
            }
          }
          writeResultFile(RESULT_PATH, {
            success: true,
            action: "embed",
            previousUuid: params.uuid,
            newUuid: resultUuid,
            verified: embeddedItem ? verifyItem(embeddedItem) : null
          });
        } else {
          writeResultFile(RESULT_PATH, {
            error: true,
            message: "embed() succeeded but resulting RasterItem could not be found"
          });
        }
      } else {
        writeResultFile(RESULT_PATH, { error: true, message: "Unknown action: " + params.action });
      }
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "manage_linked_images failed: " + e.message, line: e.line });
  }
}
