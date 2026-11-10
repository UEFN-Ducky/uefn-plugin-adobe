// After Effects command library. Each command takes the params object and returns
// a JSON-serializable value. Errors are thrown and reported by DUCKY_AE.run.
// ES3 only (var, no arrow functions, no Array.prototype.map / forEach).

var DUCKY_AE = {};
var AE_CMD = {};

// ---------------------------------------------------------------- lookups

DUCKY_AE.itemById = function (id) {
    var it = null;
    try { it = app.project.itemByID(Number(id)); } catch (e) { it = null; }
    if (!it) throw new Error("no project item with id " + String(id));
    return it;
};

DUCKY_AE.itemByName = function (name, wantComp) {
    var proj = app.project;
    for (var i = 1; i <= proj.numItems; i++) {
        var it = proj.item(i);
        if (it.name === String(name) && (!wantComp || it instanceof CompItem)) return it;
    }
    throw new Error("no " + (wantComp ? "comp" : "project item") + " named '" + String(name) + "'");
};

DUCKY_AE.comp = function (p) {
    if (DUCKY.has(p, "comp_id")) {
        var byId = DUCKY_AE.itemById(p.comp_id);
        if (!(byId instanceof CompItem)) throw new Error("item " + String(p.comp_id) + " is not a comp");
        return byId;
    }
    if (DUCKY.has(p, "comp")) return DUCKY_AE.itemByName(p.comp, true);
    var a = app.project.activeItem;
    if (a && a instanceof CompItem) return a;
    throw new Error("no active comp: pass comp (name) or comp_id");
};

DUCKY_AE.item = function (p) {
    if (DUCKY.has(p, "item_id")) return DUCKY_AE.itemById(p.item_id);
    if (DUCKY.has(p, "item")) return DUCKY_AE.itemByName(p.item, false);
    throw new Error("pass item (name) or item_id");
};

DUCKY_AE.layer = function (comp, p) {
    if (DUCKY.has(p, "layer_index")) {
        var n = Number(p.layer_index);
        if (n < 1 || n > comp.numLayers) throw new Error("layer_index " + n + " out of range 1.." + comp.numLayers);
        return comp.layer(n);
    }
    if (DUCKY.has(p, "layer")) {
        if (typeof p.layer === "number") return comp.layer(p.layer);
        var l = comp.layer(String(p.layer));
        if (!l) throw new Error("no layer named '" + String(p.layer) + "' in comp '" + comp.name + "'");
        return l;
    }
    if (comp.selectedLayers.length > 0) return comp.selectedLayers[0];
    throw new Error("pass layer (name) or layer_index");
};

DUCKY_AE.SHORT = {
    position: "ADBE Transform Group/ADBE Position",
    scale: "ADBE Transform Group/ADBE Scale",
    rotation: "ADBE Transform Group/ADBE Rotate Z",
    opacity: "ADBE Transform Group/ADBE Opacity",
    anchor_point: "ADBE Transform Group/ADBE Anchor Point",
    anchorPoint: "ADBE Transform Group/ADBE Anchor Point",
    source_text: "ADBE Text Properties/ADBE Text Document",
    sourceText: "ADBE Text Properties/ADBE Text Document",
    time_remap: "ADBE Time Remapping",
    audio_levels: "ADBE Audio Group/ADBE Audio Levels"
};

DUCKY_AE.prop = function (layer, path) {
    var key = String(path);
    var full = (typeof DUCKY_AE.SHORT[key] === "string") ? DUCKY_AE.SHORT[key] : key;
    var parts = full.split("/");
    var cur = layer;
    for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (part === "Effects") part = "ADBE Effect Parade";
        if (part === "Transform") part = "ADBE Transform Group";
        if (part === "Masks") part = "ADBE Mask Parade";
        var nx = null;
        try { nx = cur.property(part); } catch (e) { nx = null; }
        if (!nx && /^\d+$/.test(part)) {
            try { nx = cur.property(Number(part)); } catch (e2) { nx = null; }
        }
        if (!nx) throw new Error("no property '" + parts[i] + "' under '" + cur.name + "'");
        cur = nx;
    }
    if (cur.propertyType !== PropertyType.PROPERTY) throw new Error("'" + path + "' is a group, not a property");
    return cur;
};

DUCKY_AE.isTextProp = function (prop) {
    return prop.propertyValueType === PropertyValueType.TEXT_DOCUMENT;
};

