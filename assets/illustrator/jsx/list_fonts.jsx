
try {
  var verErr = checkIllustratorVersion();
  if (verErr) {
    writeResultFile(RESULT_PATH, verErr);
  } else {
    var params = readParamsFile(PARAMS_PATH);
    var filterStr = (params.filter || "").toLowerCase();
    var limit = params.limit || 100;
    var fonts = [];

    for (var i = 0; i < app.textFonts.length; i++) {
      var tf = app.textFonts[i];
      if (filterStr) {
        var nameL = tf.name.toLowerCase();
        var familyL = tf.family ? tf.family.toLowerCase() : "";
        if (nameL.indexOf(filterStr) === -1 && familyL.indexOf(filterStr) === -1) {
          continue;
        }
      }
      fonts.push({
        name: tf.name,
        family: tf.family,
        style: tf.style
      });
      if (fonts.length >= limit) break;
    }

    writeResultFile(RESULT_PATH, {
      count: fonts.length,
      totalAvailable: app.textFonts.length,
      fonts: fonts
    });
  }
} catch (e) {
  writeResultFile(RESULT_PATH, { error: true, message: "list_fonts failed: " + e.message, line: e.line });
}
