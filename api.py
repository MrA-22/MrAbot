
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import json
import os
import time
import re
import html

app = Flask(__name__)

# Maksimal request QR 2 MB
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024

CORS(app)

# =============================
# FILE PATH
# =============================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

STATUS_FILE = os.path.join(BASE_DIR, "bot_status.txt")
GROUP_FILE = os.path.join(BASE_DIR, "group_list.json")
STATS_FILE = os.path.join(BASE_DIR, "bot_stats.json")
LOG_FILE = os.path.join(BASE_DIR, "bot.log")
CMD_FILE = os.path.join(BASE_DIR, "command_queue.txt")

# =============================
# QR TEMPORARY STORAGE
# =============================

QR_GLOBAL_DATA = {
    "qr": None,
    "updated_at": None
}

# =============================
# UTILS
# =============================

def safe_read_json(path, default):
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        append_log(f"JSON READ ERROR: {e}")

    return default


def safe_write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def append_log(msg):
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(
                f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {msg}\n"
            )
    except Exception:
        pass


# =============================
# ROOT
# =============================

@app.route("/", methods=["GET"])
def root():
    return jsonify({
        "status": "success",
        "message": "MR.A BOT API RUNNING",
        "version": "1.1",
        "endpoints": [
            "/status",
            "/groups",
            "/stats",
            "/progress",
            "/logs",
            "/set-qr",
            "/get-qr",
            "/clear-qr"
        ]
    })


# =============================
# BOT STATUS
# =============================

@app.route("/status", methods=["GET"])
def get_status():
    try:
        if os.path.exists(STATUS_FILE):
            with open(STATUS_FILE, "r", encoding="utf-8") as f:
                status = f.read().strip()

            return jsonify({"status": status})

        return jsonify({"status": "STOPPED"})

    except Exception as e:
        return jsonify({
            "status": "UNKNOWN",
            "error": str(e)
        }), 500


# =============================
# GROUP LIST
# =============================

@app.route("/groups", methods=["GET"])
def get_groups():
    groups = safe_read_json(GROUP_FILE, [])
    return jsonify(groups)


# =============================
# BOT STATS
# =============================

@app.route("/stats", methods=["GET"])
def get_stats():
    stats = safe_read_json(
        STATS_FILE,
        {"groups": 0, "users": 0}
    )

    return jsonify(stats)


# =============================
# PROGRESS
# =============================

@app.route("/progress", methods=["GET"])
def get_progress():
    return jsonify({
        "total": 100,
        "sent": 25,
        "failed": 5
    })


# =============================
# SEND COMMAND
# =============================