DUCKY_AE.applyTextDoc = function (doc, v) {
    if (typeof v === "string") {
        doc.text = v;
        return doc;
    }
    if (DUCKY.has(v, "text")) doc.text = String(v.text);
    if (DUCKY.has(v, "font_size")) doc.fontSize = Number(v.font_size);
    if (DUCKY.has(v, "font")) doc.font = String(v.font);
    if (DUCKY.has(v, "fill_color")) { doc.applyFill = true; doc.fillColor = v.fill_color; }
    if (DUCKY.has(v, "stroke_color")) { doc.applyStroke = true; doc.strokeColor = v.stroke_color; }
    if (DUCKY.has(v, "stroke_width")) doc.strokeWidth = Number(v.stroke_width);
    if (DUCKY.has(v, "tracking")) doc.tracking = Number(v.tracking);
    if (DUCKY.has(v, "leading")) doc.leading = Number(v.leading);
    if (DUCKY.has(v, "justification")) {
        var j = String(v.justification).toLowerCase();
        doc.justification = j === "center" ? ParagraphJustification.CENTER_JUSTIFY
            : (j === "right" ? ParagraphJustification.RIGHT_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY);
    }
    return doc;
};

DUCKY_AE.inValue = function (prop, v) {
    if (DUCKY_AE.isTextProp(prop)) return DUCKY_AE.applyTextDoc(prop.value, v);
    return v;
};

DUCKY_AE.outValue = function (v) {
    if (v === null || v === undefined) return null;
    var t = typeof v;
    if (t === "number" || t === "string" || t === "boolean") return v;
    if (DUCKY.isArray(v)) return v;
    try {
        if (v instanceof TextDocument) {
            var o = { text: v.text };
            try { o.font_size = v.fontSize; o.font = v.font; } catch (eF) { /* box text */ }
            try { if (v.applyFill) o.fill_color = v.fillColor; } catch (eC) { /* no fill */ }
            return o;
        }
    } catch (eTd) { /* not a TextDocument */ }
    return String(v);
};

DUCKY_AE.layerType = function (l) {
    try { if (l instanceof TextLayer) return "text"; } catch (e1) {}
    try { if (l instanceof ShapeLayer) return "shape"; } catch (e2) {}
    try { if (l instanceof CameraLayer) return "camera"; } catch (e3) {}
    try { if (l instanceof LightLayer) return "light"; } catch (e4) {}
    try {
        if (l instanceof AVLayer) {
            if (l.nullLayer) return "null";
            if (l.adjustmentLayer) return "adjustment";
            if (l.source && l.source instanceof CompItem) return "precomp";
            if (l.source && l.source.mainSource && l.source.mainSource instanceof SolidSource) return "solid";
            return "footage";
        }
    } catch (e5) {}
    return "layer";
};

DUCKY_AE.layerSummary = function (l) {
    var o = {
        index: l.index,
        name: l.name,
        type: DUCKY_AE.layerType(l),
        in_point: l.inPoint,
        out_point: l.outPoint,
        start_time: l.startTime,
        enabled: l.enabled,
        solo: l.solo,
        locked: l.locked,
        shy: l.shy,
        label: l.label,
        parent: l.parent ? l.parent.name : null
    };
    try { o.three_d = l.threeDLayer; } catch (e3d) {}
    try { if (l.source) { o.source = l.source.name; o.source_id = l.source.id; } } catch (eSrc) {}
    try {
        var fx = l.property("ADBE Effect Parade");
        if (fx && fx.numProperties > 0) {
            o.effects = [];
            for (var i = 1; i <= fx.numProperties; i++) o.effects.push(fx.property(i).name);
        }
    } catch (eFx) {}
    return o;
};

DUCKY_AE.compSummary = function (c) {
    return {
        id: c.id,
        name: c.name,
        width: c.width,
        height: c.height,
        frame_rate: c.frameRate,
        duration: c.duration,
        pixel_aspect: c.pixelAspect,
        num_layers: c.numLayers,
        bg_color: c.bgColor,
        work_area_start: c.workAreaStart,
        work_area_duration: c.workAreaDuration
    };
};

DUCKY_AE.itemType = function (it) {
    if (it instanceof CompItem) return "comp";
    if (it instanceof FolderItem) return "folder";
    if (it instanceof FootageItem) return "footage";
    return "item";
};

