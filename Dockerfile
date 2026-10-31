
FROM python:3.12-slim

# =============================
# SYSTEM DEPENDENCIES
# =============================
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ffmpeg \
    ca-certificates \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    fonts-liberation \
    libappindicator3-1 \
    xdg-utils \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# =============================
# NODE DEPENDENCIES
# =============================
COPY package*.json ./

RUN npm cache clean --force \
    && npm install --omit=dev --legacy-peer-deps

# =============================
# COPY PROJECT
# =============================
COPY . .

# =============================
# PYTHON DEPENDENCIES
# =============================
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --upgrade \
    "yt-dlp[default]" \
    requests \
    beautifulsoup4 \
    playwright \
    flask \
    flask-cors \
    qrcode \
    pillow

# =============================
# PLAYWRIGHT CHROMIUM
# =============================
RUN playwright install --with-deps chromium

# =============================
# FOLDER OUTPUT
# =============================
RUN mkdir -p /app/videos \
    && chmod -R 777 /app/videos

# =============================
# ENVIRONMENT
# =============================
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production

# =============================
# START SCRIPT
# =============================
RUN sed -i 's/\r$//' /app/start.sh \
    && chmod +x /app/start.sh

# =============================
# START CONTAINER
# =============================
CMD ["/bin/sh", "/app/start.sh"]
