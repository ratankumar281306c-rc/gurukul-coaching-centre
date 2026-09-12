# Gurukul Coaching Centre — Render Fixed Version

This version is prepared specifically for Render.

## IMPORTANT
Upload the **contents of this folder** to the root of your GitHub repository.
Do not put them inside another `Gurukul-Coaching-Centre-Render-Fixed/` folder.

The repository root must contain:

- server.js
- package.json
- render.yaml
- public/index.html
- public/app.js
- public/style.css
- public/logo.svg

## Render settings

- Runtime: Node
- Root Directory: leave EMPTY
- Build Command: `npm install`
- Start Command: `node server.js`

After deployment, open your Render URL.

## Test

Open `/health` on your Render URL. It should show:

`{"ok":true,"service":"gurukul-coaching-centre"}`

Then open `/` for the website.

Demo admin:
- Username: `admin`
- Password: `Gurukul@123`

Change the admin password in production using the ADMIN_PASSWORD environment variable.
