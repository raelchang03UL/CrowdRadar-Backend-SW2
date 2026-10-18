import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAuthRoutes } from "./src/routes/auth.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import sequelize from "./src/config/database.js";
import { assertAuthSchemaReady } from "./src/database/migrateAuth.js";
import { assertRecoverySchemaReady } from "./src/database/migrateRecovery.js";
import { assertPlaceDetailsSchemaReady } from "./src/database/migratePlaceDetails.js";


import { assertReportsSchemaReady } from "./src/database/migrateReports.js";
import placeRoutes from "./src/routes/place.routes.js";
import reportRoutes from "./src/routes/report.routes.js";
import { corsOptions, validateEnvironment } from "./src/config/environment.js";
import { mailConfiguration } from "./src/config/mail.js";
import PasswordRecoveryService from "./src/services/PasswordRecoveryService.js";
import { createSmtpRecoveryDelivery } from "./src/services/RecoveryMailDelivery.js";

dotenv.config();

// Sin SMTP_* devuelve undefined: las rutas usan el servicio sin entrega (503 uniforme).
export function recoveryServiceFromEnvironment(env = process.env, createDelivery = createSmtpRecoveryDelivery) {
    const mail = mailConfiguration(env);
    if (!mail) return undefined;
    return new PasswordRecoveryService({ delivery: createDelivery(mail), resetUrl: mail.resetUrl });
}

export function createApp({ recoveryService } = {}) {
    const app = express();
    app.use(cors(corsOptions()));
    app.use(express.json());
    app.use("/api/auth", createAuthRoutes({ recoveryService }));
    app.use("/api/users", userRoutes);
    app.use("/api/places", placeRoutes);
    app.use("/api/places", reportRoutes);
    app.get("/", (req, res) => {
        res.json({ message: "CrowdRadar API" });
    });
    return app;
}

const app = createApp();

const PORT = process.env.PORT || 3000;

export const startServer = async ({ port = PORT } = {}) => {
    validateEnvironment();
    // Solo el servidor real construye la entrega SMTP; importar app.js (pruebas) nunca envía correo.
    const recoveryService = recoveryServiceFromEnvironment();
    await sequelize.authenticate();
    // Toda creación/cambio de esquema es explícita: npm run db:migrate.
    await assertAuthSchemaReady(sequelize);
    await assertRecoverySchemaReady(sequelize);
    await assertPlaceDetailsSchemaReady(sequelize);

    await assertReportsSchemaReady(sequelize);

    const server = recoveryService ? createApp({ recoveryService }) : app;
    return server.listen(port, () => {
        console.log(`Servidor ejecutándose en el puerto ${port}`);
        console.log(recoveryService ? "Recuperación de contraseña: envío por correo habilitado." : "Recuperación de contraseña: sin correo configurado (503 uniforme).");
    });
};

const currentFile = fileURLToPath(import.meta.url);
const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (path.resolve(currentFile) === executedFile) {
    startServer().catch((error) => {
        console.error(["SCHEMA_NOT_READY", "CONFIG_INVALID"].includes(error.code) ? error.message : "No se pudo iniciar CrowdRadar API. Revisa la configuración local y la conexión PostgreSQL.");
        process.exitCode = 1;
    });
}

export default app;
