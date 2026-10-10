import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import bcrypt from "bcrypt";
import PasswordRecoveryService, { digest, forgotMessage, resetMessage } from "../src/services/PasswordRecoveryService.js";
import { trustedResetUrl, resetLink } from "../src/config/passwordRecovery.js";
import { migrateRecovery, assertRecoverySchemaReady, recoveryMigration } from "../src/database/migrateRecovery.js";
import { createMemoryRecoveryDelivery } from "./helpers/memoryRecoveryDelivery.js";
import { createApp } from "../app.js";

const currentPassword = "unit-recovery-current";
const newPassword = "unit-recovery-next";
const email = "recovery-unit@example.test";
const resetUrl = "http://localhost:5500/#/reset-password";
const tokenFrom = (url) => new URLSearchParams(new URL(url).hash.split("?")[1]).get("token");

async function fixture() {
    const mailbox = createMemoryRecoveryDelivery();
    const user = { id: 1, email, status: "ACTIVO", sessionVersion: 0, passwordHash: await bcrypt.hash(currentPassword, 4) };
    let queue = Promise.resolve();
    const repository = {
        tokens: [], limits: new Map(), failed: false, failSave: false,
        async consumeLimits(entries) {
            if (this.failed) throw new Error("private-db-info");
            let allowed = true;
            for (const { keyHash, maximum } of entries) {
                const attempts = (this.limits.get(keyHash) || 0) + 1;
                this.limits.set(keyHash, attempts);
                if (attempts > maximum) allowed = false;
            }
            return allowed;
        },
        async issueForEmail(value, tokenHash) {
            if (value !== user.email || user.status !== "ACTIVO") return null;
            this.tokens.forEach((token) => { token.consumed = true; });
            this.tokens.push({ tokenHash, expires: Date.now() + 900000, consumed: false });
            return { email: user.email };
        },
        async validToken(tokenHash) {
            return this.tokens.some((token) => token.tokenHash === tokenHash && !token.consumed && token.expires > Date.now()) && user.status === "ACTIVO";
        },
        async withLockedToken(tokenHash, operation) {
            const previous = queue;
            let release;
            queue = new Promise((resolve) => { release = resolve; });
            await previous;
            const before = { ...user };
            const tokens = structuredClone(this.tokens);
            try { return await operation(await this.validToken(tokenHash) ? user : null, {}); }
            catch (error) { Object.assign(user, before); this.tokens = tokens; throw error; }
            finally { release(); }
        },
        async savePassword(account, passwordHash) {
            Object.assign(account, { passwordHash, sessionVersion: account.sessionVersion + 1 });
            this.tokens.forEach((token) => { token.consumed = true; });
            if (this.failSave) throw new Error("private-save-error");
        }
    };
    const service = new PasswordRecoveryService({ ...mailbox, resetUrl, repository });
    const issue = async () => {
        await service.forgot({ email }, "unit-ip");
        await service.drainDeliveries();
        return tokenFrom(mailbox.messages.filter((message) => message.type === "reset-link").at(-1).resetUrl);
    };
    return { service, repository, user, mailbox, issue };
}

test("recuperación deshabilitada es uniforme y no consulta cuentas ni genera tokens", async () => {
    let calls = 0;
    const service = new PasswordRecoveryService({ resetUrl, repository: { consumeLimits: () => { calls++; }, issueForEmail: () => { calls++; } } });
    for (const value of [email, "unknown@example.test", "malformed"]) {
        const started = performance.now();
        await assert.rejects(service.forgot({ email: value }, "unit-ip"), (error) => error.status === 503 && error.code === "RECOVERY_UNAVAILABLE");
        assert.ok(performance.now() - started >= 180);
    }
    assert.equal(calls, 0);
});

test("solicitud es uniforme, normaliza correo, guarda solo hash y no espera proveedor", async () => {
    const { service, repository, mailbox } = await fixture();
    let unblock;
    service.delivery = { ...mailbox.delivery, sendResetLink: () => new Promise((resolve) => { unblock = resolve; }) };
    const started = performance.now();
    assert.deepEqual(await service.forgot({ email: ` ${email.toUpperCase()} ` }, "unit-ip"), { message: forgotMessage });
    assert.ok(performance.now() - started >= 180);
    assert.equal(repository.tokens.length, 1);
    unblock();
    await service.drainDeliveries();
    assert.deepEqual(await service.forgot({ email: "unknown@example.test" }, "unit-ip"), { message: forgotMessage });
    assert.equal(repository.tokens.length, 1);
});

