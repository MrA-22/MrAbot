
#!/bin/sh

# ==============================
# SET LOG
# ==============================

LOG_FILE="./api.log"

echo "===== STARTING BOT & API at $(date) =====" >> "$LOG_FILE"

# ==============================
# START FLASK API
# ==============================

echo "Starting Flask API on port 5001..."

FLASK_PORT=5001 python -u api.py >> "$LOG_FILE" 2>&1 &

FLASK_PID=$!

echo "Flask PID: $FLASK_PID"

# ==============================
# WAIT FOR FLASK
# ==============================

sleep 3

# ==============================
# START NODE BOT
# ==============================

echo "Starting Node.js WhatsApp Bot..."

node index.js