DUCKY_AE.groupValues = function (group, depth) {
    var out = [];
    for (var i = 1; i <= group.numProperties; i++) {
        var p = group.property(i);
        var row = { name: p.name, match_name: p.matchName };
        if (p.propertyType === PropertyType.PROPERTY) {
            try {
                if (p.propertyValueType !== PropertyValueType.NO_VALUE && p.propertyValueType !== PropertyValueType.CUSTOM_VALUE) {
                    row.value = DUCKY_AE.outValue(p.value);
                }
            } catch (eV) {}
            try { if (p.numKeys > 0) row.keys = p.numKeys; } catch (eK) {}
            try { if (p.expressionEnabled) row.expression = p.expression; } catch (eE) {}
        } else if (depth > 0) {
            row.properties = DUCKY_AE.groupValues(p, depth - 1);
        }
        out.push(row);
    }
    return out;
};

DUCKY_AE.applyLayerFields = function (l, p) {
    if (DUCKY.has(p, "name")) l.name = String(p.name);
    if (DUCKY.has(p, "enabled")) l.enabled = !!p.enabled;
    if (DUCKY.has(p, "solo")) l.solo = !!p.solo;
    if (DUCKY.has(p, "shy")) l.shy = !!p.shy;
    if (DUCKY.has(p, "locked")) l.locked = !!p.locked;
    if (DUCKY.has(p, "label")) l.label = Number(p.label);
    if (DUCKY.has(p, "three_d")) l.threeDLayer = !!p.three_d;
    if (DUCKY.has(p, "start_time")) l.startTime = Number(p.start_time);
    if (DUCKY.has(p, "in_point")) l.inPoint = Number(p.in_point);
    if (DUCKY.has(p, "out_point")) l.outPoint = Number(p.out_point);
    if (DUCKY.has(p, "blending_mode")) {
        var mode = BlendingMode[String(p.blending_mode).toUpperCase()];
        if (mode === undefined) throw new Error("unknown blending_mode '" + p.blending_mode + "' (e.g. NORMAL, ADD, SCREEN, MULTIPLY, OVERLAY)");
        l.blendingMode = mode;
    }
    if (p.hasOwnProperty("parent")) {
        if (p.parent === null || p.parent === "") l.parent = null;
        else l.parent = (typeof p.parent === "number") ? l.containingComp.layer(p.parent) : l.containingComp.layer(String(p.parent));
    }
    var keys = ["position", "scale", "rotation", "opacity", "anchor_point"];
    for (var i = 0; i < keys.length; i++) {
        if (DUCKY.has(p, keys[i])) {
            var prop = DUCKY_AE.prop(l, keys[i]);
            if (prop.numKeys > 0) prop.setValueAtTime(l.containingComp.time, p[keys[i]]);
            else prop.setValue(p[keys[i]]);
        }
    }
    if (DUCKY.has(p, "text")) {
        var tp = DUCKY_AE.prop(l, "source_text");
        tp.setValue(DUCKY_AE.applyTextDoc(tp.value, p.text));
    }
};

DUCKY_AE.ease = function (prop, influence, speed) {
    var dims = 1;
    var t = prop.propertyValueType;
    if (t === PropertyValueType.TwoD) dims = 2;
    if (t === PropertyValueType.ThreeD) dims = 3;
    if (t === PropertyValueType.COLOR) dims = 4;
    var arr = [];
    for (var i = 0; i < dims; i++) arr.push(new KeyframeEase(speed, influence));
    return arr;
};

DUCKY_AE.INTERP = {
    linear: "LINEAR",
    bezier: "BEZIER",
    hold: "HOLD"
};

// ---------------------------------------------------------------- read

AE_CMD.ping = function () {
    return { version: app.version, build: app.buildName, project: app.project.file ? app.project.file.fsName : null };
};

AE_CMD.project_info = function () {
    var proj = app.project;
    var comps = [];
    for (var i = 1; i <= proj.numItems; i++) {
        var it = proj.item(i);
        if (it instanceof CompItem) comps.push(DUCKY_AE.compSummary(it));
    }
    var active = proj.activeItem;
    return {
        version: app.version,
        project_file: proj.file ? proj.file.fsName : null,
        dirty: proj.dirty,
        num_items: proj.numItems,
        bits_per_channel: proj.bitsPerChannel,
        render_queue_items: proj.renderQueue.numItems,
        active_item: active ? { id: active.id, name: active.name, type: DUCKY_AE.itemType(active) } : null,
        comps: comps
    };
};

