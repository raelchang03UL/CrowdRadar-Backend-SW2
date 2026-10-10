import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRoutes from "./src/routes/auth.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import sequelize from "./src/config/database.js";
import { assertAuthSchemaReady } from "./src/database/migrateAuth.js";
import placeRoutes from "./src/routes/place.routes.js";
import { corsOptions, validateEnvironment } from "./src/config/environment.js";

dotenv.config();

const app = express();

app.use(cors(corsOptions()));

app.use(express.json());

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);
app.use("/api/places", placeRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "CrowdRadar API"
    });
});

const PORT = process.env.PORT || 3000;

export const startServer = async ({ port = PORT } = {}) => {
    validateEnvironment();
    await sequelize.authenticate();
    // Toda creación/cambio de esquema es explícita: npm run db:migrate.
    await assertAuthSchemaReady(sequelize);

    return app.listen(port, () => {
        console.log(`Servidor ejecutándose en el puerto ${port}`);
    });
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
