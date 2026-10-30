export function databaseConfiguration(env = process.env) {
    const integer = (key, fallback, min, max) => {
        const value = env[key] === undefined ? fallback : Number(env[key]);
        if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} fuera del rango permitido.`);
        return value;
    };
    const maximum = integer("DB_POOL_MAX", 5, 1, 20);
    const minimum = integer("DB_POOL_MIN", 0, 0, maximum);
    const options = { dialect: "postgres", logging: false, pool: {
        max: maximum, min: minimum, idle: integer("DB_POOL_IDLE_MS", 10000, 1000, 60000),
        acquire: integer("DB_POOL_ACQUIRE_MS", 10000, 1000, 60000)
    } };
    if (env.DB_SSL === "true") {
        options.dialectOptions = { ssl: { rejectUnauthorized: true } };
        if (env.DB_SSL_CA) options.dialectOptions.ssl.ca = env.DB_SSL_CA.replace(/\\n/g, "\n");
    }
    if (env.DATABASE_URL) return { url: env.DATABASE_URL, options };
    return {
        database: env.DB_NAME,
        username: env.DB_USER,
        password: env.DB_PASSWORD ?? "",
        options: { ...options, host: env.DB_HOST, port: Number.parseInt(env.DB_PORT ?? "5432", 10) }
    };
}

export function reportCooldownMinutes(env = process.env) {
    const value = env.REPORT_COOLDOWN_MINUTES ?? "3";
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 1) {
        throw new Error("REPORT_COOLDOWN_MINUTES debe ser un entero mayor que cero.");
    }
    return minutes;
}

export function karmaPointsPerReport(env = process.env) {
    const value = env.KARMA_POINTS_PER_REPORT ?? "10";
    const points = Number(value);
    if (!Number.isSafeInteger(points) || points < 0) {
        throw new Error("KARMA_POINTS_PER_REPORT debe ser un entero mayor o igual que cero.");
    }
    return points;
}

export function validateEnvironment(env = process.env) {
    const required = env.DATABASE_URL ? ["JWT_SECRET"] : ["DB_NAME", "DB_USER", "DB_PASSWORD", "DB_HOST", "JWT_SECRET"];
    const missing = required.filter((name) => env[name] === undefined || (name !== "DB_PASSWORD" && !env[name].trim()));
    if (missing.length) throw new Error(`Faltan variables de entorno requeridas: ${missing.join(", ")}. Copia .env.example como .env y completa los valores.`);
    if (env.DB_SSL && !["true", "false"].includes(env.DB_SSL)) throw new Error("DB_SSL debe ser true o false.");
    reportCooldownMinutes(env);
    karmaPointsPerReport(env);
    if (env.SATURATION_EVENT_SECRET && env.SATURATION_EVENT_SECRET.length < 32) {
        throw new Error("SATURATION_EVENT_SECRET debe tener al menos 32 caracteres.");
    }
    if (env.FCM_PROJECT_ID && !/^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]$/.test(env.FCM_PROJECT_ID)) {
        throw new Error("FCM_PROJECT_ID no es válido.");
    }

    if (env.DATABASE_URL) {
        let url;
        try { url = new URL(env.DATABASE_URL); } catch { throw new Error("DATABASE_URL no es una URL PostgreSQL válida."); }
        if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length < 2) throw new Error("DATABASE_URL no es una URL PostgreSQL válida.");
        if (url.searchParams.has("sslmode") || url.searchParams.has("ssl")) throw new Error("Configura TLS con DB_SSL/DB_SSL_CA, no con sslmode/ssl en DATABASE_URL.");
    }
}

export function corsOptions(env = process.env) {
    const origins = (env.CORS_ORIGINS ?? "http://localhost:5500,http://127.0.0.1:5500,http://[::1]:5500")
        .split(",").map((value) => value.trim()).filter(Boolean);
    if (origins.includes("*")) throw new Error("CORS_ORIGINS requiere orígenes explícitos, no *.");
    for (const value of origins) {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol) || url.origin !== value) throw new Error("CORS_ORIGINS requiere orígenes HTTP(S) sin ruta.");
    }
    return {
        // Apps Android/CLI no envían Origin. Esto NO sustituye la validación JWT.
        origin: (origin, callback) => callback(null, !origin || origins.includes(origin)),
        credentials: false,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
    };
}
