import { QueryTypes } from "sequelize";

export const authMigration = "002-users-session-version";

export async function migrateAuth(sequelize) {
    return sequelize.transaction(async (transaction) => {
        const options = { transaction };
        await sequelize.query("SELECT pg_advisory_xact_lock(310031)", options);
        await sequelize.query(`CREATE TABLE IF NOT EXISTS public.crowdradar_migrations (
            name VARCHAR(100) PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, options);
        const applied = await sequelize.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name = :name",
            { ...options, replacements: { name: authMigration }, type: QueryTypes.SELECT }
        );
        if (applied.length) return false;
        const columns = await sequelize.query(`SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'users'`, { ...options, type: QueryTypes.SELECT });
        if (!columns.length) {
            await sequelize.query(`CREATE TABLE public.users (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                apellido VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                "passwordHash" VARCHAR(255) NOT NULL,
                telefono VARCHAR(255), rol VARCHAR(255), distrito VARCHAR(255), status VARCHAR(255),
                "createdAt" TIMESTAMPTZ NOT NULL,
                "updatedAt" TIMESTAMPTZ NOT NULL
            )`, options);
        } else {
            const names = new Set(columns.map(({ column_name }) => column_name));
            const required = ["id", "nombre", "apellido", "email", "passwordHash", "telefono", "rol", "distrito", "status", "createdAt", "updatedAt"];
            if (required.some((name) => !names.has(name)) || names.has("sessionVersion")) {
                throw new Error("Esquema users no reconocido para 002; revisar su origen sin borrar datos.");
            }
        }
        await sequelize.query(`ALTER TABLE public.users ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0
            CONSTRAINT users_session_version_nonnegative CHECK ("sessionVersion" >= 0)`, options);
        await sequelize.query("INSERT INTO public.crowdradar_migrations (name) VALUES (:name)",
            { ...options, replacements: { name: authMigration } });
        return true;
    });
}

export async function assertAuthSchemaReady(sequelize) {
    try {
        const applied = await sequelize.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name = :name",
            { replacements: { name: authMigration }, type: QueryTypes.SELECT }
        );
        if (!applied.length) throw new Error("missing");
        await sequelize.query('SELECT "sessionVersion" FROM public.users LIMIT 0');
    } catch {
        const error = new Error("Falta el esquema de autenticación. Ejecuta npm run db:migrate antes de iniciar.");
        error.code = "SCHEMA_NOT_READY";
        throw error;
    }
}
