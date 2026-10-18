import { Sequelize } from "sequelize";
import { databaseConfiguration, validateEnvironment } from "./environment.js";

// La CLI puede usar un rol DDL distinto. La API nunca lee MIGRATION_DATABASE_URL.
export function migrationConfiguration(env = process.env) {
    const selected = { ...env, DATABASE_URL: env.MIGRATION_DATABASE_URL || env.DATABASE_URL };
    validateEnvironment(selected);
    const config = databaseConfiguration(selected);
    config.options.pool = { max: 1, min: 0, idle: 1000, acquire: 10000 };
    return config;
}

export function createMigrationConnection(env = process.env) {
    const config = migrationConfiguration(env);
    return config.url ? new Sequelize(config.url, config.options)
        : new Sequelize(config.database, config.username, config.password, config.options);
}
