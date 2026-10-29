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
import placeRoutes from "./src/routes/place.routes.js";
import { createNotificationRoutes } from "./src/routes/notification.routes.js";
import { createInternalRoutes } from "./src/routes/internal.routes.js";
import { corsOptions, validateEnvironment } from "./src/config/environment.js";
import PushNotificationService from "./src/services/PushNotificationService.js";
import { startPushOutboxWorker } from "./src/services/PushOutboxWorker.js";
import { assertSaturationAlertsSchemaReady } from "./src/database/migrateSaturationAlerts.js";

dotenv.config();

export function createApp({
    recoveryService,
    pushNotificationService = PushNotificationService,
    saturationEventSecret = process.env.SATURATION_EVENT_SECRET
} = {}) {
    const app = express();
    app.use(cors(corsOptions()));
    app.use(express.json());
    app.use("/api/auth", createAuthRoutes({ recoveryService }));
    app.use("/api/users", userRoutes);
    app.use("/api/places", placeRoutes);
    app.use("/api/notifications", createNotificationRoutes(pushNotificationService));
    app.use("/api/internal", createInternalRoutes(pushNotificationService, { secret: saturationEventSecret }));
    app.get("/", (req, res) => {
        res.json({ message: "CrowdRadar API" });
    });
    return app;
}

const app = createApp();

const PORT = process.env.PORT || 3000;

export const startServer = async ({ port = PORT } = {}) => {
    validateEnvironment();
    await sequelize.authenticate();
    // Toda creación/cambio de esquema es explícita: npm run db:migrate.
    await assertAuthSchemaReady(sequelize);
    await assertRecoverySchemaReady(sequelize);
    await assertSaturationAlertsSchemaReady(sequelize);

    const server = app.listen(port, () => {
        console.log(`Servidor ejecutándose en el puerto ${port}`);
    });
    const stopWorker = startPushOutboxWorker();
    server.once("close", stopWorker);
    return server;
};

const currentFile = fileURLToPath(import.meta.url);
const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (path.resolve(currentFile) === executedFile) {
    startServer().catch((error) => {
        console.error(error.code === "SCHEMA_NOT_READY" ? error.message : "No se pudo iniciar CrowdRadar API. Revisa la configuración local y la conexión PostgreSQL.");
        process.exitCode = 1;
    });
}

export default app;
