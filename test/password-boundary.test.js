import test from "node:test";
import assert from "node:assert/strict";
import AuthService from "../src/services/AuthService.js";
import UserRepository from "../src/repositories/UserRepository.js";

test("registro rechaza contraseña vacía/corta y límite bcrypt UTF-8 antes de consultar DB", async () => {
    const original = UserRepository.findByEmail;
    UserRepository.findByEmail = () => assert.fail("No debe consultar DB");
    try {
        for (const password of [undefined, "", "corta", "        ", "é".repeat(37)]) {
            await assert.rejects(AuthService.register({ password }), /al menos 8 caracteres y no superar 72 bytes/);
        }
    } finally { UserRepository.findByEmail = original; }
});
