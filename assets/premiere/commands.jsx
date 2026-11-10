// Premiere Pro command library (DOM + QE). Each command takes the params object and
// returns a JSON-serializable value; errors are thrown and reported by DUCKY_PR.run.
// ES3 only (var, no arrow functions, no Array.prototype.map / forEach).
// QE patterns (razor timecodes, transitions, frame export, clip match by start ticks)
// follow hetpatel-11/Adobe_Premiere_Pro_MCP (MIT).

var DUCKY_PR = {};
var PR_CMD = {};

DUCKY_PR.TICKS = 254016000000;

DUCKY_PR.secs = function (t) {
    if (t === null || t === undefined) return null;
    try { if (typeof t.seconds === "number") return t.seconds; } catch (e) {}
    var n = Number(t);
    return isNaN(n) ? null : n;
};

DUCKY_PR.time = function (seconds) {
    var t = new Time();
    t.seconds = Number(seconds);
    return t;
};

// Component keyframes live in the clip's source time; callers give sequence seconds.
DUCKY_PR.keyTime = function (clip, seqSeconds) {
    return DUCKY_PR.secs(clip.inPoint) + Number(seqSeconds) - DUCKY_PR.secs(clip.start);
};

DUCKY_PR.fps = function (seq) {
    try { if (seq && seq.timebase) return DUCKY_PR.TICKS / parseInt(seq.timebase, 10); } catch (e) {}
    return 30;
};

DUCKY_PR.timecode = function (seconds, fps) {
    var rate = Math.round(fps);
    var total = Math.round(Number(seconds) * fps);
    if (!isFinite(total) || total < 0) total = 0;
    var f = total % rate;
    var s = Math.floor(total / rate);
    function pad(n) { return (n < 10 ? "0" : "") + String(n); }
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60) + ":" + pad(f);
};

DUCKY_PR.project = function () {
    if (!app.project) throw new Error("no project is open in Premiere Pro");
    return app.project;
};

// ---------------------------------------------------------------- lookups

DUCKY_PR.sequence = function (p) {
    var proj = DUCKY_PR.project();
    var want = DUCKY.has(p, "sequence_id") ? String(p.sequence_id) : (DUCKY.has(p, "sequence") ? String(p.sequence) : "");
    if (want) {
        for (var i = 0; i < proj.sequences.numSequences; i++) {
            var s = proj.sequences[i];
            if (String(s.sequenceID) === want || s.name === want) return s;
        }
        throw new Error("no sequence '" + want + "'");
    }
    if (proj.activeSequence) return proj.activeSequence;
    throw new Error("no active sequence: pass sequence (name) or sequence_id");
};

DUCKY_PR.walkItems = function (bin, depth, out, path) {
    for (var i = 0; i < bin.children.numItems; i++) {
        var it = bin.children[i];
        out.push({ item: it, path: path });
        if (it.type === ProjectItemType.BIN && depth > 0) DUCKY_PR.walkItems(it, depth - 1, out, path + "/" + it.name);
    }
    return out;
};

DUCKY_PR.item = function (p, key) {
    key = key || "item";
    var want = DUCKY.has(p, key + "_id") ? String(p[key + "_id"]) : (DUCKY.has(p, key) ? String(p[key]) : "");
    if (!want) throw new Error("pass " + key + " (name) or " + key + "_id (nodeId)");
    var all = DUCKY_PR.walkItems(DUCKY_PR.project().rootItem, 20, [], "");
    for (var i = 0; i < all.length; i++) {
        var it = all[i].item;
        if (String(it.nodeId) === want || it.name === want) return it;
    }
    throw new Error("no project item '" + want + "'");
};

DUCKY_PR.bin = function (name) {
    var root = DUCKY_PR.project().rootItem;
    if (!name) return root;
    var all = DUCKY_PR.walkItems(root, 20, [], "");
    for (var i = 0; i < all.length; i++) {
        if (all[i].item.type === ProjectItemType.BIN && all[i].item.name === String(name)) return all[i].item;
    }
    return root.createBin(String(name));
};

DUCKY_PR.track = function (seq, p) {
    var kind = DUCKY.has(p, "track_type") ? String(p.track_type).toLowerCase() : "video";
    var idx = DUCKY.num(p.track, 0);
    var list = kind === "audio" ? seq.audioTracks : seq.videoTracks;
    if (idx < 0 || idx >= list.numTracks) throw new Error(kind + " track " + idx + " does not exist (0.." + (list.numTracks - 1) + ")");
    return { track: list[idx], kind: kind, index: idx };
};

DUCKY_PR.clip = function (seq, p) {
    var t = DUCKY_PR.track(seq, p);
    var clips = t.track.clips;
    if (DUCKY.has(p, "clip_index")) {
        var ci = Number(p.clip_index);
        if (ci < 0 || ci >= clips.numItems) throw new Error("clip_index " + ci + " out of range on " + t.kind + " track " + t.index);
        return { clip: clips[ci], track: t };
    }
    if (DUCKY.has(p, "clip")) {
        for (var i = 0; i < clips.numItems; i++) if (clips[i].name === String(p.clip)) return { clip: clips[i], track: t };
        throw new Error("no clip named '" + p.clip + "' on " + t.kind + " track " + t.index);
    }
    if (DUCKY.has(p, "time")) {
        var s = Number(p.time);
        for (var j = 0; j < clips.numItems; j++) {
            if (DUCKY_PR.secs(clips[j].start) <= s && s < DUCKY_PR.secs(clips[j].end)) return { clip: clips[j], track: t };
        }
        throw new Error("no clip at " + s + " s on " + t.kind + " track " + t.index);
    }
    throw new Error("pass clip_index, clip (name) or time");
};