AE_CMD.list_items = function (p) {
    var proj = app.project;
    var want = DUCKY.has(p, "type") ? String(p.type) : "";
    var q = DUCKY.has(p, "query") ? String(p.query).toLowerCase() : "";
    var out = [];
    for (var i = 1; i <= proj.numItems; i++) {
        var it = proj.item(i);
        var type = DUCKY_AE.itemType(it);
        if (want && type !== want) continue;
        if (q && it.name.toLowerCase().indexOf(q) < 0) continue;
        var row = { id: it.id, name: it.name, type: type, folder: it.parentFolder ? it.parentFolder.name : null };
        try {
            if (it instanceof FootageItem && it.file) row.file = it.file.fsName;
            if (it instanceof AVItem) { row.width = it.width; row.height = it.height; row.duration = it.duration; }
        } catch (eF) {}
        out.push(row);
    }
    return { count: out.length, items: out };
};

AE_CMD.get_comp = function (p) {
    var c = DUCKY_AE.comp(p);
    var o = DUCKY_AE.compSummary(c);
    o.time = c.time;
    o.layers = [];
    for (var i = 1; i <= c.numLayers; i++) o.layers.push(DUCKY_AE.layerSummary(c.layer(i)));
    return o;
};

AE_CMD.get_layer = function (p) {
    var c = DUCKY_AE.comp(p);
    var l = DUCKY_AE.layer(c, p);
    var o = DUCKY_AE.layerSummary(l);
    o.transform = DUCKY_AE.groupValues(l.property("ADBE Transform Group"), 0);
    try {
        var fx = l.property("ADBE Effect Parade");
        if (fx && fx.numProperties > 0) o.effect_properties = DUCKY_AE.groupValues(fx, 1);
    } catch (eFx) {}
    try {
        var masks = l.property("ADBE Mask Parade");
        if (masks) o.masks = masks.numProperties;
    } catch (eM) {}
    if (o.type === "text") o.text = DUCKY_AE.outValue(DUCKY_AE.prop(l, "source_text").value);
    return o;
};

AE_CMD.get_property = function (p) {
    var c = DUCKY_AE.comp(p);
    var l = DUCKY_AE.layer(c, p);
    var prop = DUCKY_AE.prop(l, p.path);
    var o = { name: prop.name, match_name: prop.matchName, num_keys: prop.numKeys };
    var t = DUCKY.has(p, "time") ? Number(p.time) : c.time;
    try { o.value = DUCKY_AE.outValue(prop.valueAtTime(t, false)); } catch (eV) {}
    try { o.expression = prop.expression; o.expression_error = prop.expressionError; } catch (eE) {}
    if (prop.numKeys > 0) {
        o.keys = [];
        for (var k = 1; k <= prop.numKeys; k++) {
            o.keys.push({ time: prop.keyTime(k), value: DUCKY_AE.outValue(prop.keyValue(k)) });
        }
    }
    return o;
};

AE_CMD.list_effects = function (p) {
    var q = DUCKY.has(p, "query") ? String(p.query).toLowerCase() : "";
    var out = [];
    for (var i = 0; i < app.effects.length; i++) {
        var e = app.effects[i];
        if (q && e.displayName.toLowerCase().indexOf(q) < 0 && e.category.toLowerCase().indexOf(q) < 0) continue;
        out.push({ name: e.displayName, match_name: e.matchName, category: e.category });
        if (out.length >= 200) break;
    }
    return { count: out.length, effects: out };
};

// ---------------------------------------------------------------- project

AE_CMD.new_project = function () {
    app.newProject();
    return { ok: true };
};

AE_CMD.open_project = function (p) {
    if (!DUCKY.has(p, "path")) throw new Error("path required");
    var f = DUCKY.file(p.path);
    if (!f.exists) throw new Error("file not found: " + p.path);
    app.open(f);
    return { project_file: app.project.file ? app.project.file.fsName : null };
};

AE_CMD.save_project = function (p) {
    if (DUCKY.has(p, "path")) app.project.save(DUCKY.file(p.path));
    else if (app.project.file) app.project.save();
    else throw new Error("project was never saved: pass path");
    return { project_file: app.project.file ? app.project.file.fsName : null };
};

