import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRoutes from "./src/routes/auth.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import sequelize from "./src/config/database.js";

dotenv.config();

const app = express();

app.use(cors());

app.use(express.json());

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "CrowdRadar API"
    });
});

const PORT = process.env.PORT || 3000;

const validateEnvironment = () => {
    const requiredVariables = [
        "DB_NAME",
        "DB_USER",
        "DB_PASSWORD",
        "DB_HOST",
        "JWT_SECRET"
    ];

    const missingVariables = requiredVariables.filter(
        (variable) => process.env[variable] === undefined
    );

    if (missingVariables.length > 0) {
        throw new Error(
            `Faltan variables de entorno requeridas: ${missingVariables.join(", ")}. ` +
            "Copia .env.example como .env y completa los valores."
        );
    }
};

export const startServer = async ({ port = PORT } = {}) => {
    validateEnvironment();
    await sequelize.sync();

    return app.listen(port, () => {
        console.log(`Servidor ejecutándose en el puerto ${port}`);
    });
};

const currentFile = fileURLToPath(import.meta.url);
const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (path.resolve(currentFile) === executedFile) {
    startServer().catch((error) => {
        console.error(`No se pudo iniciar CrowdRadar API: ${error.message}`);
        process.exitCode = 1;
    });
}

export default app;