DUCKY_PR.qeSequence = function (seq) {
    app.enableQE();
    for (var i = 0; i < qe.project.numSequences; i++) {
        var q = qe.project.getSequenceAt(i);
        try { if (String(q.guid) === String(seq.sequenceID)) return q; } catch (e) {}
    }
    try { app.project.activeSequence = seq; } catch (eSet) {}
    try {
        var active = qe.project.getActiveSequence();
        if (active && (String(active.guid) === String(seq.sequenceID) || active.name === seq.name)) return active;
    } catch (eA) {}
    throw new Error("Premiere's QE API cannot address sequence '" + seq.name + "': open it in the timeline");
};

// QE track items include gaps and transitions: match the DOM clip by start ticks.
DUCKY_PR.qeClip = function (qeTrack, clip) {
    var want = String(clip.start.ticks);
    var best = null;
    var bestDelta = null;
    for (var i = 0; i < qeTrack.numItems; i++) {
        var it = qeTrack.getItemAt(i);
        if (!it) continue;
        var type = "";
        try { type = String(it.type); } catch (eT) {}
        if (type !== "Clip") continue;
        var ticks = null;
        try { ticks = String(it.start.ticks); } catch (eS) {}
        if (ticks === want) return it;
        if (ticks !== null) {
            var d = Math.abs(parseInt(ticks, 10) - parseInt(want, 10));
            if (best === null || d < bestDelta) { best = it; bestDelta = d; }
        }
    }
    if (!best) throw new Error("QE could not find clip '" + clip.name + "'");
    return best;
};

DUCKY_PR.qeNamed = function (kind, name) {
    app.enableQE();
    var getter = { videoEffect: "getVideoEffectByName", audioEffect: "getAudioEffectByName", videoTransition: "getVideoTransitionByName", audioTransition: "getAudioTransitionByName" }[kind];
    var lister = { videoEffect: "getVideoEffectList", audioEffect: "getAudioEffectList", videoTransition: "getVideoTransitionList", audioTransition: "getAudioTransitionList" }[kind];
    var found = null;
    try { found = qe.project[getter](String(name)); } catch (e) {}
    if (found) return found;
    var list = [];
    try { list = qe.project[lister]() || []; } catch (eL) {}
    for (var i = 0; i < list.length; i++) {
        if (String(list[i]).toLowerCase() === String(name).toLowerCase()) {
            try { found = qe.project[getter](list[i]); } catch (eG) {}
            if (found) return found;
        }
    }
    throw new Error(kind + " '" + name + "' not found: call premiere_list_effects");
};

// ---------------------------------------------------------------- summaries

DUCKY_PR.clipSummary = function (c, index) {
    var o = {
        index: index,
        name: c.name,
        start: DUCKY_PR.secs(c.start),
        end: DUCKY_PR.secs(c.end),
        in_point: DUCKY_PR.secs(c.inPoint),
        out_point: DUCKY_PR.secs(c.outPoint),
        duration: DUCKY_PR.secs(c.duration)
    };
    try { o.disabled = c.disabled; } catch (eD) {}
    try { if (c.projectItem) { o.item_id = c.projectItem.nodeId; o.media = c.projectItem.getMediaPath(); } } catch (eP) {}
    try {
        if (c.components && c.components.numItems > 2) {
            o.effects = [];
            for (var i = 0; i < c.components.numItems; i++) o.effects.push(c.components[i].displayName);
        }
    } catch (eC) {}
    return o;
};

DUCKY_PR.seqSummary = function (s) {
    var o = { id: s.sequenceID, name: s.name, fps: DUCKY_PR.fps(s), video_tracks: s.videoTracks.numTracks, audio_tracks: s.audioTracks.numTracks };
    try { o.end = DUCKY_PR.secs(s.end); } catch (eE) {}
    try { o.width = s.frameSizeHorizontal; o.height = s.frameSizeVertical; } catch (eF) {}
    return o;
};

DUCKY_PR.tracks = function (list, kind) {
    var out = [];
    for (var t = 0; t < list.numTracks; t++) {
        var tr = list[t];
        var row = { index: t, kind: kind, name: tr.name, clips: [] };
        try { row.muted = tr.isMuted(); } catch (eM) {}
        try { row.locked = tr.isLocked(); } catch (eL) {}
        for (var c = 0; c < tr.clips.numItems; c++) row.clips.push(DUCKY_PR.clipSummary(tr.clips[c], c));
        out.push(row);
    }
    return out;
};

// ---------------------------------------------------------------- read

PR_CMD.ping = function () {
    var o = { version: app.version, project: null, active_sequence: null };
    try { if (app.project) { o.project = app.project.path || app.project.name; } } catch (eP) {}
    try { if (app.project && app.project.activeSequence) o.active_sequence = app.project.activeSequence.name; } catch (eS) {}
    return o;
};

