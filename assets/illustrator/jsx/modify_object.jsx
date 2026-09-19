
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


    var item = findItemByUUID(params.uuid);
    if (!item) {
      writeResultFile(RESULT_PATH, { error: true, message: "No object found matching UUID: " + params.uuid });
    } else {
      var props = params.properties;
      var errors = [];
      var abRect = (coordSystem === "artboard-web") ? getActiveArtboardRect() : null;

      // locked=false は他のプロパティ変更が弾かれないよう最初に適用する
      if (props.locked === false) {
        try { item.locked = false; }
        catch(e) { errors.push("locked: " + e.message); }
      }

      if (typeof props.hidden === "boolean") {
        try { item.hidden = props.hidden; }
        catch(e) { errors.push("hidden: " + e.message); }
      }

      if (props.position) {
        try {
          var pos = webToAiPoint(props.position.x, props.position.y, coordSystem, abRect);
          item.position = pos;
        } catch(e) { errors.push("position: " + e.message); }
      }

      if (props.size) {
        try {
          if (typeof props.size.width === "number") {
            item.width = props.size.width;
          }
          if (typeof props.size.height === "number") {
            item.height = props.size.height;
          }
        } catch(e) { errors.push("size: " + e.message); }
      }

      if (typeof props.fill !== "undefined") {
        try {
          applyOptionalFill(item, props.fill);
        } catch(e) { errors.push("fill: " + e.message); }
      }

      if (props.stroke) {
        try {
          applyStroke(item, props.stroke, item.stroked);
        } catch(e) { errors.push("stroke: " + e.message); }
      }

      if (typeof props.opacity === "number") {
        try { item.opacity = props.opacity; }
        catch(e) { errors.push("opacity: " + e.message); }
      }

      if (typeof props.rotation === "number") {
        try {
          var rotMode = props.rotation_mode || "delta";
          if (rotMode === "absolute") {
            // note メタデータから現在の累積回転角度を読み取り、差分を適用
            var noteStr = item.note || "";
            var currentDeg = parseFloat(getNoteMeta(noteStr, "rot")) || 0;
            var delta = props.rotation - currentDeg;
            if (Math.abs(delta) > 0.001) {
              item.rotate(delta);
            }
            setNoteMeta(item, "rot", String(Math.round(props.rotation * 1000) / 1000));
          } else {
            item.rotate(props.rotation);
            // delta 回転時も累積角度を更新
            var noteStr2 = item.note || "";
            var prevDeg = parseFloat(getNoteMeta(noteStr2, "rot")) || 0;
            setNoteMeta(item, "rot", String(Math.round((prevDeg + props.rotation) * 1000) / 1000));
          }
        }
        catch(e) { errors.push("rotation: " + e.message + " (line: " + (e.line || "?") + ")"); }
      }

      if (typeof props.name === "string") {
        try { item.name = props.name; }
        catch(e) { errors.push("name: " + e.message); }
      }

      if (typeof props.contents === "string") {
        try { item.contents = props.contents.split(String.fromCharCode(10)).join(String.fromCharCode(13)); }
        catch(e) { errors.push("contents: " + e.message); }
      }

      var fontCandidates = null;
      if (props.font_name) {
        try {
          var resolvedFont = app.textFonts.getByName(props.font_name);
          for (var ri = 0; ri < item.textRanges.length; ri++) {
            item.textRanges[ri].characterAttributes.textFont = resolvedFont;
          }
        } catch(e) {
          errors.push("font_name: Font '" + props.font_name + "' not found.");
          fontCandidates = findFontCandidates(props.font_name);
        }
      }

      if (typeof props.font_size === "number") {
        try {
          for (var ri2 = 0; ri2 < item.textRanges.length; ri2++) {
            item.textRanges[ri2].characterAttributes.size = props.font_size;
          }
        } catch(e) { errors.push("font_size: " + e.message); }
      }

      // locked=true は他の変更を全て終えてから最後に適用する
      if (props.locked === true) {
        try { item.locked = true; }
        catch(e) { errors.push("locked: " + e.message); }
      }

      var verifiedState = verifyItem(item, coordSystem, abRect);
      if (errors.length > 0) {
        var result = { success: false, uuid: params.uuid, coordinateSystem: coordSystem, errors: errors, verified: verifiedState };
        if (fontCandidates !== null) { result.font_candidates = fontCandidates; }
        writeResultFile(RESULT_PATH, result);
      } else {
        writeResultFile(RESULT_PATH, { success: true, uuid: params.uuid, coordinateSystem: coordSystem, verified: verifiedState });
      }
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "Failed to modify object: " + e.message, line: e.line });
  }
}
