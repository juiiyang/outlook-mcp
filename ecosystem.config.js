module.exports = {
  apps: [{
    name: 'outlook-auth-server',
    script: './outlook-auth-server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3333,
      MS_CLIENT_ID: process.env.MS_CLIENT_ID,
      MS_CLIENT_SECRET: process.env.MS_CLIENT_SECRET
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3333,
      MS_CLIENT_ID: process.env.MS_CLIENT_ID,
      MS_CLIENT_SECRET: process.env.MS_CLIENT_SECRET
    },
    log_file: './logs/outlook-auth-server.log',
    error_file: './logs/outlook-auth-server-error.log',
    out_file: './logs/outlook-auth-server-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};