PR_CMD.project_info = function () {
    var proj = DUCKY_PR.project();
    var seqs = [];
    for (var i = 0; i < proj.sequences.numSequences; i++) seqs.push(DUCKY_PR.seqSummary(proj.sequences[i]));
    return {
        version: app.version,
        name: proj.name,
        path: proj.path,
        root_items: proj.rootItem.children.numItems,
        active_sequence: proj.activeSequence ? DUCKY_PR.seqSummary(proj.activeSequence) : null,
        sequences: seqs
    };
};

PR_CMD.list_items = function (p) {
    var q = DUCKY.has(p, "query") ? String(p.query).toLowerCase() : "";
    var all = DUCKY_PR.walkItems(DUCKY_PR.project().rootItem, 20, [], "");
    var out = [];
    for (var i = 0; i < all.length; i++) {
        var it = all[i].item;
        if (q && it.name.toLowerCase().indexOf(q) < 0) continue;
        var type = it.type === ProjectItemType.BIN ? "bin" : (it.type === ProjectItemType.CLIP ? "clip" : (it.type === ProjectItemType.FILE ? "file" : "item"));
        var row = { id: it.nodeId, name: it.name, type: type, bin: all[i].path || "/" };
        try { if (type === "clip") { row.media = it.getMediaPath(); row.is_sequence = it.isSequence(); } } catch (eM) {}
        out.push(row);
        if (out.length >= 500) break;
    }
    return { count: out.length, items: out };
};

PR_CMD.get_sequence = function (p) {
    var s = DUCKY_PR.sequence(p);
    var o = DUCKY_PR.seqSummary(s);
    try { o.playhead = DUCKY_PR.secs(s.getPlayerPosition()); } catch (eP) {}
    o.video = DUCKY_PR.tracks(s.videoTracks, "video");
    o.audio = DUCKY_PR.tracks(s.audioTracks, "audio");
    o.markers = [];
    try {
        var m = s.markers.getFirstMarker();
        while (m) {
            o.markers.push({ name: m.name, start: DUCKY_PR.secs(m.start), end: DUCKY_PR.secs(m.end), comments: m.comments });
            m = s.markers.getNextMarker(m);
        }
    } catch (eMk) {}
    return o;
};

PR_CMD.get_clip = function (p) {
    var s = DUCKY_PR.sequence(p);
    var found = DUCKY_PR.clip(s, p);
    var c = found.clip;
    var o = DUCKY_PR.clipSummary(c, -1);
    o.components = [];
    for (var i = 0; i < c.components.numItems; i++) {
        var comp = c.components[i];
        var row = { name: comp.displayName, properties: [] };
        for (var j = 0; j < comp.properties.numItems; j++) {
            var pr = comp.properties[j];
            var v = null;
            try { v = pr.getValue(); } catch (eV) {}
            if (v !== null && typeof v === "object" && !DUCKY.isArray(v)) v = String(v);
            var prow = { name: pr.displayName, value: v };
            if (comp.displayName === "Volume" && pr.displayName === "Level" && typeof v === "number") prow.db = DUCKY_PR.levelToDb(v);
            row.properties.push(prow);
        }
        o.components.push(row);
    }
    return o;
};

PR_CMD.list_effects = function (p) {
    app.enableQE();
    var q = DUCKY.has(p, "query") ? String(p.query).toLowerCase() : "";
    var kind = DUCKY.has(p, "kind") ? String(p.kind) : "video_effects";
    var lister = { video_effects: "getVideoEffectList", audio_effects: "getAudioEffectList", video_transitions: "getVideoTransitionList", audio_transitions: "getAudioTransitionList" }[kind];
    if (!lister) throw new Error("kind must be video_effects, audio_effects, video_transitions or audio_transitions");
    var list = qe.project[lister]() || [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
        var n = String(list[i]);
        if (q && n.toLowerCase().indexOf(q) < 0) continue;
        out.push(n);
        if (out.length >= 300) break;
    }
    return { kind: kind, count: out.length, names: out };
};

// ---------------------------------------------------------------- project

PR_CMD.open_project = function (p) {
    if (!DUCKY.has(p, "path")) throw new Error("path required");
    if (!DUCKY.file(p.path).exists) throw new Error("file not found: " + p.path);
    app.openDocument(String(p.path), true, true, true);
    return PR_CMD.ping();
};

PR_CMD.save_project = function (p) {
    var proj = DUCKY_PR.project();
    if (DUCKY.has(p, "path")) proj.saveAs(String(p.path));
    else proj.save();
    return { path: proj.path };
};

PR_CMD.import_media = function (p) {
    var paths = DUCKY.isArray(p.paths) ? p.paths : (DUCKY.has(p, "path") ? [p.path] : []);
    if (paths.length === 0) throw new Error("paths (array of absolute file paths) required");
    for (var i = 0; i < paths.length; i++) if (!DUCKY.file(paths[i]).exists) throw new Error("file not found: " + paths[i]);
    var bin = DUCKY_PR.bin(DUCKY.has(p, "bin") ? p.bin : "");
    var before = bin.children.numItems;
    var ok = DUCKY_PR.project().importFiles(paths, true, bin, !!p.as_numbered_stills);
    var added = [];
    for (var j = before; j < bin.children.numItems; j++) added.push({ id: bin.children[j].nodeId, name: bin.children[j].name });
    return { imported: ok, bin: bin.name, items: added };
};

PR_CMD.create_bin = function (p) {
    if (!DUCKY.has(p, "name")) throw new Error("name required");
    var b = DUCKY_PR.bin(p.name);
    return { id: b.nodeId, name: b.name };
};

