import sequelize from "../src/config/database.js";
import { migratePlaces } from "../src/database/migratePlaces.js";
import { migrateAuth, authMigration } from "../src/database/migrateAuth.js";
import { migrateRecovery, recoveryMigration } from "../src/database/migrateRecovery.js";
import { migrateReports, reportsMigration } from "../src/database/migrateReports.js";
import { assertMigrationTarget } from "../src/database/databaseSafety.js";

try {
    assertMigrationTarget(sequelize);
    const applied = await migratePlaces(sequelize);
    console.log(applied ? "001-create-places aplicada." : "001-create-places ya aplicada; sin cambios.");
    const authApplied = await migrateAuth(sequelize);
    console.log(authApplied ? `${authMigration} aplicada.` : `${authMigration} ya aplicada; sin cambios.`);
    const recoveryApplied = await migrateRecovery(sequelize);
    console.log(recoveryApplied ? `${recoveryMigration} aplicada.` : `${recoveryMigration} ya aplicada; sin cambios.`);
    const reportsApplied = await migrateReports(sequelize);
    console.log(reportsApplied ? `${reportsMigration} aplicada.` : `${reportsMigration} ya aplicada; sin cambios.`);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await sequelize.close();
}
