
import sys
import os
import re
import subprocess
import uuid

from yt_dlp import YoutubeDL


# ============================================================
# CONFIGURATION
# ============================================================

OUTPUT_DIR = "/tmp/audios"

os.makedirs(OUTPUT_DIR, exist_ok=True)


# ============================================================
# VALIDATE QUERY
# ============================================================

if len(sys.argv) < 2:
    print("::ERROR::Query kosong", flush=True)
    sys.exit(1)


query = " ".join(sys.argv[1:]).strip()

if not query:
    print("::ERROR::Query kosong", flush=True)
    sys.exit(1)


# ============================================================
# INITIAL DATA
# ============================================================

video_url = None
title = query
video = {}

download_success = False


# ============================================================
# CLEAN FILENAME
# ============================================================

def clean_filename(name):

    name = re.sub(
        r'[\\/:*?"<>|]',
        "",
        str(name)
    )

    return name[:100].strip() or "audio"


# ============================================================
# MAIN PROCESS
# ============================================================

try:

    # ========================================================
    # SEARCH VIDEO
    # ========================================================

    search_opts = {

        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "socket_timeout": 30,

    }

    with YoutubeDL(search_opts) as ydl:

        search_result = ydl.extract_info(
            f"ytsearch1:{query}",
            download=False
        )

        entries = search_result.get("entries") or []

        if not entries:
            raise Exception("Video tidak ditemukan")

        video = entries[0]

        video_url = video.get("webpage_url")

        if not video_url and video.get("id"):
            video_url = (
                "https://www.youtube.com/watch?v="
                + video["id"]
            )

        title = video.get("title", query)

        if not video_url:
            raise Exception("URL video tidak ditemukan")

    # ========================================================
    # DOWNLOAD AUDIO
    # ========================================================

    filename = uuid.uuid4().hex

    download_opts = {

        "quiet": True,
        "no_warnings": True,

        "format": "bestaudio/best",

        "outtmpl": os.path.join(
            OUTPUT_DIR,
            filename + ".%(ext)s"
        ),

        "noplaylist": True,

        "socket_timeout": 30,

        "retries": 2,
        "fragment_retries": 2,

        "overwrites": True,

    }

    with YoutubeDL(download_opts) as ydl:

        info = ydl.extract_info(
            video_url,
            download=True
        )

        filepath = ydl.prepare_filename(info)

    # ========================================================
    # FIND DOWNLOADED FILE
    # ========================================================

    if not os.path.isfile(filepath):

        possible_files = [
            os.path.join(OUTPUT_DIR, filename + ".webm"),
            os.path.join(OUTPUT_DIR, filename + ".m4a"),
            os.path.join(OUTPUT_DIR, filename + ".opus"),
            os.path.join(OUTPUT_DIR, filename + ".mp3"),
            os.path.join(OUTPUT_DIR, filename + ".mp4"),
        ]

        filepath = next(
            (
                path
                for path in possible_files
                if os.path.isfile(path)
            ),
            None
        )

    if not filepath:
        raise Exception("File audio hasil download tidak ditemukan")

    # ========================================================
    # CONVERT TO MP3
    # ========================================================

    mp3_path = os.path.join(
        OUTPUT_DIR,
        filename + ".mp3"
    )

    result = subprocess.run(

        [
            "ffmpeg",
            "-y",
            "-i", filepath,

            "-vn",

            "-codec:a", "libmp3lame",
            "-b:a", "128k",

            mp3_path
        ],

        capture_output=True,
        text=True,
        timeout=180

    )

    if result.returncode != 0:

        raise Exception(
            "FFmpeg: " + result.stderr[-1000:]
        )

    if not os.path.exists(mp3_path):
        raise Exception("File MP3 tidak ditemukan")

    if os.path.getsize(mp3_path) == 0:
        raise Exception("File MP3 kosong")

    # ========================================================
    # DELETE ORIGINAL AUDIO
    # ========================================================

    if os.path.exists(filepath):

        if os.path.abspath(filepath) != os.path.abspath(mp3_path):
            os.remove(filepath)

    # ========================================================
    # UPDATE VIDEO INFORMATION
    # ========================================================

    title = info.get("title", title)

    video_url = info.get(
        "webpage_url",
        video_url
    )

    video["title"] = title

    video["thumbnail"] = (
        info.get("thumbnail")
        or video.get("thumbnail", "")
    )

    video["uploader"] = (
        info.get("uploader")
        or info.get("channel")
        or video.get("uploader", "-")
    )

    video["duration"] = (
        info.get("duration")
        or video.get("duration", 0)
    )

    # ========================================================
    # SUCCESS OUTPUT
    # ========================================================

    print(
        f"::SUCCESS::{mp3_path}",
        flush=True
    )

    download_success = True


# ============================================================
# ERROR HANDLING
# ============================================================

except Exception as e:

    print(
        f"::ERROR::{str(e)}",
        flush=True
    )


# ============================================================
# FINAL INFORMATION OUTPUT
# ============================================================

finally:

    if video_url:

        print(
            f"::TITLE::{title}",
            flush=True
        )

        print(
            f"::URL::{video_url}",
            flush=True
        )

        print(
            f"::THUMB::{video.get('thumbnail', '')}",
            flush=True
        )

        print(
            f"::UPLOADER::{video.get('uploader', '-')}",
            flush=True
        )

        print(
            f"::DURATION::{video.get('duration', 0)}",
            flush=True
        )
