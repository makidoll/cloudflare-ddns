# Cloudflare DDNS

> 🌎 Automatically update your DNS records when your IP changes.

I should rewrite this for Deno

## Installation

Firstly make sure you have Node.js and Git installed.

Then find a suitable location for the program and:

```bash
git clone https://github.com/makitsune/cloudflare-ddns
cd cloudflare-ddns
cp settings.example.js settings.js
pnpm install
```

Edit `settings.js` to your likings.

You can find your Cloudflare's API key at: https://dash.cloudflare.com/profile/api-tokens named "Global API Key"

Run `node app.js` indefinitely or use a process manager such as `pm2`.

```bash
npm install pm2 -g
pm2 start app.js --name "Cloudflare DDNS"
pm2 help
```
