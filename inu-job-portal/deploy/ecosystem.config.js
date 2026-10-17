// PM2 process file. Start with:  pm2 start deploy/ecosystem.config.js --env production
module.exports = {
  apps: [
    {
      name: 'inu-recruitment-api',
      cwd: './server',
      script: 'src/server.js',
      instances: 1,            // one process: the expiry job runs inside it
      exec_mode: 'fork',
      max_memory_restart: '400M',
      env_production: { NODE_ENV: 'production' }, // everything else comes from server/.env
      time: true,
    },
  ],
};
