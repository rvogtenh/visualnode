# Pi Kiosk Setup — Wayfire (aktueller Stand)

OS: Raspbian Buster, Compositor: Wayfire 0.7.5
Datum: 2026-03-20

---

## /etc/wayfire/defaults.ini — Änderungen (sudo)

Panel und Desktop deaktiviert:

```ini
[autostart-static]
autostart0 = true
autostart1 = true
autostart2 = lxsession-xdg-autostart

[core]
only_decorate_gtk = false
```

---

## ~/.config/wayfire.ini — User Config

```ini
[core]
vwidth = 1
vheight = 1

[window-rules]
rule001 = on created if app_id contains chromium then fullscreen

[autostart]
autostart0 = true
autostart1 = true
visualnode = bash -c 'sleep 5 && chromium-browser --start-maximized --app=http://localhost:3000 --autoplay-policy=no-user-gesture-required --enable-web-midi --no-first-run --disable-infobars --user-data-dir=/home/patch/.chromium-visualnode'
```

---

## Node.js Server — /etc/systemd/system/visualnode.service

```ini
[Unit]
Description=Visual Node Web Server
After=network.target

[Service]
Type=simple
User=patch
WorkingDirectory=/home/patch/visualnode
ExecStart=/usr/local/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable visualnode
sudo systemctl start visualnode
```

---

## Node.js Installation (Buster — apt-Repos defekt)

```bash
cd /tmp
wget https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-armv7l.tar.xz
tar xf node-v16.20.2-linux-armv7l.tar.xz
sudo cp -r node-v16.20.2-linux-armv7l/bin/* /usr/local/bin/
sudo cp -r node-v16.20.2-linux-armv7l/lib/* /usr/local/lib/
```

---

## Fullscreen

Chromium startet maximiert (`--start-maximized`).
Fullscreen wird via JavaScript ausgelöst wenn START geklickt wird:
```javascript
document.documentElement.requestFullscreen().catch(() => {});
```
Enter-Taste triggert START ebenfalls.