AE_CMD.import_footage = function (p) {
    if (!DUCKY.has(p, "path")) throw new Error("path required");
    var f = DUCKY.file(p.path);
    if (!f.exists) throw new Error("file not found: " + p.path);
    var opts = new ImportOptions(f);
    if (p.sequence) opts.sequence = true;
    var item = app.project.importFile(opts);
    var out = { id: item.id, name: item.name, type: DUCKY_AE.itemType(item) };
    if (p.add_to_comp) {
        var c = DUCKY_AE.comp(p);
        var l = c.layers.add(item);
        if (DUCKY.has(p, "start_time")) l.startTime = Number(p.start_time);
        out.layer = DUCKY_AE.layerSummary(l);
    }
    return out;
};

AE_CMD.undo = function (p) {
    var steps = DUCKY.num(p.steps, 1);
    for (var i = 0; i < steps; i++) app.executeCommand(16);
    return { undone: steps };
};

// ---------------------------------------------------------------- comps and layers

AE_CMD.create_comp = function (p) {
    var name = DUCKY.has(p, "name") ? String(p.name) : "Comp";
    var c = app.project.items.addComp(
        name,
        DUCKY.num(p.width, 1920),
        DUCKY.num(p.height, 1080),
        DUCKY.num(p.pixel_aspect, 1),
        DUCKY.num(p.duration, 10),
        DUCKY.num(p.frame_rate, 30)
    );
    if (DUCKY.has(p, "bg_color")) c.bgColor = p.bg_color;
    if (p.open !== false) {
        try { c.openInViewer(); } catch (eOpen) {}
    }
    return DUCKY_AE.compSummary(c);
};

AE_CMD.set_comp = function (p) {
    var c = DUCKY_AE.comp(p);
    if (DUCKY.has(p, "name")) c.name = String(p.name);
    if (DUCKY.has(p, "width")) c.width = Number(p.width);
    if (DUCKY.has(p, "height")) c.height = Number(p.height);
    if (DUCKY.has(p, "duration")) c.duration = Number(p.duration);
    if (DUCKY.has(p, "frame_rate")) c.frameRate = Number(p.frame_rate);
    if (DUCKY.has(p, "bg_color")) c.bgColor = p.bg_color;
    if (DUCKY.has(p, "time")) c.time = Number(p.time);
    if (DUCKY.has(p, "work_area_start")) c.workAreaStart = Number(p.work_area_start);
    if (DUCKY.has(p, "work_area_duration")) c.workAreaDuration = Number(p.work_area_duration);
    return DUCKY_AE.compSummary(c);
};