@app.route("/send-command", methods=["POST"])
def send_command():
    data = request.get_json(silent=True) or {}
    cmd = data.get("command")

    if not isinstance(cmd, str) or not cmd.strip():
        return jsonify({
            "status": "error",
            "error": "Command kosong"
        }), 400

    try:
        with open(CMD_FILE, "a", encoding="utf-8") as f:
            f.write(cmd.strip() + "\n")

        append_log(f"Command queued: {cmd}")

        return jsonify({
            "status": "ok",
            "command": cmd
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


# =============================
# GET LOGS
# =============================

@app.route("/logs", methods=["GET"])
def get_logs():
    try:
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, "r", encoding="utf-8") as f:
                lines = f.readlines()[-100:]

            safe_lines = [
                html.escape(line.strip())
                for line in lines
            ]

            return Response(
                "<br>".join(safe_lines),
                mimetype="text/html"
            )

        return "Log file belum ada"

    except Exception as e:
        return f"Error: {str(e)}", 500


# =============================
# SET QR FROM NODE.JS
# =============================

@app.route("/set-qr", methods=["POST"])
def set_qr():
    try:
        data = request.get_json(silent=True)

        if not data:
            return jsonify({
                "status": "error",
                "error": "JSON data kosong"
            }), 400

        qr_image = data.get("qr")

        if not isinstance(qr_image, str) or not qr_image:
            return jsonify({
                "status": "error",
                "error": "Data QR kosong"
            }), 400

        pattern = r"^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$"

        if not re.fullmatch(pattern, qr_image):
            return jsonify({
                "status": "error",
                "error": "Format QR PNG Base64 tidak valid"
            }), 400

        QR_GLOBAL_DATA["qr"] = qr_image
        QR_GLOBAL_DATA["updated_at"] = time.time()

        append_log("QR berhasil diterima dari Node.js")

        return jsonify({
            "status": "success",
            "message": "QR berhasil diperbarui",
            "updated_at": QR_GLOBAL_DATA["updated_at"]
        }), 200

    except Exception as e:
        append_log(f"SET QR ERROR: {e}")

        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


# =============================
# GET QR PAGE
# =============================

@app.route("/get-qr", methods=["GET"])
def get_qr():
    qr_image = QR_GLOBAL_DATA.get("qr")

    if not qr_image:
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport"
                  content="width=device-width, initial-scale=1">
            <meta http-equiv="refresh" content="5">
            <title>MR.A BOT QR</title>
        </head>

        <body style="
            background:#121212;
            color:white;
            font-family:Arial,sans-serif;
            text-align:center;
            padding:50px 20px;
        ">
            <h2>QR Belum Tersedia</h2>
            <p>Menunggu Node.js menghasilkan QR WhatsApp...</p>
            <p>Halaman diperbarui otomatis setiap 5 detik.</p>
        </body>
        </html>
        """, 404

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport"
              content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="15">

        <title>MR.A BOT - Scan QR</title>

        <style>
            * {{
                box-sizing: border-box;
            }}

            body {{
                background: #121212;
                color: white;
                font-family: Arial, sans-serif;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                text-align: center;
                padding: 20px;
            }}

            .container {{
                background: #1e1e1e;
                padding: 30px;
                border-radius: 16px;
                border: 1px solid #333;
                max-width: 400px;
                width: 100%;
            }}

            img {{
                width: 300px;
                max-width: 100%;
                height: auto;
                background: white;
                padding: 12px;
                border-radius: 10px;
                margin-top: 20px;
            }}

            p {{
                color: #aaa;
                font-size: 14px;
                line-height: 1.6;
            }}

            .status {{
                color: #00e676;
                font-size: 13px;
            }}
        </style>
    </head>

    <body>
        <div class="container">
            <h2>MR.A BOT</h2>

            <div class="status">
                ● QR CODE TERSEDIA
            </div>

            <img src="{qr_image}" alt="WhatsApp QR Code">

            <p>
                Buka WhatsApp di HP Anda.<br>
                Pilih Perangkat Tertaut → Tautkan Perangkat.
            </p>

            <p>
                Halaman diperbarui otomatis setiap 15 detik.
            </p>
        </div>
    </body>
    </html>
    """


# =============================
# CLEAR QR
# =============================

@app.route("/clear-qr", methods=["POST"])
def clear_qr():
    QR_GLOBAL_DATA["qr"] = None
    QR_GLOBAL_DATA["updated_at"] = None

    append_log("QR berhasil dihapus")

    return jsonify({
        "status": "success",
        "message": "QR berhasil dihapus"
    })


# =============================
# AUTO CREATE FILES
# =============================

default_files = [
    (STATUS_FILE, "STOPPED"),
    (CMD_FILE, ""),
    (GROUP_FILE, []),
    (STATS_FILE, {"groups": 0, "users": 0})
]

for fpath, default in default_files:
    if not os.path.exists(fpath):
        if isinstance(default, str):
            with open(fpath, "w", encoding="utf-8") as f:
                f.write(default)
        else:
            safe_write_json(fpath, default)


# =============================
# RUN SERVER
# =============================

if __name__ == "__main__":
    PORT = int(os.environ.get("FLASK_PORT", 5001))

    print(f"MR.A BOT API running on port {PORT}")

    app.run(
        host="0.0.0.0",
        port=PORT,
        debug=False,
        threaded=True
    )
