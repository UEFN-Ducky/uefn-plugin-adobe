
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;

    var fromMap = {
      "artboard": CoordinateSystem.ARTBOARDCOORDINATESYSTEM,
      "document": CoordinateSystem.DOCUMENTCOORDINATESYSTEM
    };
    var toMap = {
      "artboard": CoordinateSystem.ARTBOARDCOORDINATESYSTEM,
      "document": CoordinateSystem.DOCUMENTCOORDINATESYSTEM
    };

    var fromSys = fromMap[params.from];
    var toSys = toMap[params.to];

    if (fromSys == null || toSys == null) {
      writeResultFile(RESULT_PATH, { error: true, message: "Invalid coordinate system. Use 'artboard' or 'document'." });
    } else {
      var result = doc.convertCoordinate([params.point.x, params.point.y], fromSys, toSys);
      writeResultFile(RESULT_PATH, {
        x: result[0],
        y: result[1],
        from: params.from,
        to: params.to
      });
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "convert_coordinate failed: " + e.message, line: e.line });
  }
}
