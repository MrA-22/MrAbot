
import sys
import os
import json
import subprocess
import requests
import time

from urllib.parse import urlparse, parse_qs, quote
from yt_dlp import YoutubeDL
from playwright.sync_api import sync_playwright

# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = os.getcwd()

OUTPUT_DIR = os.path.join(BASE_DIR, "videos")
os.makedirs(OUTPUT_DIR, exist_ok=True)

REQUEST_TIMEOUT = 30

# COOKIE YOUTUBE
YOUTUBE_COOKIE_PATH = os.path.join(
    BASE_DIR,
    "cookiesyt.txt"
)

# COOKIE TIKTOK
TIKTOK_COOKIE_PATH = os.path.join(
    BASE_DIR,
    "tiktok_cookies.txt"
)

# ============================================================
# LOGGER
# ============================================================

class QuietLogger:

    def debug(self, msg):
        pass

    def warning(self, msg):
        pass

    def error(self, msg):
        sys.stderr.write(f"[YTDLP ERROR] {msg}\n")
        sys.stderr.flush()


def log(message):

    sys.stderr.write(str(message) + "\n")
    sys.stderr.flush()


def emit(marker, data):

    if isinstance(data, (dict, list)):
        data = json.dumps(data, ensure_ascii=False)

    print(f"::{marker}::{data}", flush=True)


# ============================================================
# DEBUG
# ============================================================

log("DOWNLOADER START")
log(f"PATH: {BASE_DIR}")
log(f"OUTPUT: {OUTPUT_DIR}")


# ============================================================
# HTTP SESSION
# ============================================================

session = requests.Session()

session.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36"
    )
})


# ============================================================
# NORMALIZE YOUTUBE URL
# ============================================================

def normalize_youtube_url(url):

    try:

        parsed = urlparse(url)
        host = parsed.netloc.lower()

        video_id = None

        if "youtu.be" in host:

            video_id = parsed.path.strip("/").split("/")[0]

        elif (
            "youtube.com" in host or
            "youtube-nocookie.com" in host
        ):

            if parsed.path == "/watch":

                video_id = parse_qs(
                    parsed.query
                ).get("v", [None])[0]

            elif parsed.path.startswith(
                ("/shorts/", "/embed/", "/live/")
            ):

                parts = parsed.path.strip("/").split("/")

                if len(parts) > 1:
                    video_id = parts[1]

        if video_id:

            return (
                f"https://www.youtube.com/watch?v={video_id}"
            )

    except Exception as e:

        log(f"[URL NORMALIZE ERROR] {e}")

    return url


# ============================================================
# EXPAND URL
# ============================================================

def expand_url(url):

    normalized = normalize_youtube_url(url)

    if normalized != url:
        return normalized

    if (
        "youtube.com" in url or
        "youtu.be" in url
    ):
        return normalized

    try:

        response = session.get(
            url,
            allow_redirects=True,
            timeout=REQUEST_TIMEOUT
        )

        return response.url

    except Exception as e:

        log(f"[URL EXPAND ERROR] {e}")

        return url


# ============================================================
# CONVERT WHATSAPP MP4
# ============================================================

def convert_to_whatsapp_mp4(path):

    output = os.path.splitext(path)[0] + "_wa.mp4"

    cmd = [
        "ffmpeg",
        "-y",
        "-i", path,

        "-c:v", "libx264",
        "-profile:v", "baseline",
        "-level", "3.0",
        "-pix_fmt", "yuv420p",

        "-vf", "scale=480:-2",
        "-r", "30",

        "-c:a", "aac",
        "-b:a", "128k",

        "-movflags", "+faststart",

        output
    ]

    result = subprocess.run(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True
    )

    if (
        result.returncode != 0 or
        not os.path.exists(output)
    ):

        if os.path.exists(output):
            os.remove(output)

        raise Exception(
            "FFMPEG gagal convert: " +
            result.stderr[-1000:]
        )

    if os.path.exists(path):
        os.remove(path)

    return output


# ============================================================
# TIKTOK SLIDESHOW
# ============================================================

