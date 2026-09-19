
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


    var inputX = params.x;
    var inputY = params.y;
    var w = params.width;
    var h = params.height;
    var cornerRadius = params.corner_radius || 0;

    var abRect = (coordSystem === "artboard-web") ? getActiveArtboardRect() : null;
    var pos = webToAiPoint(inputX, inputY, coordSystem, abRect);
    var left = pos[0];
    var top = pos[1];

    var targetLayer = resolveTargetLayer(doc, params.layer_name);

    var rect;
    if (cornerRadius > 0) {
      rect = targetLayer.pathItems.roundedRectangle(top, left, w, h, cornerRadius, cornerRadius);
    } else {
      rect = targetLayer.pathItems.rectangle(top, left, w, h);
    }

    applyOptionalFill(rect, params.fill);
    applyStroke(rect, params.stroke, rect.stroked);

    if (params.name) {
      rect.name = params.name;
    }

    var uuid = ensureUUID(rect);
    writeResultFile(RESULT_PATH, { uuid: uuid, coordinateSystem: coordSystem, verified: verifyItem(rect, coordSystem, abRect) });
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "Failed to create rectangle: " + e.message, line: e.line });
  }
}
