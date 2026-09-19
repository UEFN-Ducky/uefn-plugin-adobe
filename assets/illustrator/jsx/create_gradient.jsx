

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

    var grad = doc.gradients.add();
    grad.name = params.name;
    grad.type = (params.type === "radial") ? GradientType.RADIAL : GradientType.LINEAR;

    var stops = params.stops;
    for (var si = 0; si < stops.length; si++) {
      var gs;
      if (si < grad.gradientStops.length) {
        gs = grad.gradientStops[si];
      } else {
        gs = grad.gradientStops.add();
      }
      gs.color = createColor(stops[si].color);
      gs.rampPoint = stops[si].position;
      if (typeof stops[si].mid_point === "number") gs.midPoint = stops[si].mid_point;
      if (typeof stops[si].opacity === "number") gs.opacity = stops[si].opacity;
    }

    var appliedCount = 0;
    if (params.apply_to_uuids) {
      for (var ai = 0; ai < params.apply_to_uuids.length; ai++) {
        var item = findItemByUUID(params.apply_to_uuids[ai]);
        if (item) {
          var gc = new GradientColor();
          gc.gradient = grad;
          if (typeof params.angle === "number") gc.angle = params.angle;
          item.filled = true;
          item.fillColor = gc;
          appliedCount++;
        }
      }
    }

    var verifiedItems = [];
    if (params.apply_to_uuids) {
      for (var vi = 0; vi < params.apply_to_uuids.length; vi++) {
        var vItem = findItemByUUID(params.apply_to_uuids[vi]);
        if (vItem) verifiedItems.push(verifyItem(vItem));
      }
    }
    writeResultFile(RESULT_PATH, {
      success: true,
      name: params.name,
      type: params.type || "linear",
      stopCount: stops.length,
      appliedCount: appliedCount,
      verified: verifiedItems
    });
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "create_gradient failed: " + e.message, line: e.line });
  }
}
