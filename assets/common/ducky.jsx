// Shared ExtendScript core for the After Effects and Premiere Pro jobs.
// ES3 only: var, no arrow functions, no Array.prototype.map / forEach.
// The job prelude (written by the backend) defines DUCKY_RESULT_PATH before this file.

var DUCKY = DUCKY || {};

// ExtendScript hangs operator-overload hooks off Object.prototype under one-character
// names ("-", "+", "/", "*"), so map lookups must check the type, never the truth.
DUCKY._esc = { "\\": "\\\\", "\"": "\\\"", "\b": "\\b", "\f": "\\f", "\n": "\\n", "\r": "\\r", "\t": "\\t" };

DUCKY.escString = function (s) {
    var out = "\"";
    for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i);
        var code = s.charCodeAt(i);
        var esc = DUCKY._esc[ch];
        if (typeof esc === "string") {
            out += esc;
        } else if (code < 0x20 || code === 0x7f || code === 0x2028 || code === 0x2029) {
            var hex = code.toString(16);
            while (hex.length < 4) hex = "0" + hex;
            out += "\\u" + hex;
        } else {
            out += ch;
        }
    }
    return out + "\"";
};

DUCKY.isArray = function (v) {
    try {
        if (v instanceof Array) return true;
    } catch (e) { /* host object */ }
    return false;
};

DUCKY.stringify = function (v, depth) {
    depth = depth || 0;
    if (depth > 12) return "null";
    if (v === null || v === undefined) return "null";
    var t = typeof v;
    if (t === "number") return isFinite(v) ? String(v) : "null";
    if (t === "boolean") return v ? "true" : "false";
    if (t === "string") return DUCKY.escString(v);
    if (t === "object") {
        if (DUCKY.isArray(v)) {
            var parts = [];
            for (var i = 0; i < v.length; i++) parts.push(DUCKY.stringify(v[i], depth + 1));
            return "[" + parts.join(",") + "]";
        }
        var kparts = [];
        for (var k in v) {
            if (!v.hasOwnProperty(k)) continue;
            var val = v[k];
            if (typeof val === "function" || typeof val === "undefined") continue;
            kparts.push(DUCKY.escString(String(k)) + ":" + DUCKY.stringify(val, depth + 1));
        }
        return "{" + kparts.join(",") + "}";
    }
    return "null";
};

// Never interpolate an Error directly: ExtendScript cannot coerce it and the
// concatenation itself throws, which raises a modal that blocks every later script.
DUCKY.errText = function (e) {
    try {
        if (e === null || e === undefined) return "unknown error";
        if (typeof e === "string") return e;
        var msg = (e.message === undefined || e.message === null) ? "" : String(e.message);
        if (msg.length === 0) msg = "error";
        if (e.line !== undefined && e.line !== null) msg += " (line " + String(e.line) + ")";
        return msg;
    } catch (eFmt) {
        return "unformattable error";
    }
};

DUCKY.writeResult = function (path, obj) {
    var body;
    try {
        body = DUCKY.stringify(obj);
    } catch (eSer) {
        body = "{\"ok\":false,\"error\":\"could not serialize the result\"}";
    }
    var tmp = new File(path + ".tmp");
    tmp.encoding = "UTF-8";
    if (!tmp.open("w")) return false;
    tmp.write(body);
    tmp.close();
    var dest = new File(path);
    if (dest.exists) {
        try { dest.remove(); } catch (eRm) { /* replaced below */ }
    }
    return tmp.rename(dest.name);
};

DUCKY.num = function (v, fallback) {
    var n = Number(v);
    return (v === null || v === undefined || v === "" || isNaN(n)) ? fallback : n;
};

DUCKY.has = function (p, key) {
    return p && p.hasOwnProperty(key) && p[key] !== null && p[key] !== undefined && p[key] !== "";
};

DUCKY.file = function (path) {
    return new File(String(path).replace(/\\/g, "/"));
};
