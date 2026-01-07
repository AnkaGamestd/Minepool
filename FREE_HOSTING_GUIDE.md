# Free Node.js Hosting Options

Since your current host doesn't support Node.js, here are the best free alternatives to host your 8-Ball Pool Multiplayer game.

## 1. Render.com (Recommended)
**Best for:** Ease of use, continuous deployment from GitHub.
**Free Tier:** 512MB RAM, shared CPU. (Spins down after inactivity, takes ~30s to wake up).

### How to Deploy:
1.  **Push to GitHub**:
    *   Create a repository on GitHub.
    *   Push all your project files to it.
2.  **Create Service**:
    *   Sign up at [dashboard.render.com](https://dashboard.render.com).
    *   Click **New +** -> **Web Service**.
    *   Connect your GitHub repository.
3.  **Configure**:
    *   **Name:** `8ball-pool` (or similar)
    *   **Runtime:** `Node`
    *   **Build Command:** `npm install`
    *   **Start Command:** `node server.js`
    *   **Region:** Choose the one closest to you (e.g., Frankfurt for Europe).
4.  **Deploy**:
    *   Click **Create Web Service**.
    *   Render will clone your repo, install dependencies, and start the server.
    *   You will get a URL like `https://8ball-pool.onrender.com`.

---

## 2. Glitch.com
**Best for:** Quick prototyping, editing code directly in the browser.
**Free Tier:** Sleep mode after 5 minutes of inactivity.

### How to Deploy:
1.  Go to [glitch.com](https://glitch.com).
2.  Click **New Project** -> **Import from GitHub** (or **glitch-hello-node** and copy-paste files).
3.  If importing, paste your GitHub repo URL.
4.  Glitch automatically installs dependencies and runs `npm start`.
5.  **Note:** Glitch exposes port 3000 by default, but your code uses `process.env.PORT`, so it should work automatically.

---

## 3. Fly.io
**Best for:** Low latency, running close to users.
**Free Tier:** Small allowance of free usage (requires credit card for verification).

### How to Deploy:
1.  Install the `flyctl` command-line tool.
2.  Run `fly launch` in your project folder.
3.  Follow the prompts to configure and deploy.

---

## Important Notes for Free Tiers
*   **"Spin Down":** Most free tiers (Render, Glitch) put your app to "sleep" if no one visits it for a while. The first time you visit after a break, it might take 30-60 seconds to load. This is normal.
*   **WebSocket Support:** All the above support Socket.IO (WebSockets), which is required for your multiplayer game.
*   **Database:** Your current code uses in-memory storage (`const users = new Map()`). **WARNING:** On free hosts, every time the app restarts or sleeps, **all user accounts and data will be wiped**.
    *   To fix this, you would need to connect a real database (like MongoDB Atlas, which also has a free tier).
