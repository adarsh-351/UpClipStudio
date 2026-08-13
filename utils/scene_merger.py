import config


class SceneMerger:

    def merge(self, scenes):

        merged = []

        if not scenes:
            return merged

        current_start = scenes[0]["start"]
        current_end = scenes[0]["end"]

        for scene in scenes[1:]:

            current_duration = current_end - current_start

            # Keep adding scenes until minimum duration reached
            if current_duration < config.MIN_CLIP_DURATION:
                current_end = scene["end"]
                continue

            merged.append({
                "start": current_start,
                "end": current_end,
                "duration": current_end - current_start
            })

            current_start = scene["start"]
            current_end = scene["end"]

        # Add last clip
        if current_end > current_start:
            merged.append({
                "start": current_start,
                "end": current_end,
                "duration": current_end - current_start
            })

        return merged