PR_CMD.create_sequence = function (p) {
    var name = DUCKY.has(p, "name") ? String(p.name) : "Sequence";
    var proj = DUCKY_PR.project();
    var ids = DUCKY.isArray(p.items) ? p.items : [];
    if (ids.length > 0) {
        var items = [];
        for (var i = 0; i < ids.length; i++) items.push(DUCKY_PR.item({ item: ids[i] }));
        var s = proj.createNewSequenceFromClips(name, items, proj.rootItem);
        if (!s) throw new Error("Premiere did not create the sequence");
        return DUCKY_PR.seqSummary(s);
    }
    if (DUCKY.has(p, "preset_path")) {
        app.enableQE();
        qe.project.newSequence(name, String(p.preset_path));
        for (var k = 0; k < proj.sequences.numSequences; k++) {
            if (proj.sequences[k].name === name) return DUCKY_PR.seqSummary(proj.sequences[k]);
        }
        throw new Error("Premiere did not create the sequence from the preset");
    }
    throw new Error("pass items (project item names/ids: the first sets the size and fps) or preset_path (.sqpreset)");
};

PR_CMD.set_active_sequence = function (p) {
    var s = DUCKY_PR.sequence(p);
    DUCKY_PR.project().activeSequence = s;
    try { s.openInTimeline && s.openInTimeline(); } catch (e) {}
    return DUCKY_PR.seqSummary(s);
};

// ---------------------------------------------------------------- timeline

PR_CMD.add_clip = function (p) {
    var s = DUCKY_PR.sequence(p);
    var item = DUCKY_PR.item(p);
    var t = DUCKY_PR.track(s, p);
    var at = DUCKY.has(p, "time") ? Number(p.time) : DUCKY_PR.secs(s.end);
    if (DUCKY.has(p, "source_in") || DUCKY.has(p, "source_out")) {
        item.setInPoint(DUCKY.num(p.source_in, 0), 4);
        if (DUCKY.has(p, "source_out")) item.setOutPoint(Number(p.source_out), 4);
    }
    var before = t.track.clips.numItems;
    if (p.mode === "insert") t.track.insertClip(item, at);
    else t.track.overwriteClip(item, at);
    var placed = null;
    for (var i = 0; i < t.track.clips.numItems; i++) {
        var c = t.track.clips[i];
        if (Math.abs(DUCKY_PR.secs(c.start) - at) < 0.01) { placed = DUCKY_PR.clipSummary(c, i); break; }
    }
    return { sequence: s.name, track: t.kind + " " + t.index, mode: p.mode === "insert" ? "insert" : "overwrite", clips_before: before, clips_after: t.track.clips.numItems, clip: placed };
};

PR_CMD.set_clip = function (p) {
    var s = DUCKY_PR.sequence(p);
    var found = DUCKY_PR.clip(s, p);
    var c = found.clip;
    if (DUCKY.has(p, "name")) c.name = String(p.name);
    if (DUCKY.has(p, "disabled")) c.disabled = !!p.disabled;
    if (DUCKY.has(p, "in_point")) c.inPoint = DUCKY_PR.time(p.in_point);
    if (DUCKY.has(p, "out_point")) c.outPoint = DUCKY_PR.time(p.out_point);
    if (DUCKY.has(p, "start")) c.start = DUCKY_PR.time(p.start);
    if (DUCKY.has(p, "end")) c.end = DUCKY_PR.time(p.end);
    if (DUCKY.has(p, "slip")) {
        // Slip: same place on the timeline, different part of the source.
        var d = Number(p.slip);
        if (DUCKY_PR.secs(c.inPoint) + d < 0) throw new Error("slip of " + d + " s runs past the start of the source");
        c.inPoint = DUCKY_PR.time(DUCKY_PR.secs(c.inPoint) + d);
        c.outPoint = DUCKY_PR.time(DUCKY_PR.secs(c.outPoint) + d);
    }
    // TrackItem.move takes seconds (a number), not a Time.
    if (DUCKY.has(p, "move_by")) c.move(Number(p.move_by));
    if (DUCKY.has(p, "speed")) c.setSpeed(Number(p.speed), DUCKY_PR.time(0), false, false, false);
    return DUCKY_PR.clipSummary(c, -1);
};

PR_CMD.set_motion = function (p) {
    var s = DUCKY_PR.sequence(p);
    var c = DUCKY_PR.clip(s, p).clip;
    var motion = null;
    var opacity = null;
    for (var i = 0; i < c.components.numItems; i++) {
        var dn = c.components[i].displayName;
        if (dn === "Motion") motion = c.components[i];
        if (dn === "Opacity") opacity = c.components[i];
    }
    var set = [];
    function prop(comp, name) {
        if (!comp) return null;
        for (var j = 0; j < comp.properties.numItems; j++) if (comp.properties[j].displayName === name) return comp.properties[j];
        return null;
    }
    // Premiere's Motion Position is normalized: [0.5, 0.5] is the frame centre.
    if (DUCKY.has(p, "position")) { prop(motion, "Position").setValue(p.position, true); set.push("position"); }
    if (DUCKY.has(p, "scale")) { prop(motion, "Scale").setValue(Number(p.scale), true); set.push("scale"); }
    if (DUCKY.has(p, "rotation")) { prop(motion, "Rotation").setValue(Number(p.rotation), true); set.push("rotation"); }
    if (DUCKY.has(p, "anchor_point")) { prop(motion, "Anchor Point").setValue(p.anchor_point, true); set.push("anchor_point"); }
    if (DUCKY.has(p, "opacity")) { prop(opacity, "Opacity").setValue(Number(p.opacity), true); set.push("opacity"); }
    return { clip: c.name, set: set };
};

