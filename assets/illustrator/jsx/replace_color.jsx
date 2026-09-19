

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
    var fromColor = params.from_color;
    var toColor = params.to_color;
    var tolerance = (typeof params.tolerance === "number") ? params.tolerance : 0;
    var target = params.target || "both";
    var scope = params.scope || null;

    function colorsMatch(c1, c2, tol) {
      try {
        if (c1.typename === "CMYKColor" && c2.type === "cmyk") {
          return Math.abs(c1.cyan - c2.c) <= tol &&
                 Math.abs(c1.magenta - c2.m) <= tol &&
                 Math.abs(c1.yellow - c2.y) <= tol &&
                 Math.abs(c1.black - c2.k) <= tol;
        } else if (c1.typename === "RGBColor" && c2.type === "rgb") {
          return Math.abs(c1.red - c2.r) <= tol &&
                 Math.abs(c1.green - c2.g) <= tol &&
                 Math.abs(c1.blue - c2.b) <= tol;
        }
      } catch(e) {}
      return false;
    }

    var newColorObj = createColor(toColor);
    var replacedCount = 0;

    // Determine scope
    var pathSource;
    if (scope) {
      var foundLayer = null;
      function findLayerByName(layers, name) {
        for (var li = 0; li < layers.length; li++) {
          if (layers[li].name === name) return layers[li];
          try {
            var sub = findLayerByName(layers[li].layers, name);
            if (sub) return sub;
          } catch(e2) {}
        }
        return null;
      }
      foundLayer = findLayerByName(doc.layers, scope);
      if (foundLayer) {
        pathSource = foundLayer.pathItems;
      } else {
        writeResultFile(RESULT_PATH, { error: true, message: "Layer not found: " + scope });
        pathSource = null;
      }
    } else {
      pathSource = doc.pathItems;
    }

    if (pathSource) {
      for (var i = 0; i < pathSource.length; i++) {
        var item = pathSource[i];
        // Replace fill
        if ((target === "fill" || target === "both") && item.filled) {
          try {
            if (colorsMatch(item.fillColor, fromColor, tolerance)) {
              item.fillColor = newColorObj;
              replacedCount++;
            }
          } catch(e) {}
        }
        // Replace stroke
        if ((target === "stroke" || target === "both") && item.stroked) {
          try {
            if (colorsMatch(item.strokeColor, fromColor, tolerance)) {
              item.strokeColor = newColorObj;
              replacedCount++;
            }
          } catch(e) {}
        }
      }

      writeResultFile(RESULT_PATH, {
        success: true,
        replacedCount: replacedCount,
        fromColor: fromColor,
        toColor: toColor,
        verified: { replacedCount: replacedCount }
      });
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "Replace color failed: " + e.message, line: e.line });
  }
}
