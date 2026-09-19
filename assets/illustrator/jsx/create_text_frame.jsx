
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;
    var coordSystem = params.coordinate_system || "artboard-web";
    
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

    
function findFontCandidates(fontName) {
  var candidates = [];
  var searchLower = fontName.toLowerCase();
  for (var fi = 0; fi < app.textFonts.length; fi++) {
    var f = app.textFonts[fi];
    if (f.name.toLowerCase().indexOf(searchLower) >= 0 ||
        (f.family && f.family.toLowerCase().indexOf(searchLower) >= 0)) {
      candidates.push({ name: f.name, family: f.family });
      if (candidates.length >= 10) break;
    }
  }
  return candidates;
}


    var inputX = params.x;
    var inputY = params.y;
    var kind = params.kind || "point";

    var abRect = (coordSystem === "artboard-web") ? getActiveArtboardRect() : null;
    var aiCoords = webToAiPoint(inputX, inputY, coordSystem, abRect);
    var aiX = aiCoords[0];
    var aiY = aiCoords[1];

    var resolvedFont = null;
    var fontCandidates = null;
    if (params.font_name) {
      try {
        resolvedFont = app.textFonts.getByName(params.font_name);
      } catch (e) {
        fontCandidates = findFontCandidates(params.font_name);
      }
    }

    var targetLayer = resolveTargetLayer(doc, params.layer_name);

    var tf;
    var rectPath = null;
    if (kind === "area") {
      var w = params.width || 100;
      var h = params.height || 100;
      rectPath = targetLayer.pathItems.rectangle(aiY, aiX, w, h);
      try {
        tf = targetLayer.textFrames.areaText(rectPath);
      } catch (eArea) {
        try { rectPath.remove(); } catch (_) {}
        throw eArea;
      }
    } else {
      tf = targetLayer.textFrames.pointText([aiX, aiY]);
    }

    var rawContents = params.contents || "";
    // Handle literal \\n (backslash + n) from MCP parameter passing
    rawContents = rawContents.replace(/\\\\n/g, String.fromCharCode(10));
    tf.contents = rawContents.split(String.fromCharCode(10)).join(String.fromCharCode(13));

    if (params.name) {
      tf.name = params.name;
    }

    var charAttrs = tf.textRange.characterAttributes;

    if (resolvedFont) {
      charAttrs.textFont = resolvedFont;
    }

    if (typeof params.font_size === "number") {
      charAttrs.size = params.font_size;
    }

    if (typeof params.fill !== "undefined") {
      charAttrs.fillColor = createColor(params.fill);
    }

    var uuid = ensureUUID(tf);
    var resultData = { uuid: uuid, coordinateSystem: coordSystem, verified: verifyItem(tf, coordSystem, abRect) };
    if (fontCandidates !== null) {
      resultData.font_warning = "Font '" + params.font_name + "' not found. Text frame created with default font.";
      resultData.font_candidates = fontCandidates;
    }
    writeResultFile(RESULT_PATH, resultData);
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "Failed to create text frame: " + e.message, line: e.line });
  }
}
