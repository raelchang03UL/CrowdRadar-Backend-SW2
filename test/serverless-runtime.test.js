import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { createServerlessHandler } from "../src/runtime/serverlessHandler.js";
import { validateDeploymentEnvironment } from "../src/config/deployment.js";
import { createApp, initializeApplication, recoveryServiceFromEnvironment } from "../app.js";
import PasswordRecoveryService from "../src/services/PasswordRecoveryService.js";
import { createPublicAbuseMiddleware } from "../src/middlewares/publicAbuse.js";

const env = {
    NODE_ENV: "production", DATABASE_URL: "postgresql://app@database.example/demo",
    JWT_SECRET: "synthetic-runtime-secret-at-least-32-characters", DB_SSL: "true",
    CORS_ORIGINS: "https://web.example", PUSH_WORKER_ENABLED: "false"
};
const readyDatabase = () => ({
    authenticate: async () => {},
    query: async (sql, options = {}) => {
        assert.match(sql, /^SELECT /);
        return [{ name: options.replacements?.name ?? "002-users-session-version" },
            { name: "004-saturation-reports" }, { name: "005-reconcile-report-schema" },
            { name: "006-report-karma-ledger" }, { name: "007-report-validation" }];
    }
});
async function serve(context, handler) {
    const server = createServer(handler);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    context.after(() => new Promise(resolve => server.close(resolve)));
    return `http://127.0.0.1:${server.address().port}`;
}

test("importar entrypoint no valida configuración ni conecta ni inicia worker", () => {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", "await import('./api/index.js'); process.stdout.write('inert');"], {
        cwd: new URL("..", import.meta.url), encoding: "utf8", timeout: 5000,
        env: { ...process.env, DATABASE_URL: "not-a-database-url", CORS_ORIGINS: "*", PUSH_WORKER_ENABLED: "true" }
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "inert");
});

test("arranque frío concurrente y caliente comparten una sola inicialización", async context => {
    let release;
    let markStarted;
    const started = new Promise(resolve => { markStarted = resolve; });
    const barrier = new Promise(resolve => { release = resolve; });
    let calls = 0;
    let handled = 0;
    const handler = createServerlessHandler({ initialize: async () => {
        calls++;
        markStarted();
        await barrier;
        return (req, res) => { handled++; res.end("ready"); };
    } });
    const url = await serve(context, handler);
    const requests = Array.from({ length: 8 }, () => fetch(url));
    await started;
    assert.equal(handled, 0);
    release();
    const responses = await Promise.all(requests);
    assert.ok(responses.every(response => response.status === 200));
    assert.equal(calls, 1);
    assert.equal(await (await fetch(url)).text(), "ready");
    assert.equal(calls, 1);
});

test("fallo inicial responde503 uniforme sin secretos y reintenta una sola vez tras espera", async context => {
    let clock = 0;
    let calls = 0;
    let logs = 0;
    const handler = createServerlessHandler({ now: () => clock, log: () => { logs++; }, initialize: async () => {
        if (++calls === 1) throw new Error("postgresql://private:password@host/db");
        return (req, res) => res.end("ready");
    } });
    const url = await serve(context, handler);
    for (const response of await Promise.all([fetch(url), fetch(url), fetch(url)])) {
        assert.equal(response.status, 503);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(response.headers.get("retry-after"), "5");
        assert.doesNotMatch(await response.text(), /private|password|postgresql|host/);
    }
    assert.equal(calls, 1);
    assert.equal(logs, 1);
    clock = 5000;
    assert.ok((await Promise.all([fetch(url), fetch(url)])).every(response => response.status === 200));
    assert.equal(calls, 2);
});

test("despliegue rechaza configuración local, CORS no HTTPS, secreto débil y worker", () => {
    assert.doesNotThrow(() => validateDeploymentEnvironment(env));
    for (const patch of [
        { NODE_ENV: "development" }, { CORS_ORIGINS: "" }, { CORS_ORIGINS: "*" },
        { CORS_ORIGINS: "http://web.example" }, { CORS_ORIGINS: "https://web.example/path" },
        { CORS_ORIGINS: "https://localhost" }, { JWT_SECRET: "short" },
        { PUSH_WORKER_ENABLED: "true" }, { PUSH_WORKER_ENABLED: undefined },
        { SMTP_HOST: "smtp.example" }
    ]) assert.throws(() => validateDeploymentEnvironment({ ...env, ...patch }), { code: "CONFIG_INVALID" });
});

test("SMTP requiere reset HTTPS del mismo frontend y conserva adaptador", () => {
    const mailEnv = { ...env, SMTP_HOST: "smtp.example", SMTP_PORT: "587", SMTP_USER: "qa@example.test",
        SMTP_PASSWORD: "synthetic", MAIL_FROM: "qa@example.test", PASSWORD_RESET_URL: "https://web.example/#/reset-password" };
    assert.doesNotThrow(() => validateDeploymentEnvironment(mailEnv));
    assert.throws(() => validateDeploymentEnvironment({ ...mailEnv, PASSWORD_RESET_URL: "https://other.example/reset-password" }), { code: "CONFIG_INVALID" });
    const adapter = { sendResetLink: async () => {}, sendPasswordChangedNotification: async () => {} };
    const pending = [];
    const service = recoveryServiceFromEnvironment(mailEnv, () => adapter, { deferDelivery: promise => pending.push(promise) });
    assert.equal(service.delivery, adapter);
    service.queueDelivery(async () => {});
    assert.equal(pending.length, 1);
    return Promise.all(pending);
});

