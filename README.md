# Cloudflare DDNS

> 🌎 Automatically update your DNS records when your IP changes.

## Installation

Firstly make sure you have Node.js and Git installed.

Then find a suitable location for the program and:

```bash
git clone https://gitlab.com/makitty/cloudflare-ddns
cd cloudflare-ddns
cp settings.example.js settings.js
npm install
```

Edit `settings.js` to your likings.

You can find your Cloudflare's API key at: https://www.cloudflare.com/a/profile named "Global API Key"

Run `node app.js` indefinitely or use a process manager such as `pm2`.

```bash
npm install pm2 -g
pm2 start app.js --name "Cloudflare DDNS"
pm2 help
```
