import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { ensureDemoUser } from "../src/database/seedDemoUser.js";
import UserRepository from "../src/repositories/UserRepository.js";

const local = { config: { host: "localhost", database: "crowdradar_dev" } };

test("demo sin email/contraseña válidos falla antes de consultar DB", async () => {
    const original = UserRepository.findByEmail;
    UserRepository.findByEmail = () => assert.fail("No debe consultar DB");
    try {
        for (const input of [{}, { email: "rael@example.test", password: "" }, { email: "incorrecto", password: randomBytes(12).toString("hex") }, { email: "rael@example.test", password: "        " }, { email: "rael@example.test", password: "x".repeat(73) }]) {
            await assert.rejects(ensureDemoUser(local, input), /Define DEMO_USER/);
        }
    } finally { UserRepository.findByEmail = original; }
});

test("demo rechaza remoto, Supabase y entrega incluso con credenciales presentes", async () => {
    for (const config of [
        { host: "localhost", database: "crowdradar_sprint1" },
        { host: "db.remote.example", database: "crowdradar_dev" },
        { host: "db.project.supabase.co", database: "crowdradar_dev" }
    ]) await assert.rejects(ensureDemoUser({ config }, { email: "rael@example.test", password: randomBytes(16).toString("hex") }), /solo admite/);
});

test("demo usa registro real con bcrypt, repite sin cambios y no sobrescribe cuentas", async () => {
    const original = { findByEmail: UserRepository.findByEmail, create: UserRepository.create };
    const input = { email: "rael@example.test", password: randomBytes(16).toString("hex") };
    let stored;
    let creations = 0;
    UserRepository.findByEmail = async () => stored;
    UserRepository.create = async ({ password, ...data }) => { creations++; stored = { id: 1, ...data }; return stored; };
    try {
        assert.deepEqual(await ensureDemoUser(local, input), { created: true });
        assert.equal(stored.nombre, "Rael");
        assert.equal(stored.apellido, "Chang");
        assert.equal(stored.rol, "USUARIO");
        assert.equal(stored.status, "ACTIVO");
        assert.notEqual(stored.passwordHash, input.password);
        assert.equal(await bcrypt.compare(input.password, stored.passwordHash), true);
        const before = { ...stored };
        assert.deepEqual(await ensureDemoUser(local, input), { created: false });
        await assert.rejects(ensureDemoUser(local, { ...input, password: randomBytes(16).toString("hex") }), /no se modificó/);
        stored.nombre = "Otro usuario";
        await assert.rejects(ensureDemoUser(local, input), /no se modificó/);
        stored.nombre = before.nombre;
        assert.deepEqual(stored, before);
        assert.equal(creations, 1);
    } finally { Object.assign(UserRepository, original); }
});
