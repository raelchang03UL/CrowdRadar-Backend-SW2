import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createPublicAbuseMiddleware, vercelClientAddress } from "../src/middlewares/publicAbuse.js";

async function serve(context, middleware) {
    const app = express();
    app.use(middleware);
    app.use((req, res) => res.json({ passed: true, client: req.clientAddress }));
    const server = await new Promise(resolve => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    context.after(() => new Promise(resolve => server.close(resolve)));
    return `http://127.0.0.1:${server.address().port}`;
}
const invoke = (url, path, ip = "203.0.113.5", extraHeaders = {}) => fetch(`${url}${path}`, {
    method: "POST", headers: { "x-vercel-forwarded-for": ip, ...extraHeaders }
});

test("IP Vercel válida exclusivamente; no usa XFF, socket ni listas manipulables", () => {
    for (const value of [undefined, "", "1.2.3.4, 5.6.7.8", "not-ip"]) {
        assert.equal(vercelClientAddress({ get: () => value, ip: "127.0.0.1" }), undefined);
    }
    assert.equal(vercelClientAddress({ get: () => "2001:db8::1" }), "2001:db8::1");
});

test("login/register limitan por IP compartida entre instancias y namespaces separados", async context => {
    const buckets = new Map();
    const repository = { consumeLimits: async entries => {
        const [{ keyHash, maximum }] = entries;
        assert.match(keyHash, /^[0-9a-f]{64}$/);
        const count = (buckets.get(keyHash) ?? 0) + 1;
        buckets.set(keyHash, count);
        return count <= maximum;
    } };
    const first = await serve(context, createPublicAbuseMiddleware({ repository }));
    const second = await serve(context, createPublicAbuseMiddleware({ repository }));
    for (let index = 0; index < 5; index++) assert.equal((await invoke(index % 2 ? first : second, "/register")).status, 200);
    const limited = await invoke(second, "/REGISTER/");
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "900");
    assert.equal(limited.headers.get("cache-control"), "no-store");
    assert.equal((await invoke(first, "/login")).status, 200);
    assert.equal((await invoke(first, "/register", "203.0.113.6")).status, 200);
    assert.equal((await invoke(first, "/register", "203.0.113.5", { "x-forwarded-for": "203.0.113.7" })).status, 429);
});

test("login permite20 y rechaza21; fallo persistencia falla cerrado sin detalles", async context => {
    let attempts = 0;
    const first = await serve(context, createPublicAbuseMiddleware({ repository: { consumeLimits: async ([{ maximum }]) => {
        assert.equal(maximum, 20);
        return ++attempts <= maximum;
    } } }));
    for (let index = 0; index < 20; index++) assert.equal((await invoke(first, "/login")).status, 200);
    assert.equal((await invoke(first, "/login")).status, 429);
    const second = await serve(context, createPublicAbuseMiddleware({ repository: { consumeLimits: async () => {
        throw new Error("password private connection details");
    } } }));
    const response = await invoke(second, "/register");
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /password|private|connection/);
});

test("recuperación recibe IP confiable y conserva sus límites; no limita preflight/rutas ajenas", async context => {
    const url = await serve(context, createPublicAbuseMiddleware({ repository: { consumeLimits: async () => assert.fail("No consume límite nuevo") } }));
    const response = await invoke(url, "/password/forgot");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).client, "203.0.113.5");
    assert.equal((await fetch(`${url}/login`, { method: "OPTIONS" })).status, 200);
    assert.equal((await invoke(url, "/unrelated")).status, 200);
    assert.equal((await invoke(url, "/password/reset", "spoofed")).status, 503);
});
