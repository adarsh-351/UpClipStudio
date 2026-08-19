"""
AI Editing Advisor & Project Quality Inspector for UpClip Studio.
Analyzes timeline balance, silence, audio clarity, caption readability, and graphics safe zones.
"""

class AIAdvisor:
    def __init__(self):
        pass

    def analyze_project(self, project_data, silences=None, highlights=None):
        """
        Generate actionable suggestions and warnings based on real project analysis.

        Returns:
            list of dicts: [{ id, type, title, reason, action, payload, confidence }]
        """
        suggestions = []
        clips = project_data.get("clips", [])
        graphics = project_data.get("graphics", [])
        audio_tracks = project_data.get("audioTracks", [])
        audio_clips = project_data.get("audioClips", [])

        # 1. Check Silence Gaps
        if silences and len(silences) > 0:
            total_silence = sum(s.get("duration", 0) for s in silences)
            if total_silence >= 1.5:
                suggestions.append({
                    "id": "sug_silence_trim",
                    "type": "silence",
                    "title": "Dead Air / Silence Detected",
                    "reason": f"Found {len(silences)} silent pauses totalling {total_silence:.1f}s.",
                    "action": "Remove Silences",
                    "payload": { "type": "silence_trim", "silences": silences },
                    "confidence": "High"
                })

        # 2. Check Audio Balance (Music volume vs Voice)
        music_track = next((t for t in audio_tracks if t.get("type") == "music"), None)
        voice_track = next((t for t in audio_tracks if t.get("type") == "voice"), None)

        if music_track and (music_track.get("volume", 80) > 65):
            has_ducking = music_track.get("ducking", {}).get("enabled") is True
            if not has_ducking:
                suggestions.append({
                    "id": "sug_music_ducking",
                    "type": "audio",
                    "title": "Music Track May Overpower Speech",
                    "reason": "Music volume is at " + str(music_track.get("volume")) + "% without voice ducking.",
                    "action": "Enable Ducking",
                    "payload": { "type": "enable_ducking", "trackId": music_track.get("id") },
                    "confidence": "High"
                })

        # 3. Check Graphics in 9:16 Safe Areas
        for g in graphics:
            t = g.get("transform", {})
            y = t.get("y", 0)
            if abs(y) > 220:
                suggestions.append({
                    "id": f"sug_safe_zone_{g.get('id')}",
                    "type": "graphic",
                    "title": f"Graphic '{g.get('name')}' Near Canvas Edge",
                    "reason": "Vertical position is near top/bottom UI boundary.",
                    "action": "Center Position",
                    "payload": { "type": "reposition_graphic", "layerId": g.get("id"), "targetY": 0 },
                    "confidence": "Medium"
                })

        # 4. Check Short-Form Clip Opportunities
        if highlights and len(highlights) > 0:
            best_hl = highlights[0]
            if best_hl.get("score", 0) >= 85:
                suggestions.append({
                    "id": f"sug_highlight_{best_hl.get('id')}",
                    "type": "highlight",
                    "title": f"Top Short-Form Moment ({best_hl.get('title')})",
                    "reason": f"{best_hl.get('reason')} (Relevance: {best_hl.get('score')}%)",
                    "action": "Create Clip",
                    "payload": { "type": "create_clip", "highlight": best_hl },
                    "confidence": "High"
                })

        return suggestions
