import sys
import os
import re
import subprocess
from yt_dlp import YoutubeDL

if len(sys.argv) < 2:
print("::ERROR::Query kosong", flush=True)
sys.exit(1)

query = " ".join(sys.argv[1:])
search = f"ytsearch1:{query}"

output_dir = "/tmp/audios"
os.makedirs(output_dir, exist_ok=True)

video_url = None
title = query
video = {}

try:
# 🔍 SEARCH
with YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
info = ydl.extract_info(search, download=False)
video = info["entries"][0]

video_url = video.get("webpage_url", "")  
    title = video.get("title", query)  

# ⬇️ DOWNLOAD  
ydl_opts = {  
    "quiet": True,  
    "format": "bestaudio/best",  
    "outtmpl": f"{output_dir}/%(title)s.%(ext)s",  
    "noplaylist": True,  
    "extractor_args": {  
        "youtube": {  
            "player_client": ["android", "web_creator"]  
        }  
    },  
    "http_headers": {  
        "User-Agent": "com.google.android.youtube/19.09.37"  
    }  
}  

with YoutubeDL(ydl_opts) as ydl:  
    info = ydl.extract_info(video_url, download=True)  
    filepath = ydl.prepare_filename(info)  

# 🎧 CONVERT  
base, ext = os.path.splitext(filepath)  
mp3_path = base + ".mp3"  

subprocess.run(  
    ["ffmpeg", "-y", "-i", filepath, "-vn", "-acodec", "libmp3lame", "-b:a", "128k", mp3_path],  
    stdout=subprocess.DEVNULL,  
    stderr=subprocess.DEVNULL  
)  

if os.path.exists(mp3_path):  
    os.remove(filepath)  

    print(f"::SUCCESS::{mp3_path}", flush=True)  
else:  
    raise Exception("Convert gagal")

except Exception as e:
print(f"::ERROR::{str(e)}", flush=True)

🔥 SELALU KIRIM INFO

if video_url:
print(f"::TITLE::{title}", flush=True)
print(f"::URL::{video_url}", flush=True)
print(f"::THUMB::{video.get('thumbnail','')}", flush=True)
print(f"::UPLOADER::{video.get('uploader','-')}", flush=True)
print(f"::DURATION::{video.get('duration',0)}", flush=True)
