import sys
import os
import re
import subprocess
import uuid
from yt_dlp import YoutubeDL

if len(sys.argv) < 2:
print("::ERROR::Query kosong", flush=True)
sys.exit(1)

query = " ".join(sys.argv[1:]).strip()

OUTPUT_DIR = "/tmp/audios"
os.makedirs(OUTPUT_DIR, exist_ok=True)

video_url = None
title = query
video = {}

def clean_filename(name):
name = re.sub(r'[\/:*?"<>|]', "", name)
return name[:100].strip() or "audio"

try:
# SEARCH VIDEO
search_opts = {
"quiet": True,
"no_warnings": True,
"skip_download": True,
"noplaylist": True,
"socket_timeout": 30,
}

with YoutubeDL(search_opts) as ydl:  
    result = ydl.extract_info(  
        f"ytsearch1:{query}",  
        download=False  
    )  

    entries = result.get("entries") or []  

    if not entries:  
        raise Exception("Video tidak ditemukan")  

    video = entries[0]  

    video_url = video.get("webpage_url")  
    title = video.get("title", query)  

    if not video_url:  
        raise Exception("URL video tidak ditemukan")  

# DOWNLOAD AUDIO  
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
    "overwrites": True,  
}  

with YoutubeDL(download_opts) as ydl:  
    info = ydl.extract_info(video_url, download=True)  
    filepath = ydl.prepare_filename(info)  

# CONVERT MP3  
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
    raise Exception("FFmpeg: " + result.stderr[-1000:])  

if not os.path.exists(mp3_path):  
    raise Exception("File MP3 tidak ditemukan")  

if os.path.exists(filepath):  
    os.remove(filepath)  

print(f"::SUCCESS::{mp3_path}", flush=True)

except Exception as e:
print(f"::ERROR::{str(e)}", flush=True)

finally:
if video_url:
print(f"::TITLE::{title}", flush=True)
print(f"::URL::{video_url}", flush=True)
print(f"::THUMB::{video.get('thumbnail', '')}", flush=True)
print(f"::UPLOADER::{video.get('uploader', '-')}", flush=True)
print(f"::DURATION::{video.get('duration', 0)}", flush=True)