test("enlace confiable usa query dentro fragmento GoRouter y token aleatorio 32 bytes", async () => {
    const { issue, mailbox, repository } = await fixture();
    const token = await issue();
    assert.ok(/^[0-9a-f]{64}$/.test(token));
    const url = new URL(mailbox.messages[0].resetUrl);
    assert.equal(url.searchParams.has("token"), false);
    assert.ok(url.hash.startsWith("#/reset-password?token="));
    assert.ok(repository.tokens[0].tokenHash === digest(token));
    assert.ok(!JSON.stringify(repository.tokens).includes(token));
});

test("validar no consume ni envía correo; inválido, expirado y usado son indistinguibles", async () => {
    const { service, issue, repository, mailbox } = await fixture();
    const token = await issue();
    assert.deepEqual(await service.validate({ token }, "unit-ip"), { valid: true });
    assert.deepEqual(await service.validate({ token }, "unit-ip"), { valid: true });
    assert.equal(mailbox.messages.length, 1);
    const invalid = (error) => error.status === 400 && error.code === "RESET_TOKEN_INVALID" && error.message === "El enlace no es válido o ha expirado. Solicita uno nuevo.";
    for (const value of [undefined, "invalid", randomBytes(32).toString("hex")]) await assert.rejects(service.validate({ token: value }, "unit-ip"), invalid);
    repository.tokens[0].expires = Date.now() - 1;
    await assert.rejects(service.validate({ token }, "unit-ip"), invalid);
    repository.tokens[0].expires = Date.now() + 900000;
    repository.tokens[0].consumed = true;
    await assert.rejects(service.validate({ token }, "unit-ip"), invalid);
});

test("restablecimiento concurrente tiene un ganador, incrementa versión y notifica sin JWT", async () => {
    const { service, issue, user, mailbox } = await fixture();
    const token = await issue();
    const body = { token, newPassword, confirmPassword: newPassword };
    const results = await Promise.allSettled([service.reset(body, "unit-ip"), service.reset(body, "unit-ip")]);
    assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
    assert.deepEqual(results.find(({ status }) => status === "fulfilled").value, { message: resetMessage });
    assert.equal(results.find(({ status }) => status === "rejected").reason.code, "RESET_TOKEN_INVALID");
    assert.equal(user.sessionVersion, 1);
    assert.equal(await bcrypt.compare(newPassword, user.passwordHash), true);
    await service.drainDeliveries();
    assert.deepEqual(mailbox.messages[1], { type: "password-changed", email });
});

test("nueva solicitud invalida enlace anterior sin cambiar contraseña", async () => {
    const { service, issue, user } = await fixture();
    const before = user.passwordHash;
    const first = await issue();
    const second = await issue();
    assert.ok(first !== second);
    await assert.rejects(service.validate({ token: first }, "unit-ip"), (error) => error.code === "RESET_TOKEN_INVALID");
    assert.deepEqual(await service.validate({ token: second }, "unit-ip"), { valid: true });
    assert.ok(user.passwordHash === before);
});

test("validación de contraseña no consume token; rollback conserva hash/versión/token", async () => {
    const { service, issue, repository, user } = await fixture();
    const token = await issue();
    const before = user.passwordHash;
    for (const body of [{ token, newPassword: "short", confirmPassword: "short" }, { token, newPassword: "é".repeat(37), confirmPassword: "é".repeat(37) },
        { token, newPassword, confirmPassword: "other" }, { token, newPassword: currentPassword, confirmPassword: currentPassword }]) {
        await assert.rejects(service.reset(body, "unit-ip"), (error) => ["PASSWORD_VALIDATION", "PASSWORD_MISMATCH", "PASSWORD_REUSED"].includes(error.code));
        assert.equal(await repository.validToken(digest(token)), true);
    }
    repository.failSave = true;
    await assert.rejects(service.reset({ token, newPassword, confirmPassword: newPassword }, "unit-ip"), (error) => error.code === "SERVICE_UNAVAILABLE" && !error.message.includes("private"));
    assert.ok(user.passwordHash === before);
    assert.equal(user.sessionVersion, 0);
    assert.equal(await repository.validToken(digest(token)), true);
});

test("límites por email normalizado/IP y reset IP rechazan abuso antes de consultar tokens", async () => {
    const { service, repository } = await fixture();
    for (let i = 0; i < 3; i++) await service.forgot({ email }, `unit-ip-${i}`);
    await assert.rejects(service.forgot({ email: email.toUpperCase() }, "unit-ip-other"), (error) => error.status === 429 && error.code === "RATE_LIMITED");
    assert.equal(repository.tokens.length, 3);
    for (let i = 0; i < 30; i++) await assert.rejects(service.validate({ token: "invalid" }, "reset-abuse"), (error) => error.code === "RESET_TOKEN_INVALID");
    await assert.rejects(service.reset({}, "reset-abuse"), (error) => error.code === "RATE_LIMITED");
});