AE_CMD.add_layer = function (p) {
    var c = DUCKY_AE.comp(p);
    var type = DUCKY.has(p, "type") ? String(p.type).toLowerCase() : "text";
    var color = DUCKY.has(p, "color") ? p.color : [1, 1, 1];
    var w = DUCKY.num(p.width, c.width);
    var h = DUCKY.num(p.height, c.height);
    var dur = DUCKY.num(p.duration, c.duration);
    var l;
    if (type === "text") {
        l = c.layers.addText(DUCKY.has(p, "text") ? String(p.text) : "Text");
        var tp = DUCKY_AE.prop(l, "source_text");
        var doc = tp.value;
        var spec = {
            font_size: DUCKY.num(p.font_size, 120),
            fill_color: color,
            justification: DUCKY.has(p, "justification") ? p.justification : "center"
        };
        if (DUCKY.has(p, "font")) spec.font = p.font;
        tp.setValue(DUCKY_AE.applyTextDoc(doc, spec));
    } else if (type === "solid" || type === "adjustment") {
        l = c.layers.addSolid(color, DUCKY.has(p, "name") ? String(p.name) : (type === "solid" ? "Solid" : "Adjustment"), w, h, c.pixelAspect, dur);
        if (type === "adjustment") l.adjustmentLayer = true;
    } else if (type === "null") {
        l = c.layers.addNull(dur);
    } else if (type === "camera") {
        l = c.layers.addCamera(DUCKY.has(p, "name") ? String(p.name) : "Camera", [c.width / 2, c.height / 2]);
    } else if (type === "light") {
        l = c.layers.addLight(DUCKY.has(p, "name") ? String(p.name) : "Light", [c.width / 2, c.height / 2]);
    } else if (type === "shape") {
        l = c.layers.addShape();
        var contents = l.property("ADBE Root Vectors Group");
        var grp = contents.addProperty("ADBE Vector Group");
        var vectors = grp.property("ADBE Vectors Group");
        var shape = DUCKY.has(p, "shape") ? String(p.shape).toLowerCase() : "rectangle";
        var size = DUCKY.has(p, "size") ? p.size : [400, 400];
        var prim;
        if (shape === "ellipse") {
            prim = vectors.addProperty("ADBE Vector Shape - Ellipse");
            prim.property("ADBE Vector Ellipse Size").setValue(size);
        } else if (shape === "star" || shape === "polygon") {
            prim = vectors.addProperty("ADBE Vector Shape - Star");
            prim.property("ADBE Vector Star Type").setValue(shape === "star" ? 1 : 2);
            prim.property("ADBE Vector Star Points").setValue(DUCKY.num(p.points, 5));
            prim.property("ADBE Vector Star Outer Radius").setValue(size[0] / 2);
            if (shape === "star") prim.property("ADBE Vector Star Inner Radius").setValue(size[0] / 4);
        } else {
            prim = vectors.addProperty("ADBE Vector Shape - Rect");
            prim.property("ADBE Vector Rect Size").setValue(size);
            if (DUCKY.has(p, "roundness")) prim.property("ADBE Vector Rect Roundness").setValue(Number(p.roundness));
        }
        if (p.fill !== false) {
            var fill = vectors.addProperty("ADBE Vector Graphic - Fill");
            fill.property("ADBE Vector Fill Color").setValue(DUCKY.has(p, "fill") && DUCKY.isArray(p.fill) ? p.fill : color);
        }
        if (DUCKY.has(p, "stroke")) {
            var stroke = vectors.addProperty("ADBE Vector Graphic - Stroke");
            stroke.property("ADBE Vector Stroke Color").setValue(p.stroke);
            stroke.property("ADBE Vector Stroke Width").setValue(DUCKY.num(p.stroke_width, 8));
        }
        DUCKY_AE.prop(l, "position").setValue([c.width / 2, c.height / 2]);
    } else {
        throw new Error("type must be text, solid, adjustment, null, camera, light or shape");
    }
    if (DUCKY.has(p, "name")) l.name = String(p.name);
    var fields = {};
    var copy = ["position", "scale", "rotation", "opacity", "anchor_point", "start_time", "in_point", "out_point", "three_d", "blending_mode", "parent"];
    for (var i = 0; i < copy.length; i++) if (p.hasOwnProperty(copy[i])) fields[copy[i]] = p[copy[i]];
    DUCKY_AE.applyLayerFields(l, fields);
    return DUCKY_AE.layerSummary(l);
};

AE_CMD.add_item_to_comp = function (p) {
    var c = DUCKY_AE.comp(p);
    var item = DUCKY_AE.item(p);
    if (item === c) throw new Error("a comp cannot contain itself");
    var l = c.layers.add(item);
    var fields = {};
    var copy = ["name", "position", "scale", "rotation", "opacity", "start_time", "in_point", "out_point"];
    for (var i = 0; i < copy.length; i++) if (p.hasOwnProperty(copy[i])) fields[copy[i]] = p[copy[i]];
    DUCKY_AE.applyLayerFields(l, fields);
    return DUCKY_AE.layerSummary(l);
};

AE_CMD.set_layer = function (p) {
    var c = DUCKY_AE.comp(p);
    var l = DUCKY_AE.layer(c, p);
    var fields = {};
    for (var k in p) {
        if (!p.hasOwnProperty(k)) continue;
        if (k === "comp" || k === "comp_id" || k === "layer" || k === "layer_index") continue;
        fields[k] = p[k];
    }
    if (DUCKY.has(p, "new_name")) fields.name = p.new_name;
    DUCKY_AE.applyLayerFields(l, fields);
    return DUCKY_AE.layerSummary(l);
};

AE_CMD.delete_layer = function (p) {
    var c = DUCKY_AE.comp(p);
    var l = DUCKY_AE.layer(c, p);
    var name = l.name;
    l.remove();
    return { deleted: name, num_layers: c.numLayers };
};

AE_CMD.duplicate_layer = function (p) {
    var c = DUCKY_AE.comp(p);
    var l = DUCKY_AE.layer(c, p).duplicate();
    if (DUCKY.has(p, "new_name")) l.name = String(p.new_name);
    return DUCKY_AE.layerSummary(l);
};

AE_CMD.reorder_layer = function (p) {
    var c = DUCKY_AE.comp(p);
    var l = DUCKY_AE.layer(c, p);
    var to = DUCKY.num(p.to_index, 1);
    if (to <= 1) l.moveToBeginning();
    else if (to >= c.numLayers) l.moveToEnd();
    else l.moveBefore(c.layer(to));
    return DUCKY_AE.layerSummary(l);
};

