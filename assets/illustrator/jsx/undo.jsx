
try {
  var verErr = checkIllustratorVersion();
  if (verErr) {
    writeResultFile(RESULT_PATH, verErr);
  } else {
    var params = readParamsFile(PARAMS_PATH);
    var action = params.action || "undo";
    var count = params.count || 1;

    for (var i = 0; i < count; i++) {
      if (action === "undo") {
        app.undo();
      } else {
        app.redo();
      }
    }

    writeResultFile(RESULT_PATH, {
      success: true,
      action: action,
      count: count
    });
  }
} catch (e) {
  writeResultFile(RESULT_PATH, { error: true, message: "undo failed: " + e.message, line: e.line });
}