test("límite de solicitud por IP cuenta también cuentas inexistentes", async () => {
    const { service, repository, mailbox } = await fixture();
    for (let i = 0; i < 10; i++) await service.forgot({ email: `unknown-${i}@example.test` }, "shared-request-ip");
    await assert.rejects(service.forgot({ email }, "shared-request-ip"), (error) => error.code === "RATE_LIMITED");
    assert.equal(repository.tokens.length, 0);
    assert.equal(mailbox.messages.length, 0);
});

test("errores DB y proveedor no exponen datos ni existencia de cuenta", async () => {
    const { service, repository } = await fixture();
    service.delivery.sendResetLink = async () => { throw new Error("private-provider-info"); };
    assert.deepEqual(await service.forgot({ email }, "unit-ip"), { message: forgotMessage });
    await service.drainDeliveries();
    repository.failed = true;
    for (const value of [email, "unknown@example.test"]) {
        await assert.rejects(service.forgot({ email: value }, "unit-ip"), (error) => error.code === "SERVICE_UNAVAILABLE" && !error.message.includes("private"));
    }
});

test("URL rechaza hosts HTTP externos, credenciales y producción HTTP, admite HTTPS", () => {
    for (const value of ["http://external.example/reset-password", "https://user:pass@example.test/reset-password", "ftp://example.test/reset-password", "invalid", `${resetUrl}?token=existing`, "https://example.test/#/login", "https://example.test/reset-password?source=other"]) {
        assert.throws(() => trustedResetUrl(value, { NODE_ENV: "development" }));
    }
    assert.throws(() => trustedResetUrl(resetUrl, { NODE_ENV: "production" }));
    assert.equal(trustedResetUrl(resetUrl, { NODE_ENV: "development" }), resetUrl);
    assert.equal(trustedResetUrl("https://example.test/reset-password", { NODE_ENV: "production" }), "https://example.test/reset-password");
    assert.ok(new URL(resetLink("https://example.test/reset-password", "unit-token-placeholder")).searchParams.has("token"));
});

test("HTTP público valida contrato/headers y no deriva enlace o IP de cabeceras no confiables", async () => {
    const { service, mailbox, repository } = await fixture();
    const server = createApp({ recoveryService: service }).listen(0);
    const base = `http://127.0.0.1:${server.address().port}/api/auth/password`;
    try {
        const request = async (path, body) => fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Host: "attacker.example", "X-Forwarded-For": "attacker-ip" }, body: JSON.stringify(body) });
        const forgot = await request("/forgot", { email });
        assert.equal(forgot.status, 202);
        assert.deepEqual(await forgot.json(), { message: forgotMessage });
        assert.equal(forgot.headers.get("cache-control"), "no-store");
        await service.drainDeliveries();
        assert.equal(new URL(mailbox.messages[0].resetUrl).host, "localhost:5500");
        assert.equal(repository.limits.has(digest("forgot-ip:attacker-ip")), false);
        const token = tokenFrom(mailbox.messages[0].resetUrl);
        const validate = await request("/reset/validate", { token });
        assert.equal(validate.status, 200);
        assert.deepEqual(await validate.json(), { valid: true });
        const reset = await request("/reset", { token, newPassword, confirmPassword: newPassword });
        assert.equal(reset.status, 200);
        assert.deepEqual(await reset.json(), { message: resetMessage });
        const reused = await request("/reset/validate", { token });
        assert.equal(reused.status, 400);
        assert.equal((await reused.json()).code, "RESET_TOKEN_INVALID");
    } finally { await new Promise((resolve) => server.close(resolve)); }
});

test("migración003 aditiva e idempotente exige002 y no modifica users", async () => {
    let applied = false;
    const statements = [];
    const transaction = {};
    const connection = {
        transaction: (operation) => operation(transaction),
        query: async (sql, options) => {
            assert.equal(options.transaction, transaction);
            statements.push(sql);
            if (sql.startsWith("SELECT name")) return [{ name: "002-users-session-version" }, ...(applied ? [{ name: recoveryMigration }] : [])];
            if (sql.startsWith("INSERT INTO public.crowdradar_migrations")) applied = true;
            return [];
        }
    };
    assert.equal(await migrateRecovery(connection), true);
    assert.equal(await migrateRecovery(connection), false);
    assert.ok(statements.every((sql) => !/ALTER TABLE public.users|UPDATE public.users|DROP|TRUNCATE|DELETE/i.test(sql)));
    const missing = { transaction: (operation) => operation({}), query: async () => [] };
    await assert.rejects(migrateRecovery(missing), /Aplica 002/);
});

test("arranque recuperación usa solo SELECT y oculta detalles sin migración", async () => {
    const connection = { query: async (sql) => { assert.ok(sql.startsWith("SELECT")); return []; } };
    await assert.rejects(assertRecoverySchemaReady(connection), (error) => error.code === "SCHEMA_NOT_READY" && error.message.includes("npm run db:migrate"));
});
