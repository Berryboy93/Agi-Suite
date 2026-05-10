module.exports = {
  apps: [
    {
      name: "api",
      cwd: "./apps/api-server",
      script: "../../node_modules/.bin/tsx",
      interpreter: "bash",
      args: "src/index.ts",
      watch: false,
      env: { PORT: 3001 },
      max_restarts: 10,
      restart_delay: 2000,
    },
    {
      name: "ui",
      cwd: "./apps/r3-agi",
      script: "./node_modules/.bin/vite",
      interpreter: "bash",
      args: "--host --strictPort",
      watch: false,
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
};
