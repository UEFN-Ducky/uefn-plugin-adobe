
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


    var abRect = (coordSystem === "artboard-web") ? getActiveArtboardRect() : null;

    var targetLayer = resolveTargetLayer(doc, params.layer_name);

    var anchors = params.anchors;
    var closed = params.closed || false;

    // まずアンカーポイントの座標を変換
    var anchorPositions = [];
    for (var i = 0; i < anchors.length; i++) {
      var pt = anchors[i];
      var aiCoords = webToAiPoint(pt.x, pt.y, coordSystem, abRect);
      anchorPositions.push(aiCoords);
    }

    var path = targetLayer.pathItems.add();
    path.closed = closed;

    // setEntirePathでアンカー位置を設定
    path.setEntirePath(anchorPositions);

    // ハンドルやポイントタイプの設定
    for (var i = 0; i < anchors.length; i++) {
      var pt = anchors[i];
      var pp = path.pathPoints[i];

      if (pt.point_type === "smooth") {
        pp.pointType = PointType.SMOOTH;
      } else {
        pp.pointType = PointType.CORNER;
      }

      if (pt.left_handle) {
        var lh = webToAiPoint(pt.left_handle.x, pt.left_handle.y, coordSystem, abRect);
        pp.leftDirection = lh;
      }

      if (pt.right_handle) {
        var rh = webToAiPoint(pt.right_handle.x, pt.right_handle.y, coordSystem, abRect);
        pp.rightDirection = rh;
      }
    }

    applyOptionalFill(path, params.fill);
    applyStroke(path, params.stroke, path.stroked);

    if (params.name) {
      path.name = params.name;
    }

    var uuid = ensureUUID(path);
    writeResultFile(RESULT_PATH, { uuid: uuid, coordinateSystem: coordSystem, verified: verifyItem(path, coordSystem, abRect) });
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "Failed to create path: " + e.message, line: e.line });
  }
}
