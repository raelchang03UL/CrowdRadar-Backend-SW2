// Prepara una base PostgreSQL LOCAL y AISLADA para las pruebas de integración reales
// (Bottom-Up y Big Bang). Nunca toca la base de desarrollo ni ninguna otra:
//   - el nombre de la base es fijo: crowdradar_pruebas_<suite>
//   - solo se admite localhost / 127.0.0.1 / ::1
// Credenciales: archivo .env.test (ignorado por git) o variables de entorno
//   TEST_DB_USER, TEST_DB_PASSWORD, TEST_DB_HOST (opcional), TEST_DB_PORT (opcional)
// Si faltan, las pruebas se marcan como OMITIDAS (skip), nunca como aprobadas.
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.test", quiet: true });

const hostsLocales = ["localhost", "127.0.0.1", "::1"];

export function configuracionPruebas(suite) {
    if (!/^[a-z]+$/.test(suite)) throw new Error("Nombre de suite inválido.");
    const host = process.env.TEST_DB_HOST || "127.0.0.1";
    const user = process.env.TEST_DB_USER;
    const password = process.env.TEST_DB_PASSWORD;
    if (!user || password === undefined) {
        return { omitir: "Define TEST_DB_USER y TEST_DB_PASSWORD en .env.test para usar PostgreSQL real." };
    }
    if (!hostsLocales.includes(host)) throw new Error("Las pruebas de integración solo usan PostgreSQL local.");
    return { host, port: Number(process.env.TEST_DB_PORT || 5432), user, password, database: `crowdradar_pruebas_${suite}` };
}

// Recrea la base aislada y apunta la aplicación a ella. Debe llamarse ANTES de importar
// cualquier módulo que use src/config/database.js (lee DB_* al importarse).
export async function recrearBaseDeDatos(config) {
    const admin = new pg.Client({ host: config.host, port: config.port, user: config.user, password: config.password, database: "postgres" });
    await admin.connect();
    try {
        await admin.query(`DROP DATABASE IF EXISTS "${config.database}" WITH (FORCE)`);
        await admin.query(`CREATE DATABASE "${config.database}"`);
    } finally {
        await admin.end();
    }
    Object.assign(process.env, {
        DB_HOST: config.host, DB_PORT: String(config.port), DB_NAME: config.database,
        DB_USER: config.user, DB_PASSWORD: config.password, DB_SSL: "false",
        JWT_SECRET: "integracion-postgres-secreto-solo-pruebas",
        REPORT_COOLDOWN_MINUTES: "3", KARMA_POINTS_PER_REPORT: "10"
    });
    delete process.env.DATABASE_URL;
}

// Aplica las migraciones reales en el mismo orden que scripts/migrate.js.
export async function migrarEsquema(sequelize) {
    const modulos = [
        ["migratePlaces.js", "migratePlaces"], ["migrateAuth.js", "migrateAuth"],
        ["migrateRecovery.js", "migrateRecovery"], ["migratePlaceDetails.js", "migratePlaceDetails"],
        ["migrateReportCompatibility.js", "migrateReportCompatibility"], ["migrateKarma.js", "migrateKarma"],
        ["migrateValidation.js", "migrateValidation"], ["migrateUserModeration.js", "migrateUserModeration"],
        ["migrateReportModeration.js", "migrateReportModeration"], ["migrateFavorites.js", "migrateFavorites"],
        ["migrateSaturationAlerts.js", "migrateSaturationAlerts"], ["migratePushTargetTypes.js", "migratePushTargetTypes"]
    ];
    for (const [archivo, funcion] of modulos) {
        const modulo = await import(`../../src/database/${archivo}`);
        await modulo[funcion](sequelize);
    }
}

export async function eliminarBaseDeDatos(config) {
    const admin = new pg.Client({ host: config.host, port: config.port, user: config.user, password: config.password, database: "postgres" });
    await admin.connect();
    try {
        await admin.query(`DROP DATABASE IF EXISTS "${config.database}" WITH (FORCE)`);
    } finally {
        await admin.end();
    }
}

export const lugaresDePrueba = [
    { id: 1, nombre: "Plaza de Armas", categoria: "Plaza", referencia: "Centro de Lima", latitud: -12.0464, longitud: -77.0302 },
    { id: 2, nombre: "Parque Kennedy", categoria: "Parque", referencia: "Miraflores", latitud: -12.1211, longitud: -77.0297 },
    { id: 3, nombre: "Mercado Central", categoria: "Mercado", referencia: "Barrios Altos", latitud: -12.0507, longitud: -77.0262 }
];

export async function insertarLugares(sequelize) {
    for (const lugar of lugaresDePrueba) {
        await sequelize.query(`INSERT INTO public.places (id, nombre, categoria, referencia, latitud, longitud, activo, demostrativo)
            VALUES (:id, :nombre, :categoria, :referencia, :latitud, :longitud, TRUE, FALSE)`, { replacements: lugar });
    }
}