PR_CMD.set_effect_property = function (p) {
    var s = DUCKY_PR.sequence(p);
    var c = DUCKY_PR.clip(s, p).clip;
    if (!DUCKY.has(p, "effect") || !DUCKY.has(p, "property")) throw new Error("effect and property (display names) required");
    for (var i = c.components.numItems - 1; i >= 0; i--) {
        var comp = c.components[i];
        if (comp.displayName !== String(p.effect)) continue;
        for (var j = 0; j < comp.properties.numItems; j++) {
            var pr = comp.properties[j];
            if (pr.displayName !== String(p.property)) continue;
            if (DUCKY.has(p, "time")) {
                var kt = DUCKY_PR.keyTime(c, p.time);
                if (!pr.isTimeVarying()) pr.setTimeVarying(true);
                pr.addKey(kt);
                pr.setValueAtKey(kt, p.value, true);
            } else {
                pr.setValue(p.value, true);
            }
            var v = null;
            try { v = pr.getValue(); } catch (eV) {}
            return { clip: c.name, effect: comp.displayName, property: pr.displayName, value: v };
        }
        throw new Error("effect '" + p.effect + "' has no property '" + p.property + "'");
    }
    throw new Error("clip '" + c.name + "' has no effect '" + p.effect + "'");
};

PR_CMD.remove_clip = function (p) {
    var s = DUCKY_PR.sequence(p);
    var found = DUCKY_PR.clip(s, p);
    var c = found.clip;
    var name = c.name;
    var start = DUCKY_PR.secs(c.start);
    var gap = DUCKY_PR.secs(c.end) - start;
    var linked = DUCKY_PR.linkedItems(c);
    // The tracks holding the linked clips (usually the audio under a video clip).
    var tracks = [found.track.track];
    var lists = [s.videoTracks, s.audioTracks];
    for (var k = 0; k < lists.length; k++) {
        for (var t = 0; t < lists[k].numTracks; t++) {
            var tr = lists[k][t];
            if (tr === found.track.track) continue;
            for (var ci = 0; ci < tr.clips.numItems; ci++) {
                var hit = false;
                for (var li = 0; li < linked.length; li++) if (String(tr.clips[ci].nodeId) === String(linked[li].nodeId)) hit = true;
                if (hit) { tracks.push(tr); break; }
            }
        }
    }
    c.remove(false, true);
    var moved = 0;
    if (p.ripple) {
        // remove(true, ...) does not reliably close the gap: remove the linked clips and
        // shift the later clips on those tracks left ourselves, first to last.
        for (var lr = 0; lr < linked.length; lr++) {
            try { linked[lr].remove(false, true); } catch (eL) {}
        }
        for (var ti = 0; ti < tracks.length; ti++) {
            var clips = tracks[ti].clips;
            for (var i = 0; i < clips.numItems; i++) {
                if (DUCKY_PR.secs(clips[i].start) >= start - 0.001) { clips[i].move(-gap); moved++; }
            }
        }
    }
    return { removed: name, ripple: !!p.ripple, gap: gap, linked_removed: p.ripple ? linked.length : 0, clips_moved: moved };
};

// ---------------------------------------------------------------- link, J / L cuts, roll

DUCKY_PR.linkedItems = function (c) {
    var out = [];
    try {
        var items = c.getLinkedItems();
        if (items) {
            for (var i = 0; i < items.numItems; i++) {
                if (items[i] && items[i].nodeId !== c.nodeId) out.push(items[i]);
            }
        }
    } catch (e) { /* older Premiere: no getLinkedItems */ }
    return out;
};

DUCKY_PR.deselectAll = function (s) {
    var lists = [s.videoTracks, s.audioTracks];
    for (var k = 0; k < lists.length; k++) {
        for (var t = 0; t < lists[k].numTracks; t++) {
            var clips = lists[k][t].clips;
            for (var i = 0; i < clips.numItems; i++) {
                try { clips[i].setSelected(0, 0); } catch (e) {}
            }
        }
    }
};

// linkSelection / unlinkSelection act on the active sequence's selection.
DUCKY_PR.withSelection = function (s, clips, action) {
    DUCKY_PR.project().activeSequence = s;
    DUCKY_PR.deselectAll(s);
    for (var i = 0; i < clips.length; i++) clips[i].setSelected(1, 1);
    if (action === "link") s.linkSelection();
    else s.unlinkSelection();
    DUCKY_PR.deselectAll(s);
};

DUCKY_PR.clipsFrom = function (s, p) {
    var specs = DUCKY.isArray(p.clips) ? p.clips : [p];
    var out = [];
    for (var i = 0; i < specs.length; i++) {
        var spec = specs[i];
        if (!DUCKY.has(spec, "sequence") && !DUCKY.has(spec, "sequence_id")) spec.sequence_id = s.sequenceID;
        out.push(DUCKY_PR.clip(s, spec).clip);
    }
    return out;
};

