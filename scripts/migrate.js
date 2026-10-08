import sequelize from "../src/config/database.js";
import { migratePlaces } from "../src/database/migratePlaces.js";
import { assertMigrationTarget } from "../src/database/databaseSafety.js";

try {
    assertMigrationTarget(sequelize);
    const applied = await migratePlaces(sequelize);
    console.log(applied ? "001-create-places aplicada." : "001-create-places ya aplicada; sin cambios.");
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await sequelize.close();
}
