"""
Graphics Renderer for UpClip Studio — Phase 18.
Handles rasterizing vector shapes, lines, arrows, badges, typography, image assets (PNG with transparency, JPG, WebP),
and compositing them onto video using FFmpeg filtergraphs with precise timing, positions, scaling, rotation, opacity,
and keyframe animation.
"""

import os
import math
import subprocess
import time
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

import config


class GraphicsRenderer:
    def __init__(self):
        self.ffmpeg = config.FFMPEG_PATH

    def composite_graphics(self, input_video, graphics_layers, output_video, canvas_width=360, canvas_height=640, current_time=0.0):
        """
        Burn multiple graphics layers onto a video stream using FFmpeg filter_complex.

        input_video     : Path or str to source video
        graphics_layers : list of graphic layer dicts
        output_video    : Path or str to target output video
        canvas_width    : editor preview canvas width in pixels
        canvas_height   : editor preview canvas height in pixels
        current_time    : current playback time for keyframe interpolation
        """
        input_video = Path(input_video)
        output_video = Path(output_video)
        output_video.parent.mkdir(parents=True, exist_ok=True)

        if not input_video.exists():
            raise FileNotFoundError(f"Input video not found: {input_video}")

        # Filter active and visible layers
        active_layers = [g for g in graphics_layers if g.get("visible", True) is not False]
        if not active_layers:
            cmd = [
                self.ffmpeg, "-y",
                "-i", str(input_video),
                "-c", "copy",
                str(output_video)
            ]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            return output_video

        # Sort by layerOrder or index (lowest first)
        active_layers.sort(key=lambda g: g.get("layerOrder", 0))

        temp_dir = config.OUTPUT_DIR / "temp"
        temp_dir.mkdir(parents=True, exist_ok=True)

        # Detect video dimensions
        from utils.video_utils import VideoLoader
        loader = VideoLoader(input_video)
        meta = loader.metadata()
        loader.close()

        video_w = meta.get("width", 1080)
        video_h = meta.get("height", 1920)

        # Scale factor from canvas coordinates to video coordinates
        scale_x = video_w / max(1, canvas_width)
        scale_y = video_h / max(1, canvas_height)

        input_args = ["-i", str(input_video)]
        filter_chains = []
        temp_images = []

        last_stream = "[0:v]"

        for idx, layer in enumerate(active_layers):
            img_path = self._render_layer_to_image(layer, temp_dir, idx, scale_x, scale_y, current_time)
            temp_images.append(img_path)

            input_idx = idx + 1
            input_args.extend(["-i", str(img_path)])

            start_t = float(layer.get("start", 0))
            end_t = float(layer.get("end", 999999))
            t = layer.get("transform", {})

            # Center-relative coordinates mapped to video space
            layer_x = float(t.get("x", 0))
            layer_y = float(t.get("y", 0))
            opacity = float(t.get("opacity", 100)) / 100.0

            # Absolute top-left coordinate on video:
            pos_x_video = (canvas_width / 2 + layer_x - (float(t.get("width", 120)) / 2)) * scale_x
            pos_y_video = (canvas_height / 2 + layer_y - (float(t.get("height", 120)) / 2)) * scale_y

            pos_x_int = int(round(pos_x_video))
            pos_y_int = int(round(pos_y_video))

            # Opacity filter on input if required
            in_stream = f"[{input_idx}:v]"
            if opacity < 0.99:
                filter_chains.append(f"{in_stream}format=rgba,colorchannelmixer=aa={opacity:.2f}[op_{idx}]")
                in_stream = f"[op_{idx}]"

            # Overlay expression
            out_stream = f"[v_out_{idx}]"
            overlay_expr = f"{last_stream}{in_stream}overlay=x={pos_x_int}:y={pos_y_int}:enable='between(t,{start_t:.2f},{end_t:.2f})'{out_stream}"
            filter_chains.append(overlay_expr)
            last_stream = out_stream

        filter_str = ";".join(filter_chains)

        command = [
            self.ffmpeg, "-y",
            *input_args,
            "-filter_complex", filter_str,
            "-map", last_stream,
            "-map", "0:a?",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "23",
            "-c:a", "aac",
            str(output_video)
        ]

        print("[GRAPHICS] Rendering graphics overlays with FFmpeg...")
        try:
            subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            print("[SUCCESS] Graphics compositing completed:", output_video)
        finally:
            for p in temp_images:
                try:
                    if p.exists():
                        p.unlink()
                except Exception:
                    pass

        return output_video

    def _render_layer_to_image(self, layer, temp_dir, idx, scale_x, scale_y, current_time=0.0):
        """Render shape, text, line, arrow, badge, icon, or image asset into a transparent PNG file."""
        l_type = layer.get("type", "shape")
        t = layer.get("transform", {})
        app = layer.get("appearance", {})
        content = layer.get("content", {})
        typo = layer.get("typography", {})

        keyframes = layer.get("keyframes", [])
        if keyframes and len(keyframes) > 1:
            from core.graphics_manager import graphics_manager
            t = graphics_manager.get_interpolated_state(layer, current_time)

        w_canvas = float(t.get("width", 120)) * (float(t.get("scale", 100)) / 100.0)
        h_canvas = float(t.get("height", 120)) * (float(t.get("scale", 100)) / 100.0)

        w_px = max(6, int(round(w_canvas * scale_x)))
        h_px = max(6, int(round(h_canvas * scale_y)))

        pad = 24
        img = Image.new("RGBA", (w_px + pad * 2, h_px + pad * 2), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        fill_hex = app.get("fill") or app.get("fillColor") or "#8B5CF6"
        stroke_hex = app.get("stroke") or app.get("strokeColor") or "#000000"
        stroke_w = int(round(float(app.get("strokeWidth", 2)) * scale_x))
        radius = int(round(float(app.get("cornerRadius", 8)) * scale_x))

        fill_rgba = self._hex_to_rgba(fill_hex)
        stroke_rgba = self._hex_to_rgba(stroke_hex) if stroke_w > 0 else None

        box = [pad, pad, pad + w_px, pad + h_px]

        # 1. SHAPES & VECTOR ELEMENTS
        if l_type == "shape":
            shape_type = content.get("shapeType") or "rect"
            if shape_type in ("rect", "box"):
                draw.rectangle(box, fill=fill_rgba, outline=stroke_rgba, width=stroke_w)
            elif shape_type in ("rounded_rect", "rounded_box"):
                draw.rounded_rectangle(box, radius=max(4, radius), fill=fill_rgba, outline=stroke_rgba, width=stroke_w)
            elif shape_type in ("circle", "ellipse"):
                draw.ellipse(box, fill=fill_rgba, outline=stroke_rgba, width=stroke_w)
            elif shape_type == "line":
                # Horizontal center line
                cy = pad + h_px // 2
                draw.line([(pad, cy), (pad + w_px, cy)], fill=fill_rgba, width=max(2, stroke_w or 4))
            elif shape_type == "arrow":
                pts = [
                    (pad, pad + h_px * 0.35),
                    (pad + w_px * 0.6, pad + h_px * 0.35),
                    (pad + w_px * 0.6, pad + h_px * 0.1),
                    (pad + w_px, pad + h_px * 0.5),
                    (pad + w_px * 0.6, pad + h_px * 0.9),
                    (pad + w_px * 0.6, pad + h_px * 0.65),
                    (pad, pad + h_px * 0.65)
                ]
                draw.polygon(pts, fill=fill_rgba, outline=stroke_rgba, width=stroke_w)
            elif shape_type == "triangle":
                points = [
                    (pad + w_px // 2, pad),
                    (pad + w_px, pad + h_px),
                    (pad, pad + h_px)
                ]
                draw.polygon(points, fill=fill_rgba, outline=stroke_rgba, width=stroke_w)
            elif shape_type == "star":
                cx, cy = pad + w_px / 2, pad + h_px / 2
                pts = self._star_points(cx, cy, w_px / 2, w_px / 4, 5)
                draw.polygon(pts, fill=fill_rgba, outline=stroke_rgba, width=stroke_w)
            elif shape_type == "badge":
                draw.rounded_rectangle(box, radius=radius or 12, fill=fill_rgba, outline=stroke_rgba, width=stroke_w)
                label = typo.get("text") or content.get("label") or "HOT 🔥"
                font_size = int(round(h_px * 0.48))
                font = self._get_font(typo.get("fontFamily", "Inter"), font_size)
                text_col = self._hex_to_rgba(typo.get("color", "#FFFFFF"))
                draw.text((pad + w_px / 2, pad + h_px / 2), label, fill=text_col, font=font, anchor="mm")

        # 2. TEXT & LOWER THIRDS
        elif l_type in ("text", "lower_third", "title", "callout"):
            text = typo.get("text") or layer.get("name") or "Text Graphic"
            font_size = int(round(float(typo.get("fontSize", 36)) * scale_x))
            font = self._get_font(typo.get("fontFamily", "Inter"), font_size)
            text_color = self._hex_to_rgba(typo.get("color", "#FFFFFF"))

            # Background bar for lower third or box
            if l_type == "lower_third" or app.get("fill") or app.get("backgroundColor"):
                draw.rounded_rectangle(box, radius=radius or 8, fill=fill_rgba, outline=stroke_rgba, width=stroke_w)

            draw.text((pad + w_px / 2, pad + h_px / 2), text, fill=text_color, font=font, anchor="mm")

        # 3. IMAGE ASSETS (PNG transparency preserved, JPG, WebP)
        elif l_type in ("image", "asset", "sticker"):
            src_url = content.get("src") or content.get("url") or layer.get("url") or ""
            img_file = None
            if src_url:
                fname = Path(src_url).name
                cand1 = config.INPUT_DIR / "assets" / fname
                cand2 = config.INPUT_DIR / fname
                cand3 = config.ROOT_DIR / "static" / "assets" / fname
                if cand1.exists():
                    img_file = cand1
                elif cand2.exists():
                    img_file = cand2
                elif cand3.exists():
                    img_file = cand3

            if img_file and img_file.exists():
                try:
                    loaded_img = Image.open(img_file).convert("RGBA")
                    loaded_resized = loaded_img.resize((w_px, h_px), Image.Resampling.LANCZOS)
                    img.paste(loaded_resized, (pad, pad), loaded_resized)
                except Exception as e:
                    print(f"[GRAPHICS] Error loading image asset {img_file}: {e}")
                    draw.rectangle(box, fill=fill_rgba, outline=stroke_rgba, width=stroke_w)
            else:
                # Fallback badge
                draw.rounded_rectangle(box, radius=radius or 8, fill=fill_rgba, outline=stroke_rgba, width=stroke_w)
                label = layer.get("name", "Asset")
                font = self._get_font("Inter", int(round(h_px * 0.3)))
                draw.text((pad + w_px / 2, pad + h_px / 2), label, fill=(255, 255, 255, 255), font=font, anchor="mm")

        # 4. ICON / BADGE
        elif l_type == "icon":
            draw.ellipse(box, fill=fill_rgba, outline=stroke_rgba, width=stroke_w)
            symbol = content.get("iconName") or "★"
            font = self._get_font("Arial", int(round(h_px * 0.55)))
            draw.text((pad + w_px / 2, pad + h_px / 2), symbol, fill=(255, 255, 255, 255), font=font, anchor="mm")

        # 5. PROGRESS BARS
        elif l_type in ("progress", "progress_bar"):
            draw.rounded_rectangle(box, radius=radius or 6, fill=self._hex_to_rgba("#1E1E2E"), outline=stroke_rgba, width=stroke_w)
            pct = float(content.get("progressPercent", 70)) / 100.0
            fill_w = max(4, int(w_px * pct))
            fill_box = [pad, pad, pad + fill_w, pad + h_px]
            draw.rounded_rectangle(fill_box, radius=radius or 6, fill=fill_rgba)

        # 6. GROUPED LAYERS
        elif l_type == "group":
            for child in layer.get("children", []):
                c_img_path = self._render_layer_to_image(child, temp_dir, f"{idx}_child", scale_x, scale_y, current_time)
                if c_img_path.exists():
                    try:
                        c_img = Image.open(c_img_path).convert("RGBA")
                        img.paste(c_img, (0, 0), c_img)
                        c_img_path.unlink()
                    except Exception:
                        pass

        # Apply rotation if present
        rotation = float(t.get("rotation", 0))
        if rotation != 0:
            img = img.rotate(-rotation, resample=Image.Resampling.BICUBIC, expand=True)

        out_path = temp_dir / f"layer_{idx}_{int(time.time() * 1000)}.png"
        img.save(out_path, "PNG")
        return out_path

    @staticmethod
    def _hex_to_rgba(hex_str, default_alpha=255):
        if not hex_str:
            return (255, 255, 255, default_alpha)
        h = str(hex_str).lstrip("#")
        if len(h) == 3:
            h = "".join([c * 2 for c in h])
        if len(h) == 6:
            r = int(h[0:2], 16)
            g = int(h[2:4], 16)
            b = int(h[4:6], 16)
            return (r, g, b, default_alpha)
        return (255, 255, 255, default_alpha)

    @staticmethod
    def _get_font(font_name, size):
        try:
            font_map = {
                "Arial": "arial.ttf",
                "Arial Black": "ariblk.ttf",
                "Anton": "impact.ttf",
                "Bebas Neue": "impact.ttf",
                "Inter": "segoeui.ttf",
                "Roboto": "segoeui.ttf",
                "Manrope": "segoeui.ttf",
                "DM Sans": "segoeui.ttf",
                "Plus Jakarta Sans": "segoeui.ttf",
                "Poppins": "segoeui.ttf",
                "Montserrat": "segoeui.ttf",
                "JetBrains Mono": "consola.ttf",
            }
            mapped = font_map.get(font_name, "arial.ttf")
            return ImageFont.truetype(mapped, size)
        except Exception:
            return ImageFont.load_default()

    @staticmethod
    def _star_points(cx, cy, r_outer, r_inner, num_pts=5):
        pts = []
        angle_step = math.pi / num_pts
        start_angle = -math.pi / 2
        for i in range(num_pts * 2):
            r = r_outer if i % 2 == 0 else r_inner
            a = start_angle + i * angle_step
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        return pts