PR_CMD.unlink = function (p) {
    var s = DUCKY_PR.sequence(p);
    var clips = DUCKY_PR.clipsFrom(s, p);
    var before = 0;
    var selection = clips.slice(0);
    for (var i = 0; i < clips.length; i++) {
        // Select the partners too: with Linked Selection off, only the named clip would be selected.
        var partners = DUCKY_PR.linkedItems(clips[i]);
        before += partners.length;
        for (var pi = 0; pi < partners.length; pi++) selection.push(partners[pi]);
    }
    DUCKY_PR.withSelection(s, selection, "unlink");
    var after = 0;
    for (var j = 0; j < clips.length; j++) after += DUCKY_PR.linkedItems(clips[j]).length;
    return { clips: clips.length, linked_before: before, linked_after: after };
};

PR_CMD.link = function (p) {
    var s = DUCKY_PR.sequence(p);
    var clips = DUCKY_PR.clipsFrom(s, p);
    if (clips.length < 2) throw new Error("clips: pass the video clip and the audio clip(s) to link");
    DUCKY_PR.withSelection(s, clips, "link");
    return { clips: clips.length, linked_after: DUCKY_PR.linkedItems(clips[0]).length };
};

DUCKY_PR.clipAt = function (track, edge, t) {
    var clips = track.clips;
    for (var i = 0; i < clips.numItems; i++) {
        var at = DUCKY_PR.secs(edge === "end" ? clips[i].end : clips[i].start);
        if (Math.abs(at - t) < 0.02) return clips[i];
    }
    return null;
};

// Move the cut between two adjacent clips on one track by d seconds (positive = later).
// The shrinking side moves first so the two clips never overlap.
DUCKY_PR.roll = function (prev, next, d) {
    var cut = DUCKY_PR.secs(next.start);
    var nextIn = DUCKY_PR.secs(next.inPoint);
    if (nextIn + d < 0) throw new Error("the incoming clip has only " + nextIn.toFixed(2) + " s of source before its in point");
    if (d < 0) {
        prev.end = DUCKY_PR.time(cut + d);
        next.start = DUCKY_PR.time(cut + d);
        next.inPoint = DUCKY_PR.time(nextIn + d);
    } else {
        next.start = DUCKY_PR.time(cut + d);
        next.inPoint = DUCKY_PR.time(nextIn + d);
        prev.end = DUCKY_PR.time(cut + d);
    }
    return { cut_before: cut, cut_after: DUCKY_PR.secs(next.start), prev_end: DUCKY_PR.secs(prev.end) };
};

PR_CMD.roll_edit = function (p) {
    var s = DUCKY_PR.sequence(p);
    var found = DUCKY_PR.clip(s, p);
    var next = found.clip;
    var prev = DUCKY_PR.clipAt(found.track.track, "end", DUCKY_PR.secs(next.start));
    if (!prev) throw new Error("no clip ends where '" + next.name + "' starts: roll edits need two touching clips");
    if (!DUCKY.has(p, "delta")) throw new Error("delta (seconds; negative = earlier) required");
    var r = DUCKY_PR.roll(prev, next, Number(p.delta));
    if (Math.abs(r.cut_after - (r.cut_before + Number(p.delta))) > 0.05) throw new Error("Premiere did not move the cut (the outgoing clip may have no source left)");
    return r;
};

// J cut: the next shot's sound starts `offset` s before its picture.
// L cut: the previous shot's sound carries `offset` s past the picture cut.
PR_CMD.split_edit = function (p) {
    var s = DUCKY_PR.sequence(p);
    var type = DUCKY.has(p, "type") ? String(p.type).toUpperCase() : "J";
    if (type !== "J" && type !== "L") throw new Error("type must be J or L");
    var d = DUCKY.num(p.offset, 0.5);
    if (d <= 0) throw new Error("offset must be positive seconds");
    var vFound = DUCKY_PR.clip(s, { sequence_id: s.sequenceID, track: DUCKY.num(p.track, 0), track_type: "video", clip_index: p.clip_index, clip: p.clip, time: p.time });
    var cut = DUCKY_PR.secs(vFound.clip.start);
    var vPrev = DUCKY_PR.clipAt(vFound.track.track, "end", cut);
    if (!vPrev) throw new Error("no video clip ends where '" + vFound.clip.name + "' starts");
    var aTrack = DUCKY_PR.track(s, { track: DUCKY.num(p.audio_track, 0), track_type: "audio" }).track;
    var aNext = DUCKY_PR.clipAt(aTrack, "start", cut);
    var aPrev = DUCKY_PR.clipAt(aTrack, "end", cut);
    if (!aNext || !aPrev) throw new Error("audio track " + DUCKY.num(p.audio_track, 0) + " has no cut at " + cut.toFixed(2) + " s to match the picture");
    DUCKY_PR.withSelection(s, [vPrev, vFound.clip, aPrev, aNext], "unlink");
    var r = DUCKY_PR.roll(aPrev, aNext, type === "J" ? -d : d);
    var want = type === "J" ? cut - d : cut + d;
    if (Math.abs(r.cut_after - want) > 0.05) throw new Error("Premiere did not move the audio cut (not enough source on one side)");
    return { type: type, picture_cut: cut, audio_cut: r.cut_after, offset: d, unlinked: true };
};

// ---------------------------------------------------------------- audio levels

