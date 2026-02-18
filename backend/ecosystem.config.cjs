module.exports = {
    apps: [
        {
            name: "cozycrowns-backend",
            script: "npm",
            args: "start",
            cwd: "/opt/cozycrowns/backend",
            instances: 1,
            exec_mode: "fork",
            env: {
                NODE_ENV: "production",
                PORT: 3001,
                HOST: "localhost",
            },
            error_file: "/var/log/cozycrowns-backend/error.log",
            out_file: "/var/log/cozycrowns-backend/out.log",
            log_file: "/var/log/cozycrowns-backend/combined.log",
            time: true,
            autorestart: true,
            max_restarts: 10,
            min_uptime: "10s",
            max_memory_restart: "500M",
        },
    ],
}
