

function createColor(colorObj) {
  if (!colorObj || colorObj.type === "none") return new NoColor();
  if (colorObj.type === "cmyk") {
    var c = new CMYKColor();
    c.cyan = colorObj.c;
    c.magenta = colorObj.m;
    c.yellow = colorObj.y;
    c.black = colorObj.k;
    return c;
  }
  if (colorObj.type === "rgb") {
    var c = new RGBColor();
    c.red = colorObj.r;
    c.green = colorObj.g;
    c.blue = colorObj.b;
    return c;
  }
  if (colorObj.type === "gray") {
    var c = new GrayColor();
    c.gray = colorObj.value;
    return c;
  }
  return new NoColor();
}

function applyOptionalFill(item, colorObj) {
  if (typeof colorObj === "undefined") return;
  if (!colorObj || colorObj.type === "none") {
    item.filled = false;
    return;
  }
  item.fillColor = createColor(colorObj);
  item.filled = true;
}

function applyStroke(item, strokeObj, defaultStroked) {
  if (!strokeObj) {
    item.stroked = defaultStroked;
    return;
  }
  if (typeof strokeObj.width === "number") {
    item.strokeWidth = strokeObj.width;
  }
  if (strokeObj.color && strokeObj.color.type === "none") {
    item.stroked = false;
    return;
  }
  if (strokeObj.color) {
    item.strokeColor = createColor(strokeObj.color);
    item.stroked = true;
  }
}


var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;
    var action = params.action;

    if (action === "add") {
      if (!params.color) {
        writeResultFile(RESULT_PATH, { error: true, message: "color is required for add action" });
      } else {
        var swatch = doc.swatches.add();
        swatch.name = params.name;
        swatch.color = createColor(params.color);
        writeResultFile(RESULT_PATH, { success: true, action: "add", name: params.name, verified: { swatchCount: doc.swatches.length, name: swatch.name } });
      }
    } else if (action === "update") {
      try {
        var existing = doc.swatches.getByName(params.name);
        if (params.color) {
          existing.color = createColor(params.color);
        }
        writeResultFile(RESULT_PATH, { success: true, action: "update", name: params.name, verified: { swatchCount: doc.swatches.length, name: existing.name } });
      } catch(e) {
        writeResultFile(RESULT_PATH, { error: true, message: "Swatch not found: " + params.name });
      }
    } else if (action === "delete") {
      try {
        var toDelete = doc.swatches.getByName(params.name);
        toDelete.remove();
        writeResultFile(RESULT_PATH, { success: true, action: "delete", name: params.name, verified: { swatchCount: doc.swatches.length } });
      } catch(e) {
        writeResultFile(RESULT_PATH, { error: true, message: "Swatch not found: " + params.name });
      }
    } else {
      writeResultFile(RESULT_PATH, { error: true, message: "Unknown action: " + action });
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "manage_swatches failed: " + e.message, line: e.line });
  }
}
