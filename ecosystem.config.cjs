module.exports = {
  apps: [
    {
      name: "api",
      cwd: "./apps/api-server",
      script: "src/index.ts",
      interpreter: "tsx",
      watch: false,
      env: {
        PORT: 3001,
      },
      max_restarts: 10,
      restart_delay: 2000,
    },
    {
      name: "ui",
      cwd: "./apps/r3-agi",
      script: "vite",
      args: "--host --strictPort",
      interpreter: "node",
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
};
