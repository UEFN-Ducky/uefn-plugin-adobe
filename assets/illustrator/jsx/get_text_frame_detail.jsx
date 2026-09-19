
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;
    var coordSystem = (params && params.coordinate_system) ? params.coordinate_system : "artboard-web";
    var targetUUID = params.uuid;

    if (!targetUUID) {
      writeResultFile(RESULT_PATH, { error: true, message: "uuid parameter is required" });
    } else {
      // textFrames を走査して UUID が一致するテキストフレームを探す
      var found = null;
      for (var i = 0; i < doc.textFrames.length; i++) {
        var item = doc.textFrames[i];
        var itemUUID = ensureUUID(item);
        if (itemUUID === targetUUID) {
          found = item;
          break;
        }
      }

      if (!found) {
        writeResultFile(RESULT_PATH, {
          error: true,
          message: "No text frame found matching UUID: " + targetUUID
        });
      } else {
        var tf = found;

        var textKind = getTextKind(tf);

        // 座標
        var itemAbIdx = getArtboardIndexForItem(tf);
        var boundsAbRect = null;
        if (coordSystem === "artboard-web") {
          boundsAbRect = getArtboardRectByIndex(itemAbIdx);
        }
        var bounds = getBounds(tf, coordSystem, boundsAbRect);

        // 段落属性（各段落ごと）
        var paraAttrs = [];
        for (var pi = 0; pi < tf.paragraphs.length; pi++) {
          var para = tf.paragraphs[pi];
          var pa = para.paragraphAttributes;
          var paraInfo = {
            text: para.contents,
            leading: 0,
            autoLeading: false,
            firstLineIndent: 0,
            leftIndent: 0,
            rightIndent: 0,
            spaceBefore: 0,
            spaceAfter: 0,
            justification: "left",
            hyphenation: false,
            paragraphStyle: ""
          };

          try { paraInfo.leading = pa.leading; } catch (e) {}
          try { paraInfo.autoLeading = pa.autoLeading; } catch (e) {}
          try { paraInfo.firstLineIndent = pa.firstLineIndent; } catch (e) {}
          try { paraInfo.leftIndent = pa.leftIndent; } catch (e) {}
          try { paraInfo.rightIndent = pa.rightIndent; } catch (e) {}
          try { paraInfo.spaceBefore = pa.spaceBefore; } catch (e) {}
          try { paraInfo.spaceAfter = pa.spaceAfter; } catch (e) {}
          try {
            var j = pa.justification;
            if (j === Justification.LEFT) paraInfo.justification = "left";
            else if (j === Justification.CENTER) paraInfo.justification = "center";
            else if (j === Justification.RIGHT) paraInfo.justification = "right";
            else if (j === Justification.FULLJUSTIFYLASTLINELEFT) paraInfo.justification = "justify-left";
            else if (j === Justification.FULLJUSTIFYLASTLINECENTER) paraInfo.justification = "justify-center";
            else if (j === Justification.FULLJUSTIFYLASTLINERIGHT) paraInfo.justification = "justify-right";
            else if (j === Justification.FULLJUSTIFY) paraInfo.justification = "justify-all";
            else paraInfo.justification = j.toString();
          } catch (e) {}
          try { paraInfo.hyphenation = pa.hyphenation; } catch (e) {}
          try {
            if (pa.paragraphStyle) {
              paraInfo.paragraphStyle = pa.paragraphStyle.name || "";
            }
          } catch (e) {}

          paraAttrs.push(paraInfo);
        }

        // 文字単位走査: 同一属性の連続文字はランにまとめる
        var chars = tf.characters;
        var runs = [];
        var prevKey = "";
        var currentRun = null;

        for (var ci = 0; ci < chars.length; ci++) {
          var ch = chars[ci];
          var cca = ch.characterAttributes;
          var info = {
            fontFamily: "",
            fontStyle: "",
            fontSize: 0,
            color: { type: "none" },
            tracking: 0,
            kerningMethod: "auto",
            akiLeft: -1,
            akiRight: -1,
            tsume: 0,
            proportionalMetrics: false,
            baselineShift: 0,
            horizontalScale: 100,
            verticalScale: 100,
            rotation: 0
          };

          try { info.fontFamily = cca.textFont.family; } catch (e2) {}
          try { info.fontStyle = cca.textFont.style; } catch (e2) {}
          try { info.fontSize = cca.size; } catch (e2) {}
          try { info.color = colorToObject(cca.fillColor); } catch (e2) {}
          try { info.tracking = cca.tracking; } catch (e2) {}
          try {
            var km2 = cca.kerningMethod;
            if (km2 === AutoKernType.AUTO) info.kerningMethod = "auto";
            else if (km2 === AutoKernType.OPTICAL) info.kerningMethod = "optical";
            else if (km2 === AutoKernType.METRICSROMANONLY) info.kerningMethod = "metrics";
            else if (km2 === AutoKernType.NOAUTOKERN) info.kerningMethod = "none";
            else info.kerningMethod = String(km2);
          } catch (e2) {}
          try { info.proportionalMetrics = cca.proportionalMetrics; } catch (e2) {}
          try { info.akiLeft = cca.akiLeft; } catch (e2) {}
          try { info.akiRight = cca.akiRight; } catch (e2) {}
          try { info.tsume = cca.Tsume; } catch (e2) {}
          try { info.baselineShift = cca.baselineShift; } catch (e2) {}
          try { info.horizontalScale = cca.horizontalScale; } catch (e2) {}
          try { info.verticalScale = cca.verticalScale; } catch (e2) {}
          try { info.rotation = cca.rotation; } catch (e2) {}

          // ランキー生成: 属性が同一なら前のランに結合
          var key = info.fontFamily + "|" + info.fontStyle + "|" + info.fontSize
            + "|" + info.tracking + "|" + info.kerningMethod
            + "|" + info.akiLeft + "|" + info.akiRight + "|" + info.tsume + "|" + info.proportionalMetrics
            + "|" + info.baselineShift + "|" + info.horizontalScale + "|" + info.verticalScale
            + "|" + info.rotation
            + "|" + (info.color.type === "rgb" ? info.color.r + "," + info.color.g + "," + info.color.b
                   : info.color.type === "cmyk" ? info.color.c + "," + info.color.m + "," + info.color.y + "," + info.color.k
                   : info.color.type);

          if (key === prevKey && currentRun) {
            currentRun.text += ch.contents;
          } else {
            currentRun = {
              text: ch.contents,
              fontFamily: info.fontFamily,
              fontStyle: info.fontStyle,
              fontSize: info.fontSize,
              color: info.color,
              tracking: info.tracking,
              kerningMethod: info.kerningMethod,
              akiLeft: info.akiLeft,
              akiRight: info.akiRight,
              tsume: info.tsume,
              proportionalMetrics: info.proportionalMetrics,
              baselineShift: info.baselineShift,
              horizontalScale: info.horizontalScale,
              verticalScale: info.verticalScale,
              rotation: info.rotation
            };
            runs.push(currentRun);
            prevKey = key;
          }
        }

        // 文字ペア間のカーニング値を収集 (TextRange.kerning — 手動設定がない位置では例外)
        var kerningPairs = [];
        for (var ki = 0; ki < chars.length; ki++) {
          var kVal = null;
          try { kVal = chars[ki].kerning; } catch (ek) { /* no manual kerning */ }
          if (kVal !== null) {
            var left = chars[ki].contents;
            var right = (ki + 1 < chars.length) ? chars[ki + 1].contents : "";
            kerningPairs.push({ index: ki, left: left, right: right, value: kVal });
          }
        }

        writeResultFile(RESULT_PATH, {
          uuid: targetUUID,
          contents: tf.contents,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          textKind: textKind,
          zIndex: getZIndex(tf),
          artboardIndex: itemAbIdx,
          coordinateSystem: coordSystem,
          characterRuns: runs,
          kerningPairs: kerningPairs,
          paragraphAttributes: paraAttrs
        });
      }
    }
  } catch (e) {
    writeResultFile(RESULT_PATH, { error: true, message: "Failed to get text frame detail: " + e.message, line: e.line });
  }
}
