
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


    var ix1 = params.x1;
    var iy1 = params.y1;
    var ix2 = params.x2;
    var iy2 = params.y2;

    var abRect = (coordSystem === "artboard-web") ? getActiveArtboardRect() : null;
    var p1 = webToAiPoint(ix1, iy1, coordSystem, abRect);
    var p2 = webToAiPoint(ix2, iy2, coordSystem, abRect);
    var px1 = p1[0], py1 = p1[1], px2 = p2[0], py2 = p2[1];

    var targetLayer = resolveTargetLayer(doc, params.layer_name);

    var line = targetLayer.pathItems.add();
    line.setEntirePath([[px1, py1], [px2, py2]]);
    line.filled = false;

    if (params.stroke) {
      applyStroke(line, params.stroke, true);
      if (params.stroke.cap) {
        if (params.stroke.cap === "round") {
          line.strokeCap = StrokeCap.ROUNDENDCAP;
        } else if (params.stroke.cap === "projecting") {
          line.strokeCap = StrokeCap.PROJECTINGENDCAP;
        } else {
          line.strokeCap = StrokeCap.BUTTENDCAP;
        }
      }
    } else {
      line.stroked = true;
    }

    if (params.name) {
      line.name = params.name;
    }

    var uuid = ensureUUID(line);
    writeResultFile(RESULT_PATH, { uuid: uuid, coordinateSystem: coordSystem, verified: verifyItem(line, coordSystem, abRect) });
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "Failed to create line: " + e.message, line: e.line });
  }
}
