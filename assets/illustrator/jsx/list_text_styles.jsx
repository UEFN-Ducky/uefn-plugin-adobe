
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var doc = app.activeDocument;
    var charStyles = [];
    for (var i = 0; i < doc.characterStyles.length; i++) {
      charStyles.push({ name: doc.characterStyles[i].name });
    }
    var paraStyles = [];
    for (var j = 0; j < doc.paragraphStyles.length; j++) {
      paraStyles.push({ name: doc.paragraphStyles[j].name });
    }
    writeResultFile(RESULT_PATH, {
      characterStyles: charStyles,
      paragraphStyles: paraStyles
    });
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "list_text_styles failed: " + e.message, line: e.line });
  }
}