AE_CMD.precompose = function (p) {
    var c = DUCKY_AE.comp(p);
    var idx = p.layer_indices;
    if (!DUCKY.isArray(idx) || idx.length === 0) throw new Error("layer_indices (array of 1-based indices) required");
    var name = DUCKY.has(p, "name") ? String(p.name) : "Pre-comp";
    var nc = c.layers.precompose(idx, name, p.move_attributes !== false);
    return DUCKY_AE.compSummary(nc);
};

// ---------------------------------------------------------------- animation

AE_CMD.set_property = function (p) {
    var c = DUCKY_AE.comp(p);
    var l = DUCKY_AE.layer(c, p);
    var prop = DUCKY_AE.prop(l, p.path);
    if (!p.hasOwnProperty("value")) throw new Error("value required");
    var v = DUCKY_AE.inValue(prop, p.value);
    if (DUCKY.has(p, "time")) prop.setValueAtTime(Number(p.time), v);
    else if (prop.numKeys > 0) throw new Error("property has keyframes: pass time, or clear them with set_keyframes(clear=true)");
    else prop.setValue(v);
    return { path: p.path, value: DUCKY_AE.outValue(prop.valueAtTime(DUCKY.has(p, "time") ? Number(p.time) : c.time, false)) };
};

AE_CMD.set_keyframes = function (p) {
    var c = DUCKY_AE.comp(p);
    var l = DUCKY_AE.layer(c, p);
    var prop = DUCKY_AE.prop(l, p.path);
    if (p.clear) {
        while (prop.numKeys > 0) prop.removeKey(1);
    }
    var keys = DUCKY.isArray(p.keys) ? p.keys : [];
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (!k.hasOwnProperty("time") || !k.hasOwnProperty("value")) throw new Error("each key needs time and value");
        var t = Number(k.time);
        prop.setValueAtTime(t, DUCKY_AE.inValue(prop, k.value));
        var ki = prop.nearestKeyIndex(t);
        var mode = DUCKY.has(k, "interpolation") ? DUCKY_AE.INTERP[String(k.interpolation).toLowerCase()] : "";
        if (typeof mode === "string" && mode !== "") {
            var kit = KeyframeInterpolationType[mode];
            try { prop.setInterpolationTypeAtKey(ki, kit, kit); } catch (eI) {}
        }
        var infl = DUCKY.has(k, "ease") ? Number(k.ease) : (p.easy_ease ? 33.33 : 0);
        if (infl > 0 && !DUCKY_AE.isTextProp(prop)) {
            try {
                var ease = DUCKY_AE.ease(prop, infl, 0);
                prop.setTemporalEaseAtKey(ki, ease, ease);
            } catch (eE) {}
        }
    }
    return { path: p.path, num_keys: prop.numKeys };
};

AE_CMD.set_expression = function (p) {
    var c = DUCKY_AE.comp(p);
    var l = DUCKY_AE.layer(c, p);
    var prop = DUCKY_AE.prop(l, p.path);
    if (!prop.canSetExpression) throw new Error("'" + p.path + "' cannot take an expression");
    prop.expression = DUCKY.has(p, "expression") ? String(p.expression) : "";
    var err = "";
    try { err = prop.expressionError; } catch (eE) {}
    return { path: p.path, enabled: prop.expressionEnabled, expression_error: err };
};

AE_CMD.add_effect = function (p) {
    var c = DUCKY_AE.comp(p);
    var l = DUCKY_AE.layer(c, p);
    if (!DUCKY.has(p, "effect")) throw new Error("effect (match name or display name) required");
    var parade = l.property("ADBE Effect Parade");
    var want = String(p.effect);
    if (!parade.canAddProperty(want)) {
        for (var i = 0; i < app.effects.length; i++) {
            if (app.effects[i].displayName.toLowerCase() === want.toLowerCase()) { want = app.effects[i].matchName; break; }
        }
    }
    if (!parade.canAddProperty(want)) throw new Error("effect '" + p.effect + "' not found: call aftereffects_list_effects");
    var fx = parade.addProperty(want);
    if (DUCKY.has(p, "name")) fx.name = String(p.name);
    var set = [];
    if (p.properties) {
        for (var key in p.properties) {
            if (!p.properties.hasOwnProperty(key)) continue;
            var sub = fx.property(key);
            if (!sub) throw new Error("effect has no property '" + key + "'");
            sub.setValue(p.properties[key]);
            set.push(key);
        }
    }
    return { layer: l.name, effect: fx.name, match_name: fx.matchName, set: set, properties: DUCKY_AE.groupValues(fx, 0) };
};

