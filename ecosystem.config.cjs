// PM2 settings for running the live website on this computer (behind a Cloudflare Tunnel), instead of Vercel.
//   pm2 start ecosystem.config.cjs   — start it in the background
//   pm2 save                         — remember it, so it comes back after a restart
// The live settings (database, secrets…) come from .env.production.local, which is never committed.
// Port 3001 keeps 3000 free for `npm run dev`.

module.exports = {
  apps: [
    {
      name: "joblio",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3001",
      interpreter: "node",
      env: { NODE_ENV: "production" },
      // Restart if it crashes or grows too big; wait a little between restarts.
      autorestart: true,
      max_memory_restart: "1500M",
      restart_delay: 5000,
      time: true,
    },
  ],
};