def tiktok_slideshow(url):

    images = []

    with sync_playwright() as p:

        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox"]
        )

        context = browser.new_context(
            user_agent="Mozilla/5.0 (iPhone)",
            viewport={
                "width": 390,
                "height": 844
            },
            is_mobile=True
        )

        page = context.new_page()

        try:

            page.goto(
                url,
                timeout=30000,
                wait_until="domcontentloaded"
            )

            time.sleep(3)

            imgs = page.query_selector_all("img")

            for img in imgs:

                src = img.get_attribute("src")

                if src and "tiktokcdn" in src:
                    images.append(src)

        finally:

            browser.close()

    images = list(dict.fromkeys(images))[:10]

    files = []

    for i, img in enumerate(images):

        filename = os.path.join(
            OUTPUT_DIR,
            f"tiktok_{i}.jpg"
        )

        response = session.get(
            img,
            timeout=REQUEST_TIMEOUT
        )

        response.raise_for_status()

        with open(filename, "wb") as f:
            f.write(response.content)

        files.append(os.path.abspath(filename))

    if not files:
        raise Exception("Slideshow gagal")

    emit("FILES", files)

    emit("INFO", {
        "title": "TikTok Slideshow",
        "uploader": "TikTok"
    })

    return True


# ============================================================
# INSTAGRAM FALLBACK
# ============================================================

def instagram_fallback(url):

    try:

        headers = {
            "User-Agent": "Mozilla/5.0"
        }

        api = (
            url.split("?")[0] +
            "?__a=1&__d=dis"
        )

        response = session.get(
            api,
            headers=headers,
            timeout=15
        )

        response.raise_for_status()

        data = response.json()

        video_url = (
            data["items"][0]
            ["video_versions"][0]["url"]
        )

        filename = os.path.join(
            OUTPUT_DIR,
            "instagram.mp4"
        )

        video = session.get(
            video_url,
            timeout=REQUEST_TIMEOUT
        )

        video.raise_for_status()

        with open(filename, "wb") as f:
            f.write(video.content)

        emit("FILE", os.path.abspath(filename))

        emit("INFO", {
            "title": "Instagram Video",
            "uploader": "Instagram"
        })

        return True

    except Exception as e:

        log(f"[IG FALLBACK ERROR] {e}")

        return False


# ============================================================
# YTDLP DOWNLOAD
# ============================================================

