// Photoshop COM dispatcher. Params are injected as __PARAMS__ JSON by Python.
function __write(obj) {
  var f = new File(__DUCKY_RESULT);
  f.encoding = "UTF-8";
  f.open("w");
  f.write(__json(obj));
  f.close();
}
function __json(obj) {
  if (obj === null || typeof obj === "undefined") return "null";
  var t = typeof obj;
  if (t === "boolean" || t === "number") return String(obj);
  if (t === "string") return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
  if (obj instanceof Array) {
    var a = [];
    for (var i = 0; i < obj.length; i++) a.push(__json(obj[i]));
    return "[" + a.join(",") + "]";
  }
  var k, parts = [];
  for (k in obj) if (obj.hasOwnProperty(k)) parts.push(__json(k) + ":" + __json(obj[k]));
  return "{" + parts.join(",") + "}";
}
function __layers(container, out, depth) {
  for (var i = 0; i < container.layers.length; i++) {
    var L = container.layers[i];
    out.push({ name: L.name, kind: String(L.kind), visible: L.visible, opacity: L.opacity, depth: depth });
    if (L.typename === "LayerSet") __layers(L, out, depth + 1);
  }
}
function __findLayer(container, name) {
  for (var i = 0; i < container.layers.length; i++) {
    var L = container.layers[i];
    if (L.name === name) return L;
    if (L.typename === "LayerSet") {
      var n = __findLayer(L, name);
      if (n) return n;
    }
  }
  return null;
}

var p = __PARAMS__;
var tool = p.tool || "";
try {
  if (tool === "photoshop_get_state" || tool === "photoshop_get_capabilities") {
    var has = app.documents.length > 0;
    var doc = has ? app.activeDocument : null;
    __write({
      ok: true,
      hasDocument: has,
      version: String(app.version),
      document: has ? {
        name: doc.name,
        width: doc.width.as("px"),
        height: doc.height.as("px"),
        mode: String(doc.mode)
      } : null,
      activeLayer: has && doc.activeLayer ? { name: doc.activeLayer.name, kind: String(doc.activeLayer.kind) } : null
    });
  } else if (tool === "photoshop_get_layers" || tool === "photoshop_list_layers") {
    var layers = [];
    __layers(app.activeDocument, layers, 0);
    __write({ ok: true, count: layers.length, layers: layers });
  } else if (tool === "photoshop_create_document") {
    var w = p.width || 1920;
    var h = p.height || 1080;
    var res = p.resolution || 72;
    var mode = p.mode === "CMYK" ? NewDocumentMode.CMYK : NewDocumentMode.RGB;
    app.documents.add(w, h, res, p.name || "Untitled", mode);
    __write({ ok: true, name: app.activeDocument.name });
  } else if (tool === "photoshop_open_document") {
    app.open(new File(p.path || p.file_path || p.file));
    __write({ ok: true, name: app.activeDocument.name });
  } else if (tool === "photoshop_save_document") {
    if (p.path || p.file_path) app.activeDocument.saveAs(new File(p.path || p.file_path));
    else app.activeDocument.save();
    __write({ ok: true });
  } else if (tool === "photoshop_close_document") {
    app.activeDocument.close(p.save === true ? SaveOptions.SAVECHANGES : SaveOptions.DONOTSAVECHANGES);
    __write({ ok: true });
  } else if (tool === "photoshop_create_layer" || tool === "photoshop_add_layer") {
    var nl = app.activeDocument.artLayers.add();
    if (p.name) nl.name = p.name;
    __write({ ok: true, name: nl.name });
  } else if (tool === "photoshop_delete_layer") {
    var dl = p.name ? __findLayer(app.activeDocument, p.name) : app.activeDocument.activeLayer;
    dl.remove();
    __write({ ok: true });
  } else if (tool === "photoshop_rename_layer") {
    var rl = p.name ? __findLayer(app.activeDocument, p.name) : app.activeDocument.activeLayer;
    rl.name = p.new_name || p.rename || p.to;
    __write({ ok: true, name: rl.name });
  } else if (tool === "photoshop_set_layer_opacity") {
    var ol = p.name ? __findLayer(app.activeDocument, p.name) : app.activeDocument.activeLayer;
    ol.opacity = p.opacity;
    __write({ ok: true, opacity: ol.opacity });
  } else if (tool === "photoshop_set_layer_visibility") {
    var vl = p.name ? __findLayer(app.activeDocument, p.name) : app.activeDocument.activeLayer;
    vl.visible = p.visible !== false;
    __write({ ok: true, visible: vl.visible });
  } else if (tool === "photoshop_duplicate_layer") {
    var src = p.name ? __findLayer(app.activeDocument, p.name) : app.activeDocument.activeLayer;
    var copy = src.duplicate();
    if (p.new_name) copy.name = p.new_name;
    __write({ ok: true, name: copy.name });
  } else if (tool === "photoshop_select_all") {
    app.activeDocument.selection.selectAll();
    __write({ ok: true });
  } else if (tool === "photoshop_deselect") {
    app.activeDocument.selection.deselect();
    __write({ ok: true });
  } else if (tool === "photoshop_invert_selection") {
    app.activeDocument.selection.invert();
    __write({ ok: true });
  } else if (tool === "photoshop_fill" || tool === "photoshop_fill_selection") {
    app.activeDocument.selection.fill(app.foregroundColor);
    __write({ ok: true });
  } else if (tool === "photoshop_undo") {
    app.activeDocument.activeHistoryState = app.activeDocument.historyStates[app.activeDocument.historyStates.length - 2];
    __write({ ok: true });
  } else if (tool === "photoshop_export" || tool === "photoshop_export_document" || tool === "photoshop_save_as") {
    var dest = new File(p.path || p.file_path);
    var ext = String(p.format || dest.name.split(".").pop() || "png").toLowerCase();
    if (ext === "jpg" || ext === "jpeg") {
      var jpg = new JPEGSaveOptions();
      jpg.quality = p.quality || 10;
      app.activeDocument.saveAs(dest, jpg, true);
    } else {
      var png = new PNGSaveOptions();
      app.activeDocument.saveAs(dest, png, true);
    }
    __write({ ok: true, path: dest.fsName });
  } else if (tool.indexOf("photoshop_recipe_") === 0) {
    __write({
      ok: false,
      error: "Recipe tools run as atomic COM steps. Call adobe_list_tools and use photoshop_get_state first.",
      tool: tool
    });
  } else {
    __write({
      ok: false,
      error: "No built-in dispatcher for " + tool + ". Pass ExtendScript via adobe_execute_jsx(app='photoshop').",
      tool: tool
    });
  }
} catch (e) {
  __write({ ok: false, error: String(e.message || e), tool: tool });
}
