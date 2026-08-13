import subprocess
import config


def check_ffmpeg():
    """
    Check whether FFmpeg executable is available.
    """

    try:

        result = subprocess.run(
            [config.FFMPEG_PATH, "-version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )

        version = result.stdout.splitlines()[0]

        return True, version

    except Exception as e:

        return False, str(e)