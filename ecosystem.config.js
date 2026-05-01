module.exports = {
  apps: [
    {
      name: "fink-backend",
      cwd: "./backend",
      script: "dist/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 4002,
        // Add other env vars here or use a .env file
      },
    },
    {
      name: "fink-frontend",
      cwd: "./frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
