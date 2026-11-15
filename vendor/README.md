# Vendored libraries (so the app starts with no connection)

| Library | Version | Source | Licence |
|---|---|---|---|
| Firebase JS SDK compat (`firebase/`) | 12.18.0 | https://www.gstatic.com/firebasejs/12.18.0/ | Apache-2.0 |
| qrcode-generator (`qrcode-generator/`) | 1.4.4 | https://github.com/kazuhikoarase/qrcode-generator | MIT |

Unmodified copies (same files as the Territory Tracker). They load only when a parent phone is
paired or being paired. When upgrading, bump `VERSION` in `sw.js`.

qrcode-generator draws the Pair a phone QR code entirely on the device. It is cached by the service worker for offline use.
