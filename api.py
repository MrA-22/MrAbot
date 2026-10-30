from flask import Flask, request, jsonify
from flask_cors import CORS
import json, os, threading, time
from urllib.parse import quote  # 🛠️ Mengamankan string teks QR tanpa install plugin luar

app = Flask(__name__)
CORS(app) # ⚡ CORS aman

# ---------------- FILE PATH ----------------
STATUS_FILE = "./bot_status.txt"
GROUP_FILE = "./group_list.json"
STATS_FILE = "./bot_stats.json"
LOG_FILE = "./bot.log"
CMD_FILE = "./command_queue.txt"

# ---------------- DATA QR SEMENTARA ----------------
QR_GLOBAL_DATA = {"qr": None}

# ---------------- UTILS ----------------
def safe_read_json(path, default):
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except:
            return default
    return default

def safe_write_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def append_log(msg):
    with open(LOG_FILE, "a") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {msg}\n")

# ------------------- STATUS BOT -------------------
@app.route("/status", methods=["GET"])
def get_status():
    try:
        if os.path.exists(STATUS_FILE):
            with open(STATUS_FILE, "r") as f:
                status = f.read().strip()
            return jsonify({"status": status})
        else:
            return jsonify({"status": "STOPPED"})
    except Exception as e:
        return jsonify({"status": "UNKNOWN", "error": str(e)})

# ------------------- LIST GROUP -------------------
@app.route("/groups", methods=["GET"])
def get_groups():
    try:
        groups = safe_read_json(GROUP_FILE, [])
        return jsonify(groups)
    except Exception as e:
        return jsonify({"groups": [], "error": str(e)})

# ------------------- STATS BOT -------------------
@app.route("/stats", methods=["GET"])
def get_stats():
    try:
        stats = safe_read_json(STATS_FILE, {"groups": 0, "users": 0})
        return jsonify(stats)
    except Exception as e:
        return jsonify({"groups": 0, "users": 0, "error": str(e)})

# ------------------- PROGRESS -------------------
@app.route("/progress", methods=["GET"])
def get_progress():
    return jsonify({
        "total": 100,
        "sent": 25,
        "failed": 5
    })

# ------------------- SEND COMMAND -------------------
@app.route("/send-command", methods=["POST"])
def send_command():
    data = request.json
    cmd = data.get("command")
    if not cmd:
        return jsonify({"status": "error", "error": "Command kosong"})
    try:
        with open(CMD_FILE, "a") as f:
            f.write(cmd + "\n")
        append_log(f"Command queued: {cmd}")
        return jsonify({"status": "ok", "command": cmd})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)})

# ------------------- GET LOG -------------------
@app.route("/logs", methods=["GET"])
def get_logs():
    try:
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, "r") as f:
                lines = f.readlines()[-100:]
            return "<br>".join([line.strip() for line in lines])
        else:
            return "Log file belum ada"
    except Exception as e:
        return f"Error: {str(e)}"

# ------------------- QR ENDPOINTS -------------------
@app.route("/set-qr", methods=["POST"])  
def set_qr():
    try:
        data = request.json
        if not data:
            return jsonify({"status": "error", "error": "JSON data kosong"}), 400
            
        qr_code = data.get("qr")
        if not qr_code:
            return jsonify({"status": "error", "error": "Variabel QR data kosong"}), 400
            
        QR_GLOBAL_DATA["qr"] = qr_code
        append_log("QR Code berhasil diperbarui dari Node.js")
        return jsonify({"status": "success", "message": "QR terupdate di Flask"}), 200
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route("/get-qr", methods=["GET"])  
def get_qr():
    qr_data = QR_GLOBAL_DATA.get("qr")
    
    # 1. PROTEKSI JIKA DATA SAMA SEKALI BELUM MASUK
    if not qr_data:
        return "<h1>❌ QR belum tersedia, silakan refresh halaman atau periksa bot Node.js Anda.</h1>", 404
        
    # 2. PROTEKSI JIKA DATA YANG MASUK KOSONG / UNDEFINED DARI NODE.JS
    if qr_data == "undefined" or qr_data == "null" or len(str(qr_data).strip()) < 5:
        return f'''
        <div style="background-color: #ff4d4d; color: white; padding: 20px; font-family: Arial; text-align: center; border-radius: 8px; margin: 20px;">
            <h1>⚠️ DATA QR RUSAK DARI NODE.JS!</h1>
            <p>Flask menerima data QR yang tidak valid.</p>
            <p><b>Isi data asli yang diterima:</b> <code style="background: black; padding: 5px; border-radius: 4px;">{qr_data}</code></p>
            <p>Periksa kembali bagian <code>client.on('qr', ...)</code> di bot Node.js Anda!</p>
        </div>
        ''', 200

    # 3. JIKA DATA AMAN, GENERATE MENGGUNAKAN GOOGLE CHART API YANG BENAR
    safe_qr_data = quote(str(qr_data))
    qr_image_url = f"https://googleapis.com{safe_qr_data}&choe=UTF-8"
    
    return f'''
    <html>
    <head>
        <title>Scan QR WhatsApp</title>
        <meta http-equiv="refresh" content="15">
        <style>
            body {{
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                font-family: Arial, sans-serif;
                background-color: #121212;
                color: white;
                margin: 0;
            }}
            img {{
                border: 15px solid white;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                border-radius: 8px;
                margin-top: 20px;
                background-color: white;
                width: 300px;
                height: 300px;
            }}
            h1 {{
                font-size: 24px;
                letter-spacing: 1px;
                margin-bottom: 5px;
            }}
            p {{
                color: #b3b3b3;
                font-size: 14px;
            }}
        </style>
    </head>
    <body>
        <h1>Scan QR WhatsApp</h1>
        <p>Buka WhatsApp di HP Anda > Perangkat Tautan > Tautkan Perangkat</p>
        <img src="{qr_image_url}" alt="WhatsApp QR Code" />
    </body>
    </html>
    '''

# ------------------- ROOT -------------------
@app.route("/", methods=["GET"])
def root():
    return "✅ MR.A BOT API RUNNING 🚀"

# ------------------- AUTO CREATE FILE -------------------
for fpath, default in [(STATUS_FILE, "STOPPED"), (CMD_FILE, []), (GROUP_FILE, []), (STATS_FILE, {"groups":0,"users":0})]:
    if not os.path.exists(fpath):
        if isinstance(default, str):
            with open(fpath, "w") as f:
                f.write(default)
        else:
            safe_write_json(fpath, default)

# ------------------- RUN SERVER -------------------
if __name__ == "__main__":
    PORT = int(os.environ.get("PORT", 5000))
    print(f"🟢 API running on port {PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=False)