test("lifecycle SMTP registra cada promesa y consume rechazo sin esperar otra petición", async () => {
    const pending = [];
    let release;
    const barrier = new Promise(resolve => { release = resolve; });
    const service = new PasswordRecoveryService({ deferDelivery: promise => pending.push(promise) });
    service.queueDelivery(() => barrier);
    service.queueDelivery(async () => { throw new Error("synthetic SMTP failure"); });
    assert.equal(pending.length, 2);
    await pending[1];
    assert.equal(service.pendingDeliveries.size, 1);
    release();
    await pending[0];
    assert.equal(service.pendingDeliveries.size, 0);
});

test("inicialización revisa esquema por SELECT sin DDL y readiness detecta caída/reconexión", async context => {
    let connected = true;
    let identityChecks = 0;
    const database = readyDatabase();
    database.authenticate = async () => { if (!connected) throw new Error("private DB details"); };
    const { app } = await initializeApplication({ env, database, assertDatabaseReady: async connection => {
        assert.equal(connection, database);
        identityChecks++;
    } });
    assert.equal(identityChecks, 1);
    const url = await serve(context, app);
    assert.deepEqual(await (await fetch(`${url}/health/ready`)).json(), { ready: true });
    connected = false;
    const failure = await fetch(`${url}/health/ready`);
    assert.equal(failure.status, 503);
    assert.equal(failure.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await failure.text(), /private|details/);
    connected = true;
    assert.equal((await fetch(`${url}/health/ready`)).status, 200);
    assert.equal(identityChecks, 3);
    database.query = async () => [];
    const missingSchema = await fetch(`${url}/health/ready`);
    assert.equal(missingSchema.status, 503);
    assert.equal((await missingSchema.json()).code, "SERVICE_UNAVAILABLE");
});

test("esquema ausente o identidad DB rechazada impiden publicar app", async () => {
    const database = readyDatabase();
    database.query = async () => [];
    await assert.rejects(initializeApplication({ env, database }), { code: "SCHEMA_NOT_READY" });
    await assert.rejects(initializeApplication({ env, database: readyDatabase(), assertDatabaseReady: async () => {
        throw Object.assign(new Error("not allowed"), { code: "DB_IDENTITY_INVALID" });
    } }), { code: "DB_IDENTITY_INVALID" });
});

test("CORS HTTPS exacto conserva preflight, JWT y rechazo de origen parecido", async context => {
    const url = await serve(context, createApp({ env }));
    const preflight = await fetch(`${url}/api/places`, { method: "OPTIONS", headers: {
        Origin: "https://web.example", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization,content-type"
    } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "https://web.example");
    assert.equal((await fetch(`${url}/api/places`, { headers: { Origin: "https://web.example" } })).status, 401);
    const wrongOrigin = await fetch(`${url}/api/places`, { headers: { Origin: "https://web.example.attacker.test" } });
    assert.equal(wrongOrigin.status, 401);
    assert.equal(wrongOrigin.headers.get("access-control-allow-origin"), null);
});

test("la app monta el límite antes de login y entrega IP verificada a recuperación", async context => {
    let recoveryCalls = 0;
    const url = await serve(context, createApp({ env,
        publicAbuseMiddleware: createPublicAbuseMiddleware({ repository: { consumeLimits: async () => false } }),
        recoveryService: { forgot: async (body, ip) => {
            recoveryCalls++;
            assert.equal(ip, "203.0.113.5");
            return { message: "uniforme" };
        } }
    }));
    const headers = { "x-vercel-forwarded-for": "203.0.113.5", "x-forwarded-for": "203.0.113.99", "Content-Type": "application/json" };
    assert.equal((await fetch(`${url}/api/auth/login`, { method: "POST", headers, body: "{}" })).status, 429);
    assert.equal((await fetch(`${url}/api/auth/password/forgot`, { method: "POST", headers, body: "{}" })).status, 202);
    assert.equal((await fetch(`${url}/api/auth/password/forgot`, { method: "POST", body: "{}" })).status, 503);
    assert.equal(recoveryCalls, 1);
});

test("endpoint de ejecución push conserva secreto, cuerpo vacío y servicio original inyectable", async context => {
    const calls = [];
    const pushNotificationService = {
        reconcileAll: async () => { calls.push("reconcile"); return { evaluated: 2 }; },
        dispatchPending: async () => { calls.push("dispatch"); return { configured: true, sent: 1 }; }
    };
    const secret = "synthetic-internal-secret-with-32-characters";
    const url = await serve(context, createApp({ env, pushNotificationService, saturationEventSecret: secret,
        maintenance: async () => { calls.push("maintenance"); } }));
    const invoke = headers => fetch(`${url}/api/internal/push/process`, { method: "POST", headers });
    assert.equal((await invoke({})).status, 401);
    assert.equal((await invoke({ "x-saturation-event-secret": "wrong" })).status, 401);
    assert.equal((await fetch(`${url}/api/internal/push/process`, { method: "POST",
        headers: { "x-saturation-event-secret": secret, "Content-Type": "application/json" },
        body: JSON.stringify({ cleanup: true }) })).status, 400);
    assert.deepEqual(calls, []);
    const response = await invoke({ "x-saturation-event-secret": secret });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { evaluated: 2, configured: true, sent: 1 } });
    assert.deepEqual(calls, ["maintenance", "reconcile", "dispatch"]);
    assert.equal(response.headers.get("cache-control"), "no-store");
});
