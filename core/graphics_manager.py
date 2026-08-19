"""
Professional Motion Graphics & Visual Design System Manager for UpClip Studio — Phase 18.
Provides a comprehensive graphics catalog (shapes, lines, arrows, badges, vector accents),
alignment & transform calculations, layer grouping/ungrouping, keyframe animation engine,
graphic duplication, and custom template persistence.
"""

import os
import json
import time
import uuid
from pathlib import Path

import config

DATA_DIR = config.ROOT_DIR / "data"
TEMPLATES_FILE = DATA_DIR / "graphics_templates.json"


class GraphicsManager:
    def __init__(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.templates = self._load_templates()

    def _load_templates(self):
        if TEMPLATES_FILE.exists():
            try:
                with open(TEMPLATES_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return self._get_default_templates()

    def _save_templates(self):
        try:
            with open(TEMPLATES_FILE, "w", encoding="utf-8") as f:
                json.dump(self.templates, f, indent=2)
        except Exception as e:
            print("[GRAPHICS] Failed to save templates:", e)

    def _get_default_templates(self):
        return [
            {
                "id": "tpl_lower_third_speaker",
                "name": "Speaker Lower Third",
                "category": "lower_thirds",
                "type": "lower_third",
                "transform": { "x": 0, "y": 180, "width": 280, "height": 48, "scale": 100, "rotation": 0, "opacity": 100 },
                "appearance": { "fill": "#1E1E2E", "stroke": "#6366F1", "strokeWidth": 1.5, "cornerRadius": 8 },
                "typography": { "text": "ALEX RIVERS • CREATIVE DIRECTOR", "fontFamily": "Inter", "fontSize": 12, "fontWeight": 700, "color": "#FFFFFF" },
                "animation": { "entrance": "slide_up", "exit": "fade_out" }
            },
            {
                "id": "tpl_pro_badge",
                "name": "Pro Feature Badge",
                "category": "badges",
                "type": "shape",
                "content": { "shapeType": "badge" },
                "transform": { "x": 0, "y": -220, "width": 160, "height": 36, "scale": 100, "rotation": 0, "opacity": 100 },
                "appearance": { "fill": "#8B5CF6", "stroke": "#FFFFFF", "strokeWidth": 1, "cornerRadius": 6 },
                "typography": { "text": "PRO WORKFLOW ✓", "fontFamily": "Inter", "fontSize": 12, "fontWeight": 800, "color": "#FFFFFF" },
                "animation": { "entrance": "pop", "exit": "none" }
            },
            {
                "id": "tpl_callout_arrow",
                "name": "Focus Arrow Callout",
                "category": "callouts",
                "type": "shape",
                "content": { "shapeType": "arrow" },
                "transform": { "x": 50, "y": 50, "width": 110, "height": 45, "scale": 100, "rotation": -45, "opacity": 95 },
                "appearance": { "fill": "#EF4444", "stroke": "#FFFFFF", "strokeWidth": 1 },
                "animation": { "entrance": "scale_in", "exit": "fade_out" }
            },
            {
                "id": "tpl_minimal_line",
                "name": "Accent Divider Line",
                "category": "graphics",
                "type": "shape",
                "content": { "shapeType": "line" },
                "transform": { "x": 0, "y": 120, "width": 240, "height": 8, "scale": 100, "rotation": 0, "opacity": 90 },
                "appearance": { "fill": "#38BDF8", "stroke": "#38BDF8", "strokeWidth": 3 },
                "animation": { "entrance": "fade_in", "exit": "fade_out" }
            }
        ]

    def get_catalog(self):
        """Return the complete structured graphics catalog with vector shapes, badges, and templates."""
        return {
            "shapes": [
                { "id": "shape_rect", "name": "Rectangle", "type": "shape", "shapeType": "rect", "width": 140, "height": 90, "fill": "#6366F1", "radius": 0 },
                { "id": "shape_rounded", "name": "Rounded Box", "type": "shape", "shapeType": "rounded_rect", "width": 140, "height": 90, "fill": "#6366F1", "radius": 12 },
                { "id": "shape_circle", "name": "Circle", "type": "shape", "shapeType": "circle", "width": 100, "height": 100, "fill": "#10B981" },
                { "id": "shape_line", "name": "Line", "type": "shape", "shapeType": "line", "width": 160, "height": 10, "fill": "#38BDF8" },
                { "id": "shape_arrow", "name": "Arrow", "type": "shape", "shapeType": "arrow", "width": 120, "height": 50, "fill": "#EF4444" },
                { "id": "shape_triangle", "name": "Triangle", "type": "shape", "shapeType": "triangle", "width": 90, "height": 80, "fill": "#EC4899" },
                { "id": "shape_star", "name": "Star", "type": "shape", "shapeType": "star", "width": 90, "height": 90, "fill": "#F59E0B" }
            ],
            "text": [
                { "id": "text_heading", "name": "Bold Title", "type": "text", "text": "MAIN HEADING", "fontSize": 24, "fontWeight": 800, "color": "#FFFFFF", "fill": "rgba(0,0,0,0.6)" },
                { "id": "text_subtitle", "name": "Subtitle", "type": "text", "text": "Subheading line text", "fontSize": 15, "fontWeight": 600, "color": "#E2E8F0", "fill": "rgba(0,0,0,0.4)" },
                { "id": "text_quote", "name": "Quote Block", "type": "text", "text": "“This is a key statement.”", "fontSize": 14, "fontWeight": 500, "color": "#FCD34D", "fill": "#1E1E2E" }
            ],
            "lower_thirds": [
                { "id": "lt_speaker", "name": "Speaker Banner", "type": "lower_third", "text": "SPEAKER NAME • HOST", "fill": "#1E1E2E", "stroke": "#6366F1", "width": 280, "height": 48 },
                { "id": "lt_news", "name": "News Broadcast", "type": "lower_third", "text": "BREAKING UPDATE", "fill": "#DC2626", "stroke": "#FFFFFF", "width": 240, "height": 42 },
                { "id": "lt_tech", "name": "Tech Pill", "type": "lower_third", "text": "EPISODE 04 // AI REVOLUTION", "fill": "#0F172A", "stroke": "#38BDF8", "width": 260, "height": 40 }
            ],
            "badges": [
                { "id": "badge_pro", "name": "PRO Badge", "type": "shape", "shapeType": "badge", "text": "PRO ✓", "fill": "#8B5CF6", "width": 140, "height": 34 },
                { "id": "badge_hot", "name": "HOT Badge", "type": "shape", "shapeType": "badge", "text": "HOT 🔥", "fill": "#EF4444", "width": 140, "height": 34 },
                { "id": "badge_tip", "name": "TIP Badge", "type": "shape", "shapeType": "badge", "text": "TIP 💡", "fill": "#10B981", "width": 140, "height": 34 },
                { "id": "badge_new", "name": "NEW Badge", "type": "shape", "shapeType": "badge", "text": "NEW ★", "fill": "#F59E0B", "width": 140, "height": 34 }
            ],
            "motion_presets": [
                { "id": "mp_smooth_slide", "name": "Smooth Slide In", "type": "slide_up", "duration": 0.4, "easing": "ease_out" },
                { "id": "mp_quick_pop", "name": "Quick Pop Scale", "type": "pop", "duration": 0.3, "easing": "ease_out_back" },
                { "id": "mp_minimal_fade", "name": "Minimal Fade", "type": "fade_in", "duration": 0.5, "easing": "ease_in_out" },
                { "id": "mp_dynamic_bounce", "name": "Dynamic Bounce", "type": "bounce", "duration": 0.6, "easing": "bounce" },
                { "id": "mp_scale_in", "name": "Scale In", "type": "scale_in", "duration": 0.35, "easing": "ease_out" }
            ],
            "templates": self.templates
        }

    def align_layer(self, layer, mode, canvas_w=360, canvas_h=640, padding=24):
        """
        Compute new X or Y transform coordinates based on alignment mode.
        Modes: 'left', 'center_x', 'right', 'top', 'center_y', 'bottom'.
        """
        t = layer.get("transform", {})
        w = float(t.get("width", 120)) * (float(t.get("scale", 100)) / 100.0)
        h = float(t.get("height", 120)) * (float(t.get("scale", 100)) / 100.0)

        if mode == "center_x":
            t["x"] = 0
        elif mode == "center_y":
            t["y"] = 0
        elif mode == "left":
            t["x"] = int(round(-canvas_w / 2 + w / 2 + padding))
        elif mode == "right":
            t["x"] = int(round(canvas_w / 2 - w / 2 - padding))
        elif mode == "top":
            t["y"] = int(round(-canvas_h / 2 + h / 2 + padding))
        elif mode == "bottom":
            t["y"] = int(round(canvas_h / 2 - h / 2 - padding))

        layer["transform"] = t
        return layer

    def duplicate_layer(self, layer):
        """Duplicate selected graphic while generating a new object ID and preserving transforms and keyframes."""
        new_layer = json.loads(json.dumps(layer))
        new_layer["id"] = f"g_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"
        new_layer["name"] = f"{layer.get('name', 'Graphic')} (Copy)"
        
        # Slight position offset so it's visible next to original
        t = new_layer.get("transform", {})
        t["x"] = float(t.get("x", 0)) + 15
        t["y"] = float(t.get("y", 0)) + 15
        new_layer["transform"] = t
        return new_layer

    def group_layers(self, layers):
        """Combine multiple layers into a single grouped layer."""
        if not layers or len(layers) < 2:
            return None

        xs = [float(l.get("transform", {}).get("x", 0)) for l in layers]
        ys = [float(l.get("transform", {}).get("y", 0)) for l in layers]
        ws = [float(l.get("transform", {}).get("width", 120)) for l in layers]
        hs = [float(l.get("transform", {}).get("height", 120)) for l in layers]

        min_x = min(x - w / 2 for x, w in zip(xs, ws))
        max_x = max(x + w / 2 for x, w in zip(xs, ws))
        min_y = min(y - h / 2 for y, h in zip(ys, hs))
        max_y = max(y + h / 2 for y, h in zip(ys, hs))

        grp_w = max_x - min_x
        grp_h = max_y - min_y
        grp_x = (min_x + max_x) / 2
        grp_y = (min_y + max_y) / 2

        children = []
        for l in layers:
            child = dict(l)
            c_t = dict(child.get("transform", {}))
            c_t["x"] = c_t.get("x", 0) - grp_x
            c_t["y"] = c_t.get("y", 0) - grp_y
            child["transform"] = c_t
            children.append(child)

        group_layer = {
            "id": f"grp_{int(time.time())}",
            "type": "group",
            "name": f"Group ({len(layers)} elements)",
            "start": min(float(l.get("start", 0)) for l in layers),
            "end": max(float(l.get("end", 5)) for l in layers),
            "transform": {
                "x": int(round(grp_x)),
                "y": int(round(grp_y)),
                "width": int(round(grp_w)),
                "height": int(round(grp_h)),
                "scale": 100,
                "rotation": 0,
                "opacity": 100
            },
            "children": children
        }
        return group_layer

    def ungroup_layer(self, group_layer):
        """Deconstruct a grouped layer back into individual layers."""
        if group_layer.get("type") != "group":
            return [group_layer]

        grp_t = group_layer.get("transform", {})
        grp_x = float(grp_t.get("x", 0))
        grp_y = float(grp_t.get("y", 0))

        unpacked = []
        for child in group_layer.get("children", []):
            item = dict(child)
            c_t = dict(item.get("transform", {}))
            c_t["x"] = c_t.get("x", 0) + grp_x
            c_t["y"] = c_t.get("y", 0) + grp_y
            item["transform"] = c_t
            unpacked.append(item)
        return unpacked

    def add_keyframe(self, layer, kf_time, props):
        """Add or update a keyframe at kf_time on the layer."""
        keyframes = layer.get("keyframes", [])
        existing = [k for k in keyframes if abs(k.get("time", 0) - kf_time) < 0.001]
        if existing:
            existing[0].update(props)
            existing[0]["time"] = kf_time
        else:
            keyframes.append({"time": kf_time, **props})
            keyframes.sort(key=lambda k: k.get("time", 0))
        layer["keyframes"] = keyframes
        return layer

    def remove_keyframe(self, layer, kf_time):
        """Remove keyframe at kf_time."""
        keyframes = layer.get("keyframes", [])
        layer["keyframes"] = [k for k in keyframes if abs(k.get("time", 0) - kf_time) >= 0.001]
        return layer

    def get_interpolated_state(self, layer, current_time):
        """Compute smooth linear/ease keyframe interpolation at current_time."""
        t = layer.get("transform", {})
        keyframes = layer.get("keyframes", [])
        if not keyframes or len(keyframes) == 1:
            return t

        sorted_kf = sorted(keyframes, key=lambda k: k.get("time", 0))
        prev_kf = sorted_kf[0]
        next_kf = sorted_kf[-1]

        for kf in sorted_kf:
            if kf.get("time", 0) <= current_time:
                prev_kf = kf
            if kf.get("time", 0) >= current_time:
                next_kf = kf
                break

        if abs(next_kf.get("time", 0) - prev_kf.get("time", 0)) < 0.001:
            return {**t, **prev_kf}

        t_range = next_kf.get("time", 0) - prev_kf.get("time", 0)
        t_progress = (current_time - prev_kf.get("time", 0)) / t_range
        t_progress = max(0.0, min(1.0, t_progress))

        def lerp(a, b, p):
            if isinstance(a, (int, float)) and isinstance(b, (int, float)):
                return a + (b - a) * p
            return b if p > 0.5 else a

        props = ["x", "y", "scale", "rotation", "opacity", "width", "height"]
        result = dict(t)
        for prop in props:
            if prop in prev_kf or prop in next_kf:
                prev_val = prev_kf.get(prop, t.get(prop, 0))
                next_val = next_kf.get(prop, t.get(prop, 0))
                result[prop] = lerp(prev_val, next_val, t_progress)

        return result

    def save_custom_template(self, name, category, layer_data):
        """Save a graphic layer configuration as a reusable custom template."""
        tpl_id = f"tpl_custom_{int(time.time())}"
        tpl = {
            "id": tpl_id,
            "name": name or "Custom Graphic Template",
            "category": category or "custom",
            **layer_data
        }
        self.templates.append(tpl)
        self._save_templates()
        return tpl


graphics_manager = GraphicsManager()
