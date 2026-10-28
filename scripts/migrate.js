import dotenv from "dotenv";
import { createMigrationConnection } from "../src/config/migrationConnection.js";
import { migratePlaces } from "../src/database/migratePlaces.js";
import { migrateAuth, authMigration } from "../src/database/migrateAuth.js";
import { migrateRecovery, recoveryMigration } from "../src/database/migrateRecovery.js";
import { migrateReportCompatibility, reportCompatibilityMigration } from "../src/database/migrateReportCompatibility.js";
import { migrateKarma, karmaMigration } from "../src/database/migrateKarma.js";
import { migrateValidation, validationMigration } from "../src/database/migrateValidation.js";
import { assertMigrationTarget } from "../src/database/databaseSafety.js";
import { migratePlaceDetails, placeDetailsMigration } from "../src/database/migratePlaceDetails.js";

dotenv.config();
let sequelize;
try {
    sequelize = createMigrationConnection();
    assertMigrationTarget(sequelize);
    const applied = await migratePlaces(sequelize);
    console.log(applied ? "001-create-places aplicada." : "001-create-places ya aplicada; sin cambios.");
    const authApplied = await migrateAuth(sequelize);
    console.log(authApplied ? `${authMigration} aplicada.` : `${authMigration} ya aplicada; sin cambios.`);
    const recoveryApplied = await migrateRecovery(sequelize);
    console.log(recoveryApplied ? `${recoveryMigration} aplicada.` : `${recoveryMigration} ya aplicada; sin cambios.`);
    const detailsApplied = await migratePlaceDetails(sequelize);
    console.log(detailsApplied ? `${placeDetailsMigration} aplicada.` : `${placeDetailsMigration} ya aplicada; sin cambios.`);

    const reportsApplied = await migrateReportCompatibility(sequelize);
    console.log(`${reportCompatibilityMigration}: ${reportsApplied ? 'aplicada' : 'sin cambios'}.`);
    const karmaApplied = await migrateKarma(sequelize);
    console.log(`${karmaMigration}: ${karmaApplied ? 'aplicada' : 'sin cambios'}.`);
    console.log(`${validationMigration}: ${await migrateValidation(sequelize) ? 'aplicada' : 'sin cambios'}.`);
} catch (error) {
    console.error("No se completaron las migraciones. Revisa configuración, permisos y destino autorizado; no se muestran SQL ni credenciales.");
    process.exitCode = 1;
} finally {
    if (sequelize) await sequelize.close();
}
