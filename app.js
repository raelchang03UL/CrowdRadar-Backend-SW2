import { assertFavoritesSchemaReady } from "./src/database/migrateFavorites.js";
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


import { assertConsolidatedReportsSchemaReady } from "./src/database/migrateReportCompatibility.js";
import { assertKarmaSchemaReady } from "./src/database/migrateKarma.js";
import { assertValidationSchemaReady } from "./src/database/migrateValidation.js";
import validationRoutes from "./src/routes/validation.routes.js";
import historyRoutes from "./src/routes/history.routes.js";
import placeRoutes from "./src/routes/place.routes.js";
import reportRoutes from "./src/routes/report.routes.js";
import adminRoutes from "./src/routes/admin.routes.js";
import { assertUserModerationSchemaReady } from "./src/database/migrateUserModeration.js";
import { assertReportModerationSchemaReady } from "./src/database/migrateReportModeration.js";
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
    app.use(express.json({ limit: "32kb" }));
    app.use("/api/auth", createAuthRoutes({ recoveryService }));
    app.use("/api/users", userRoutes);
    app.use("/api/places", placeRoutes);
    app.use("/api/places", reportRoutes);
    app.use("/api/places", historyRoutes);
    app.use("/api/reports", validationRoutes);
    app.use("/api/admin", adminRoutes);
    app.get("/", (req, res) => {
        res.json({ message: "CrowdRadar API" });
    });
    app.use((error,req,res,next) => {
        if(res.headersSent) return next(error);
        const status=error.type==='entity.too.large'?413:error.type==='entity.parse.failed'?400:503;
        res.status(status).json({code:status===413?'BODY_TOO_LARGE':status===400?'INVALID_JSON':'SERVICE_UNAVAILABLE',message:status===413?'La solicitud es demasiado grande.':status===400?'El JSON enviado no es válido.':'No se pudo completar la solicitud.'});
    });
    return app;
}

const app = createApp();

const PORT = process.env.PORT || 3000;

export const startServer = async ({ port = PORT, host } = {}) => {
    validateEnvironment();
    // Solo el servidor real construye la entrega SMTP; importar app.js (pruebas) nunca envía correo.
    const recoveryService = recoveryServiceFromEnvironment();
    await sequelize.authenticate();
    // Toda creación/cambio de esquema es explícita: npm run db:migrate.
    await assertAuthSchemaReady(sequelize);
    await assertRecoverySchemaReady(sequelize);
    await assertPlaceDetailsSchemaReady(sequelize);

    await assertConsolidatedReportsSchemaReady(sequelize);
    await assertKarmaSchemaReady(sequelize);
    await assertValidationSchemaReady(sequelize);
    await assertUserModerationSchemaReady(sequelize);
    await assertReportModerationSchemaReady(sequelize);
    await assertFavoritesSchemaReady(sequelize);

    const server = recoveryService ? createApp({ recoveryService }) : app;
    return server.listen(port, host, () => {
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
