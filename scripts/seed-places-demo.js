import sequelize from "../src/config/database.js";
import { seedPlacesDemo } from "../src/database/seedPlacesDemo.js";

try {
    await seedPlacesDemo(sequelize);
    console.log("3 lugares DEMOSTRATIVOS disponibles. No representan monitoreo real.");
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await sequelize.close();
}