// Premiere stores clip Volume Level as linear amplitude where the panel's 0 dB is
// 0.17783: level = 10^((dB - 15) / 20) (measured by hetpatel-11/Adobe_Premiere_Pro_MCP).
DUCKY_PR.DB_OFFSET = 15;
DUCKY_PR.dbToLevel = function (db) { return Math.pow(10, (Number(db) - DUCKY_PR.DB_OFFSET) / 20); };
DUCKY_PR.levelToDb = function (v) { return v > 0 ? 20 * Math.log(v) / Math.LN10 + DUCKY_PR.DB_OFFSET : null; };

DUCKY_PR.levelProp = function (c) {
    for (var i = 0; i < c.components.numItems; i++) {
        var comp = c.components[i];
        if (comp.displayName !== "Volume") continue;
        for (var j = 0; j < comp.properties.numItems; j++) {
            if (comp.properties[j].displayName === "Level") return comp.properties[j];
        }
    }
    throw new Error("clip '" + c.name + "' has no Volume > Level (is it an audio clip?)");
};

PR_CMD.set_volume = function (p) {
    var s = DUCKY_PR.sequence(p);
    var spec = {};
    for (var k in p) if (p.hasOwnProperty(k)) spec[k] = p[k];
    if (!DUCKY.has(spec, "track_type")) spec.track_type = "audio";
    var c = DUCKY_PR.clip(s, spec).clip;
    var prop = DUCKY_PR.levelProp(c);
    var before = null;
    try { before = DUCKY_PR.levelToDb(prop.getValue()); } catch (eV) {}
    var keys = DUCKY.isArray(p.keys) ? p.keys : [];
    if (keys.length > 0) {
        if (!prop.isTimeVarying()) prop.setTimeVarying(true);
        for (var i = 0; i < keys.length; i++) {
            var t = DUCKY_PR.keyTime(c, keys[i].time);
            prop.addKey(t);
            prop.setValueAtKey(t, DUCKY_PR.dbToLevel(keys[i].db), true);
        }
        return { clip: c.name, db_before: before, keys: keys.length };
    }
    if (!DUCKY.has(p, "db")) throw new Error("db (or keys: [{time, db}]) required");
    if (prop.isTimeVarying()) prop.setTimeVarying(false);
    prop.setValue(DUCKY_PR.dbToLevel(p.db), true);
    return { clip: c.name, db_before: before, db: DUCKY_PR.levelToDb(prop.getValue()) };
};

PR_CMD.set_track = function (p) {
    var s = DUCKY_PR.sequence(p);
    var t = DUCKY_PR.track(s, p);
    if (DUCKY.has(p, "mute")) t.track.setMute(p.mute ? 1 : 0);
    if (DUCKY.has(p, "name")) t.track.name = String(p.name);
    var o = { track: t.kind + " " + t.index, name: t.track.name };
    try { o.muted = t.track.isMuted(); } catch (eM) {}
    return o;
};

PR_CMD.razor = function (p) {
    var s = DUCKY_PR.sequence(p);
    if (!DUCKY.has(p, "time")) throw new Error("time (seconds) required");
    var tc = DUCKY_PR.timecode(Number(p.time), DUCKY_PR.fps(s));
    var q = DUCKY_PR.qeSequence(s);
    var cut = [];
    if (p.all_tracks) {
        for (var v = 0; v < s.videoTracks.numTracks; v++) { q.getVideoTrackAt(v).razor(tc); cut.push("video " + v); }
        for (var a = 0; a < s.audioTracks.numTracks; a++) { q.getAudioTrackAt(a).razor(tc); cut.push("audio " + a); }
    } else {
        var t = DUCKY_PR.track(s, p);
        (t.kind === "audio" ? q.getAudioTrackAt(t.index) : q.getVideoTrackAt(t.index)).razor(tc);
        cut.push(t.kind + " " + t.index);
    }
    return { timecode: tc, tracks: cut };
};

PR_CMD.add_transition = function (p) {
    var s = DUCKY_PR.sequence(p);
    var found = DUCKY_PR.clip(s, p);
    var kind = found.track.kind;
    var q = DUCKY_PR.qeSequence(s);
    var qTrack = kind === "audio" ? q.getAudioTrackAt(found.track.index) : q.getVideoTrackAt(found.track.index);
    var qc = DUCKY_PR.qeClip(qTrack, found.clip);
    var name = DUCKY.has(p, "transition") ? String(p.transition) : (kind === "audio" ? "Constant Power" : "Cross Dissolve");
    var tr = DUCKY_PR.qeNamed(kind === "audio" ? "audioTransition" : "videoTransition", name);
    var frames = Math.max(1, Math.round(DUCKY.num(p.duration, 1) * DUCKY_PR.fps(s)));
    var atEnd = p.at !== "start";
    if (kind === "audio") qc.addTransition(tr, atEnd, String(frames));
    else qc.addTransition(tr, atEnd, String(frames), "0", 0.5, true, true);
    return { clip: found.clip.name, transition: name, frames: frames, at: atEnd ? "end" : "start" };
};

