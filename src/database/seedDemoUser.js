import Ajv from "ajv";
import addFormats from "ajv-formats";
import bcrypt from "bcrypt";
import AuthService from "../services/AuthService.js";
import UserRepository from "../repositories/UserRepository.js";
import { registerSchema } from "../validations/authSchemas.js";
import { assertLocalDevelopmentDatabase } from "./databaseSafety.js";

const ajv = new Ajv();
addFormats(ajv);
const validateRegistration = ajv.compile(registerSchema);

export async function ensureDemoUser(connection, { email, password } = {}) {
    // Debe fallar antes de consultar usuarios o conectar a un destino protegido.
    assertLocalDevelopmentDatabase(connection);
    const data = { nombre: "Rael", apellido: "Chang", email: email?.trim(), password };
    if (!validateRegistration(data) || !password.trim() || Buffer.byteLength(password, "utf8") > 72) {
        throw new Error("Define DEMO_USER_EMAIL válido y DEMO_USER_PASSWORD de 8 a 72 bytes, no vacío. No hay credenciales predeterminadas.");
    }
    const existing = await UserRepository.findByEmail(data.email);
    if (existing) {
        if (existing.nombre !== data.nombre || existing.apellido !== data.apellido ||
            existing.rol !== "USUARIO" || existing.status !== "ACTIVO" ||
            !await bcrypt.compare(password, existing.passwordHash)) {
            throw new Error("El correo ya pertenece a otra cuenta o la contraseña no coincide; no se modificó el usuario.");
        }
        return { created: false };
    }
    // Mismo flujo de registro y bcrypt que POST /api/auth/register.
    await AuthService.register(data);
    return { created: true };
}
