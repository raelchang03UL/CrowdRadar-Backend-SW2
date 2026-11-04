import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { databaseConfiguration } from "./environment.js";
import { demoDatabaseConfiguration, isDemoDeployment } from "./demoSupabaseEnvironment.js";

dotenv.config();

const config = isDemoDeployment() ? demoDatabaseConfiguration() : databaseConfiguration();
const sequelize = config.url
    ? new Sequelize(config.url, config.options)
    : new Sequelize(config.database, config.username, config.password, config.options);

export default sequelize;