def download_video(url):

    is_youtube = (
        "youtube.com" in url or
        "youtu.be" in url
    )

    is_tiktok = "tiktok.com" in url

    opts = {

        "format": "best[ext=mp4]/best",

        "merge_output_format": "mp4",

        "outtmpl": os.path.join(
            OUTPUT_DIR,
            "%(id)s.%(ext)s"
        ),

        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,

        "logger": QuietLogger(),

        "socket_timeout": 30,

        "retries": 1,
        "fragment_retries": 1,

        "continuedl": True,
        "overwrites": True
    }

    # ========================================================
    # YOUTUBE CONFIGURATION + COOKIE
    # ========================================================

    if is_youtube:

        opts["http_headers"] = {

            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 Chrome/131.0.0.0 "
                "Safari/537.36"
            ),

            "Referer": "https://www.youtube.com/"
        }

        if os.path.isfile(YOUTUBE_COOKIE_PATH):

            opts["cookiefile"] = YOUTUBE_COOKIE_PATH

            log("[YOUTUBE] Cookie ditemukan")

        else:

            log(
                "[YOUTUBE] Cookie tidak ditemukan: " +
                YOUTUBE_COOKIE_PATH
            )

    # ========================================================
    # TIKTOK CONFIGURATION + COOKIE
    # ========================================================

    elif is_tiktok:

        opts["http_headers"] = {

            "User-Agent": "Mozilla/5.0 (iPhone)",

            "Referer": "https://www.tiktok.com/"
        }

        opts["extractor_args"] = {

            "tiktok": {
                "api_hostname": (
                    "api16-normal-c-useast1a.tiktokv.com"
                )
            }
        }

        if os.path.isfile(TIKTOK_COOKIE_PATH):

            opts["cookiefile"] = TIKTOK_COOKIE_PATH

            log("[TIKTOK] Cookie ditemukan")

    # ========================================================
    # RETRY
    # ========================================================

    for attempt in range(2):

        try:

            log(
                f"[YTDLP] Download attempt {attempt + 1}"
            )

            with YoutubeDL(opts) as ydl:

                info = ydl.extract_info(
                    url,
                    download=True
                )

                if not info:

                    raise Exception(
                        "Informasi video kosong"
                    )

                candidates = []

                if info.get("requested_downloads"):

                    for item in info["requested_downloads"]:

                        filepath = item.get("filepath")

                        if filepath:
                            candidates.append(filepath)

                if info.get("filepath"):
                    candidates.append(info["filepath"])

                candidates.append(
                    ydl.prepare_filename(info)
                )

                file_path = next(
                    (
                        os.path.abspath(f)
                        for f in candidates
                        if f and os.path.isfile(f)
                    ),
                    None
                )

            if not file_path:

                raise Exception(
                    "File hasil download tidak ditemukan"
                )

            log(f"[DOWNLOADED] {file_path}")

            extension = os.path.splitext(
                file_path
            )[1].lower()

            if extension in (
                ".mp4",
                ".mkv",
                ".webm",
                ".mov",
                ".avi"
            ):

                final_file = convert_to_whatsapp_mp4(
                    file_path
                )

            else:

                final_file = file_path

            emit(
                "FILE",
                os.path.abspath(final_file)
            )

            emit("INFO", {

                "title": info.get("title"),

                "uploader": info.get("uploader"),

                "duration": info.get("duration"),

                "thumbnail": info.get("thumbnail"),

                "view_count": info.get("view_count")
            })

            log("[DOWNLOAD SUCCESS]")

            return True

        except Exception as e:

            error_message = str(e)

            log(
                f"[YTDLP RETRY {attempt}] {error_message}"
            )

            if "429" in error_message:

                log(
                    "[RATE LIMIT] YouTube membatasi permintaan."
                )

                return False

            if (
                "Sign in to confirm" in error_message or
                "confirm you're not a bot" in error_message
            ):

                log(
                    "[YOUTUBE AUTH] YouTube meminta verifikasi."
                )

                return False

            if attempt == 0:

                time.sleep(5)

    return False


# ============================================================
# TIKTOK API FALLBACK
# ============================================================

def tiktok_api_fallback(url):

    try:

        api = (
            "https://api.tiklydown.eu.org/api/download?url="
            + quote(url, safe="")
        )

        response = session.get(
            api,
            timeout=15
        )

        response.raise_for_status()

        data = response.json()

        if data.get("video"):

            filename = os.path.join(
                OUTPUT_DIR,
                "tiktok_api.mp4"
            )

            video = session.get(
                data["video"],
                timeout=REQUEST_TIMEOUT
            )

            video.raise_for_status()

            with open(filename, "wb") as f:
                f.write(video.content)

            emit("FILE", os.path.abspath(filename))

            emit("INFO", {
                "title": "TikTok Video",
                "uploader": "API"
            })

            return True

    except Exception as e:

        log(f"[TIKTOK API ERROR] {e}")

    return False


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    if len(sys.argv) < 2:

        log("[ERROR] URL tidak ditemukan")

        sys.exit(1)

    original_url = sys.argv[1].strip()

    url = expand_url(original_url)

    log(f"[URL] {url}")

    # TIKTOK SLIDESHOW

    if (
        "tiktok.com" in url and
        "/photo/" in url
    ):

        try:

            if tiktok_slideshow(url):
                sys.exit(0)

        except Exception as e:

            log(f"[SLIDESHOW ERROR] {e}")

    # DOWNLOAD UTAMA

    if download_video(url):
        sys.exit(0)

    # TIKTOK FALLBACK

    if "tiktok.com" in url:

        if tiktok_api_fallback(url):
            sys.exit(0)

    # INSTAGRAM FALLBACK

    if "instagram.com" in url:

        if instagram_fallback(url):
            sys.exit(0)

    log("[DOWNLOAD FAILED]")

    sys.exit(1)
