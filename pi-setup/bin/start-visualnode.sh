#!/bin/bash
# Wrapper script for Chromium kiosk — waits for Node.js server before starting
# Deploy to: /home/patch/bin/start-visualnode.sh
# Make executable: chmod +x ~/bin/start-visualnode.sh

export DISPLAY=:0
export XAUTHORITY=/home/patch/.Xauthority

# Wait for Node.js server (max 30 seconds)
for i in $(seq 1 30); do
    curl -s http://localhost:3000 > /dev/null 2>&1 && break
    sleep 1
done

exec chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --autoplay-policy=no-user-gesture-required \
    --enable-web-midi \
    --use-gl=egl \
    --ignore-gpu-blocklist \
    --enable-gpu-rasterization \
    --window-position=1920,0 \
    --window-size=1024,600 \
    --user-data-dir=/home/patch/.chromium-visualnode \
    http://localhost:3000
