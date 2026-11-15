import test from "node:test";
import assert from "node:assert/strict";
import { createNotificationController } from "../src/controllers/NotificationController.js";
import { PushNotificationService } from "../src/services/PushNotificationService.js";
import { migratePushTargetTypes, assertPushTargetTypesSchemaReady } from "../src/database/migratePushTargetTypes.js";

const fid = "c" + "a".repeat(21);
const registrationToken = "synthetic-fcm-registration:" + "a".repeat(140);

test("registro conserva FID por defecto y transmite tipo FCM explícito sin inferir por longitud", async () => {
    const registered = [];
    const controller = createNotificationController({ registerDevice: async value => { registered.push(value); return "qa-binding"; } });
    for (const [body, expectedType] of [
        [{ token: fid, platform: "android" }, "fid"],
        [{ token: registrationToken, platform: "web", targetType: "fcm-token" }, "fcm-token"],
        [{ token: registrationToken, platform: "web", targetType: "fid" }, "fid"]
    ]) {
        const response = { status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
        await controller.registerDevice({ body, user: { id: 9, sessionVersion: 2, exp: 2000000000 } }, response);
        assert.equal(response.code, 200);
        assert.equal(registered.at(-1).targetType, expectedType);
        assert.equal(registered.at(-1).userId, 9);
        assert.equal(registered.at(-1).sessionVersion, 2);
        assert.equal(registered.at(-1).expiresAt, 2000000000);
    }
});

test("tipo inválido, claves desconocidas o JWT evidente no registran un destino", async () => {
    let calls = 0;
    const controller = createNotificationController({ registerDevice: async () => { calls++; } });
    for (const body of [
        { token: registrationToken, platform: "web", targetType: "automatic" },
        { token: registrationToken, platform: "web", targetType: null },
        { token: registrationToken, platform: "web", targetType: "fcm-token", userId: 99 },
        { token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzeW50aGV0aWMifQ.c3ludGhldGljLXNpZ25hdHVyZQ", platform: "web", targetType: "fcm-token" }
    ]) {
        const response = { status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
        await controller.registerDevice({ body, user: { id: 9 } }, response);
        assert.equal(response.code, 400);
        assert.equal(response.body.code, "DEVICE_TOKEN_INVALID");
    }
    assert.equal(calls, 0);
});

test("dispatch usa exactamente el campo declarado y conserva data-only Web y binding", async () => {
    const sent = [], delivered = [];
    const service = new PushNotificationService({
        repository: {
            claimPending: async () => [
                { id: 1, targetType: "fid", token: registrationToken },
                { id: 2, targetType: "fcm-token", token: registrationToken }
            ].map(row => ({ ...row, userId: 9, sessionVersion: 2, registrationId: "qa-binding", placeId: 7,
                previousLevel: "TRANQUILO", newLevel: "SATURADO", platform: "web", attempts: 1 })),
            isEligible: async () => true,
            markDelivered: async id => delivered.push(id),
            markFailed: async () => assert.fail("No debe intentar otra ruta.")
        },
        delivery: { isFcmConfigured: () => true, isInvalidTokenError: () => false, send: async value => sent.push(value) }
    });
    assert.deepEqual(await service.dispatchPending(), { configured: true, sent: 2 });
    assert.equal(sent[0].fid, registrationToken); assert.equal(sent[0].token, undefined);
    assert.equal(sent[1].token, registrationToken); assert.equal(sent[1].fid, undefined);
    for (const message of sent) {
        assert.equal(message.notification, undefined);
        assert.deepEqual(message.data, { placeId: "7", userId: "9", sessionVersion: "2", registrationId: "qa-binding",
            previousLevel: "TRANQUILO", newLevel: "SATURADO" });
    }
    assert.deepEqual(delivered, [1, 2]);
});

test("tipo almacenado desconocido falla cerrado, sin inferencia ni fallback", async t => {
    let sends = 0;
    const failed = [];
    t.mock.method(console, "error", () => {});
    const service = new PushNotificationService({ repository: {
        claimPending: async () => [{ id: 3, attempts: 1, targetType: "unknown", token: registrationToken }],
        isEligible: async () => true, markFailed: async (...args) => failed.push(args)
    }, delivery: { isFcmConfigured: () => true, isInvalidTokenError: () => false, send: async () => { sends++; } } });
    assert.deepEqual(await service.dispatchPending(), { configured: true, sent: 0 });
    assert.equal(sends, 0); assert.deepEqual(failed, [[3, 1, "PUSH_TARGET_TYPE_INVALID"]]);
});

test("012 aditiva requiere 011 y no reescribe destinos; repetir no ejecuta ALTER", async () => {
    let applied = false;
    const queries = [];
    const connection = { transaction: operation => operation({ id: 1 }), query: async (sql, options) => {
        assert.ok(options.transaction); queries.push(sql);
        if (sql.includes("WHERE name = :name")) return applied ? [{ name: "012-push-target-types" }] : [];
        if (sql.includes("WHERE name = '011-saturation-push-alerts'")) return [{ name: "011-saturation-push-alerts" }];
        if (sql.startsWith("INSERT INTO")) applied = true;
        return [];
    } };
    assert.equal(await migratePushTargetTypes(connection), true);
    assert.equal(await migratePushTargetTypes(connection), false);
    const changes = queries.filter(sql => sql.startsWith("ALTER"));
    assert.equal(changes.length, 1); assert.match(changes[0], /DEFAULT 'fid'/);
    assert.match(changes[0], /'fid', 'fcm-token'/);
    assert.ok(queries.every(sql => !/UPDATE|DELETE|DROP|TRUNCATE/.test(sql)));
    await assert.rejects(migratePushTargetTypes({ transaction: operation => operation({}), query: async () => [] }), /011/);
});

test("readiness012 falla sin migración y nunca crea esquema", async () => {
    const queries = [];
    await assert.rejects(assertPushTargetTypesSchemaReady({ query: async sql => { queries.push(sql); return []; } }), { code: "SCHEMA_NOT_READY" });
    assert.ok(queries.every(sql => sql.startsWith("SELECT")));
});
