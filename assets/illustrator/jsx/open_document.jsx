
try {
  var verErr = checkIllustratorVersion();
  if (verErr) {
    writeResultFile(RESULT_PATH, verErr);
  } else {
    var params = readParamsFile(PARAMS_PATH);
    var openFile = new File(params.path);
    if (!openFile.exists) {
      writeResultFile(RESULT_PATH, { error: true, message: "File not found: " + params.path });
    } else {
      var colorSpace = null;
      if (params.color_space === "RGB") colorSpace = DocumentColorSpace.RGB;
      else if (params.color_space === "CMYK") colorSpace = DocumentColorSpace.CMYK;

      var doc;
      if (colorSpace) {
        doc = app.open(openFile, colorSpace);
      } else {
        doc = app.open(openFile);
      }

      $.sleep(500);

      var docName = doc.name;
      var fullPath = "";
      try { fullPath = doc.fullName.fsName; } catch(e) {}
      writeResultFile(RESULT_PATH, {
        success: true,
        name: docName,
        path: fullPath,
        colorSpace: (doc.documentColorSpace === DocumentColorSpace.CMYK) ? "CMYK" : "RGB"
      });
    }
  }
} catch (e) {
  writeResultFile(RESULT_PATH, { error: true, message: "open_document failed: " + e.message, line: e.line });
}
