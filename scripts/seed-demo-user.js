import sequelize from "../src/config/database.js";
import { ensureDemoUser } from "../src/database/seedDemoUser.js";

try {
    const { created } = await ensureDemoUser(sequelize, {
        email: process.env.DEMO_USER_EMAIL,
        password: process.env.DEMO_USER_PASSWORD
    });
    console.log(created ? "Usuario demo Rael Chang creado." : "Usuario demo Rael Chang verificado; sin cambios.");
} catch (error) {
    // No imprimir errores SQL: podrían contener parámetros sensibles.
    console.error(error.name.startsWith("Sequelize") ? "No se pudo preparar el usuario demo; revisa la conexión/esquema local." : error.message);
    process.exitCode = 1;
} finally {
    await sequelize.close();
}
