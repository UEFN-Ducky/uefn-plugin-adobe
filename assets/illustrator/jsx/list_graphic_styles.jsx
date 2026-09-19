
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var doc = app.activeDocument;
    var styles = [];
    for (var i = 0; i < doc.graphicStyles.length; i++) {
      styles.push({ index: i, name: doc.graphicStyles[i].name });
    }
    writeResultFile(RESULT_PATH, { count: styles.length, styles: styles });
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "list_graphic_styles failed: " + e.message, line: e.line });
  }
}