PR_CMD.apply_effect = function (p) {
    var s = DUCKY_PR.sequence(p);
    var found = DUCKY_PR.clip(s, p);
    var kind = found.track.kind;
    if (!DUCKY.has(p, "effect")) throw new Error("effect (display name) required");
    var q = DUCKY_PR.qeSequence(s);
    var qTrack = kind === "audio" ? q.getAudioTrackAt(found.track.index) : q.getVideoTrackAt(found.track.index);
    var qc = DUCKY_PR.qeClip(qTrack, found.clip);
    var fx = DUCKY_PR.qeNamed(kind === "audio" ? "audioEffect" : "videoEffect", p.effect);
    var before = found.clip.components.numItems;
    if (kind === "audio") qc.addAudioEffect(fx);
    else qc.addVideoEffect(fx);
    var c = DUCKY_PR.clip(s, { track: found.track.index, track_type: kind, time: DUCKY_PR.secs(found.clip.start) + 0.001 }).clip;
    return { clip: c.name, effect: String(p.effect), components_before: before, components_after: c.components.numItems };
};

PR_CMD.add_marker = function (p) {
    var s = DUCKY_PR.sequence(p);
    var t = DUCKY.has(p, "time") ? Number(p.time) : DUCKY_PR.secs(s.getPlayerPosition());
    var m = s.markers.createMarker(t);
    if (DUCKY.has(p, "name")) m.name = String(p.name);
    if (DUCKY.has(p, "comments")) m.comments = String(p.comments);
    if (DUCKY.has(p, "duration")) m.end = DUCKY_PR.time(t + Number(p.duration));
    return { name: m.name, start: DUCKY_PR.secs(m.start) };
};

PR_CMD.set_playhead = function (p) {
    var s = DUCKY_PR.sequence(p);
    s.setPlayerPosition(String(Math.round(Number(p.time || 0) * DUCKY_PR.TICKS)));
    return { playhead: DUCKY_PR.secs(s.getPlayerPosition()) };
};

PR_CMD.set_in_out = function (p) {
    var s = DUCKY_PR.sequence(p);
    if (DUCKY.has(p, "in")) s.setInPoint(Number(p["in"]));
    if (DUCKY.has(p, "out")) s.setOutPoint(Number(p.out));
    return { in_point: DUCKY_PR.secs(s.getInPointAsTime()), out_point: DUCKY_PR.secs(s.getOutPointAsTime()) };
};

// ---------------------------------------------------------------- export

PR_CMD.export_frame = function (p) {
    var s = DUCKY_PR.sequence(p);
    if (!DUCKY.has(p, "path")) throw new Error("path (.png) required");
    var t = DUCKY.has(p, "time") ? Number(p.time) : DUCKY_PR.secs(s.getPlayerPosition());
    var q = DUCKY_PR.qeSequence(s);
    // exportFramePNG appends ".png" itself: hand it the stem.
    var stem = String(p.path).replace(/\.png$/i, "");
    q.exportFramePNG(DUCKY_PR.timecode(t, DUCKY_PR.fps(s)), stem);
    var f = DUCKY.file(stem + ".png");
    for (var i = 0; i < 100 && !f.exists; i++) $.sleep(100);
    if (!f.exists) throw new Error("Premiere did not write the frame");
    return { path: f.fsName, time: t };
};

PR_CMD.export_sequence = function (p) {
    var s = DUCKY_PR.sequence(p);
    if (!DUCKY.has(p, "path")) throw new Error("path (output file) required");
    if (!DUCKY.has(p, "preset_path")) throw new Error("preset_path (.epr) required: premiere_list_presets finds them");
    if (!DUCKY.file(p.preset_path).exists) throw new Error("preset not found: " + p.preset_path);
    var range = { entire: 0, in_out: 1, work_area: 2 }[DUCKY.has(p, "range") ? String(p.range) : "entire"];
    if (range === undefined) range = 0;
    if (p.queue) {
        app.encoder.launchEncoder();
        var job = app.encoder.encodeSequence(s, String(p.path), String(p.preset_path), range, 1);
        if (p.start_queue) app.encoder.startBatch();
        return { queued: true, job_id: job, path: String(p.path) };
    }
    var ok = s.exportAsMediaDirect(String(p.path), String(p.preset_path), range);
    var f = DUCKY.file(p.path);
    return { exported: ok, path: f.fsName, exists: f.exists };
};

PR_CMD.undo = function (p) {
    app.enableQE();
    var steps = DUCKY.num(p.steps, 1);
    for (var i = 0; i < steps; i++) qe.project.undo();
    return { undone: steps };
};

// ---------------------------------------------------------------- dispatcher

DUCKY_PR.run = function (name, params, resultPath) {
    var fn = PR_CMD[name];
    if (typeof fn !== "function") {
        DUCKY.writeResult(resultPath, { ok: false, result: null, error: "unknown Premiere Pro command '" + name + "'" });
        return "done";
    }
    return DUCKY_PR.exec(fn, params, resultPath);
};

// Raw ExtendScript (premiere_execute_jsx): the backend writes the caller's code into the job
// as `function (app, params) { ... }`, so nothing is compiled from a string here.
DUCKY_PR.runFn = function (userFn, params, resultPath) {
    return DUCKY_PR.exec(function (p) { return userFn(app, p); }, params, resultPath);
};

DUCKY_PR.exec = function (fn, params, resultPath) {
    var res = { ok: false, result: null, error: null };
    {
        try {
            res.result = fn(params || {});
            if (res.result === undefined) res.result = null;
            res.ok = true;
        } catch (e) {
            res.error = DUCKY.errText(e);
        }
    }
    DUCKY.writeResult(resultPath, res);
    return "done";
};