AE_CMD.remove_effect = function (p) {
    var c = DUCKY_AE.comp(p);
    var l = DUCKY_AE.layer(c, p);
    var fx = l.property("ADBE Effect Parade").property(DUCKY.has(p, "effect_index") ? Number(p.effect_index) : String(p.effect));
    if (!fx) throw new Error("effect not found on layer '" + l.name + "'");
    var name = fx.name;
    fx.remove();
    return { removed: name };
};

AE_CMD.add_marker = function (p) {
    var c = DUCKY_AE.comp(p);
    var mv = new MarkerValue(DUCKY.has(p, "comment") ? String(p.comment) : "");
    if (DUCKY.has(p, "duration")) mv.duration = Number(p.duration);
    var t = DUCKY.num(p.time, c.time);
    var target;
    if (DUCKY.has(p, "layer") || DUCKY.has(p, "layer_index")) target = DUCKY_AE.layer(c, p).property("ADBE Marker");
    else target = c.markerProperty;
    if (!target) throw new Error("comp markers need After Effects 2023 or newer: pass a layer");
    target.setValueAtTime(t, mv);
    return { time: t, markers: target.numKeys };
};

// ---------------------------------------------------------------- render

AE_CMD.render_frame = function (p) {
    var c = DUCKY_AE.comp(p);
    if (!DUCKY.has(p, "path")) throw new Error("path (.png) required");
    var f = DUCKY.file(p.path);
    var t = DUCKY.num(p.time, c.time);
    if (f.exists) f.remove();
    c.saveFrameToPng(t, f);
    for (var i = 0; i < 100 && !f.exists; i++) $.sleep(100);
    if (!f.exists) throw new Error("After Effects did not write the frame");
    return { path: f.fsName, time: t, comp: c.name };
};

AE_CMD.add_to_render_queue = function (p) {
    var c = DUCKY_AE.comp(p);
    var rq = app.project.renderQueue.items.add(c);
    if (DUCKY.has(p, "render_template")) rq.applyTemplate(String(p.render_template));
    var om = rq.outputModule(1);
    if (DUCKY.has(p, "output_template")) om.applyTemplate(String(p.output_template));
    if (DUCKY.has(p, "path")) om.file = DUCKY.file(p.path);
    return {
        index: app.project.renderQueue.numItems,
        comp: c.name,
        path: om.file ? om.file.fsName : null,
        output_templates: om.templates
    };
};

AE_CMD.render_queue = function () {
    var rq = app.project.renderQueue;
    if (rq.numItems === 0) throw new Error("render queue is empty: call aftereffects_add_to_render_queue first");
    rq.render();
    var out = [];
    for (var i = 1; i <= rq.numItems; i++) {
        var it = rq.item(i);
        var row = { index: i, comp: it.comp.name, status: String(it.status) };
        try { row.path = it.outputModule(1).file.fsName; } catch (eP) {}
        out.push(row);
    }
    return { items: out };
};

// ---------------------------------------------------------------- dispatcher

AE_CMD.__eval = function (p) {
    var fn = new Function("app", "params", String(p.code || ""));
    return fn(app, p.params || {});
};

DUCKY_AE.NO_UNDO_GROUP = { undo: true, new_project: true, open_project: true, render_queue: true, ping: true };

DUCKY_AE.run = function (name, params, resultPath, label) {
    var res = { ok: false, result: null, error: null };
    var fn = AE_CMD[name];
    if (typeof fn !== "function") {
        res.error = "unknown After Effects command '" + name + "'";
        DUCKY.writeResult(resultPath, res);
        return;
    }
    var grouped = DUCKY_AE.NO_UNDO_GROUP[name] !== true;
    var suppressed = false;
    try {
        if (grouped) {
            try { app.beginSuppressDialogs(); suppressed = true; } catch (eSup) {}
            app.beginUndoGroup("Ducky: " + (label || name));
        }
        res.result = fn(params || {});
        if (res.result === undefined) res.result = null;
        res.ok = true;
    } catch (e) {
        res.error = DUCKY.errText(e);
    } finally {
        if (grouped) {
            try { app.endUndoGroup(); } catch (eEnd) {}
            if (suppressed) {
                try { app.endSuppressDialogs(false); } catch (eEndSup) {}
            }
        }
    }
    DUCKY.writeResult(resultPath, res);
};
