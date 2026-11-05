import { Sequelize } from "sequelize";
import pg from "pg";
import dotenv from "dotenv";
import { databaseConfiguration } from "./environment.js";
import { demoDatabaseConfiguration, isDemoDeployment } from "./demoSupabaseEnvironment.js";

dotenv.config();

const config = isDemoDeployment() ? demoDatabaseConfiguration() : databaseConfiguration();
// Make the PostgreSQL driver visible to serverless dependency tracing. Preserve
// the same connection/TLS settings and avoid Sequelize's dynamic require(name).
const options = { ...config.options, dialectModule: pg };
const sequelize = config.url
    ? new Sequelize(config.url, options)
    : new Sequelize(config.database, config.username, config.password, options);

export default sequelize;
