
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;
    var mode = params.mode || "save";

    if (mode === "save") {
      doc.save();
      writeResultFile(RESULT_PATH, { success: true, mode: "save" });
    } else if (mode === "save_as") {
      var savePath = params.path;
      // Default path generation when path is omitted
      if (!savePath) {
        var dir;
        try {
          var docPath = doc.path ? doc.path.fsName : '';
          if (docPath && docPath !== '/') {
            dir = docPath;
          } else {
            dir = Folder.desktop.fsName;
          }
        } catch (e) {
          dir = Folder.desktop.fsName;
        }
        var baseName = doc.name.replace(/\\.[^.]+$/, '').replace(/ /g, '-');
        var sep = Folder.fs === 'Windows' ? '\\\\' : '/';
        savePath = dir + sep + baseName + '.ai';
        var counter = 2;
        while (new File(savePath).exists) {
          savePath = dir + sep + baseName + '_' + counter + '.ai';
          counter++;
        }
      }
      var saveFile = new File(savePath);
      doc.saveAs(saveFile);
      writeResultFile(RESULT_PATH, { success: true, mode: "save_as", path: savePath });
    } else {
      writeResultFile(RESULT_PATH, { error: true, message: "Unknown mode: " + mode });
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "save_document failed: " + e.message, line: e.line });
  }
}
