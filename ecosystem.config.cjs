module.exports = {
  apps: [
    {
      name: "chatter",
      cwd: __dirname,
      script: "backend/src/index.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 5001,
      },
      max_memory_restart: "500M",
      time: true,
    },
  ],
};
