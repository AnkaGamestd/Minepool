# Deployment Guide for 8-Ball Pool Multiplayer

This application is a **Node.js** application (using Express and Socket.IO). It is **NOT** a static website (like plain HTML/PHP). It requires a server that can run Node.js.

## Option 1: cPanel Hosting (GoDaddy, Namecheap, etc.)

If your hosting plan includes **Node.js support** (look for "Setup Node.js App" in your cPanel), follow these steps:

### 1. Prepare for Upload
1.  **Do NOT** upload the `node_modules` folder. It is huge and contains thousands of files. You will install these on the server later.
2.  Zip your project files (excluding `node_modules` and `.git`).

### 2. Upload Files
1.  Go to **cPanel > File Manager**.
2.  Navigate to your domain's folder (e.g., `public_html/8Ball`).
3.  Upload your ZIP file and extract it there.

### 3. Configure Node.js App
1.  Go to **cPanel > Setup Node.js App**.
2.  Click **Create Application**.
3.  **Node.js Version:** Select 18.x or 20.x.
4.  **Application Mode:** Production.
5.  **Application Root:** The path to your uploaded files (e.g., `public_html/8Ball`).
6.  **Application URL:** The URL where you want to access the game (e.g., `yourdomain.com/8Ball`).
7.  **Application Startup File:** `server.js`.
8.  Click **Create**.

### 4. Install Dependencies
1.  After creating the app, scroll down to the "Detected Configuration" section.
2.  Click the **Run NPM Install** button. This will install all the libraries defined in `package.json`.
3.  Once finished, click **Restart Application**.

### 5. Verify
Visit your URL. The game should load, and multiplayer should work.

---

## Option 2: Cloud Hosting (Render, Railway, Heroku) - Recommended

If your current hosting does not support Node.js, it is much easier to use a specialized cloud host. Many have free tiers.

### Deploying to Render.com (Free Tier available)
1.  Push your code to GitHub.
2.  Sign up for Render.com.
3.  Click **New +** and select **Web Service**.
4.  Connect your GitHub repository.
5.  **Build Command:** `npm install`
6.  **Start Command:** `node server.js`
7.  Click **Create Web Service**.

Render will automatically build and deploy your app with a free SSL certificate (HTTPS).

---

## Troubleshooting

### "App Not Starting" or 500 Error
- Check the **Error Log** in cPanel.
- Ensure you clicked "Run NPM Install".
- Ensure `server.js` is set as the startup file.

### "Socket Connection Failed"
- Ensure your site is running on HTTPS if you are accessing it via HTTPS.
- The game automatically tries to connect to the same domain it is hosted on.
