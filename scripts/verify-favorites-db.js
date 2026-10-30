import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
const input = dotenv.parse(readFileSync(process.env.CROWDRADAR_HU8_QA_ENV_FILE));
assert.equal(input.DB_NAME, "crowdradar_hu8_test");
assert.ok(["127.0.0.1", "localhost", "::1"].includes(input.DB_HOST));
assert.ok(!input.DATABASE_URL && !input.MIGRATION_DATABASE_URL);
Object.assign(process.env, input, { DATABASE_URL: "", DB_SSL: "false", NODE_ENV: "test", JWT_SECRET: randomBytes(48).toString("hex"), PUSH_WORKER_ENABLED: "false" });
for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "PASSWORD_RESET_URL", "FCM_PROJECT_ID"]) delete process.env[key];
const { default: db } = await import("../src/config/database.js");
const { assertHu8QaProvenance } = await import("../src/database/databaseSafety.js");
const select = async (sql, replacements = {}) => (await db.query(sql, { replacements }))[0];
let server;
try {
    await db.authenticate();
    await assertHu8QaProvenance(db);
    const migrations = [
        ["migratePlaces", "migratePlaces"], ["migrateAuth", "migrateAuth"], ["migrateRecovery", "migrateRecovery"],
        ["migratePlaceDetails", "migratePlaceDetails"], ["migrateReportCompatibility", "migrateReportCompatibility"],
        ["migrateKarma", "migrateKarma"], ["migrateValidation", "migrateValidation"], ["migrateUserModeration", "migrateUserModeration"],
        ["migrateReportModeration", "migrateReportModeration"], ["migrateFavorites", "migrateFavorites"], ["migrateSaturationAlerts", "migrateSaturationAlerts"]
    ];
    for (const [file, name] of migrations) {
        const migration = (await import(`../src/database/${file}.js`))[name];
        await migration(db);
        assert.equal(await migration(db), false);
    }
    console.log("PASS: 001–009 preservadas; 010 favoritos y 011 push, esquema vacío/repetición segura sin DDL de arranque.");
    const tag = randomBytes(8).toString("hex");
    const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 4);
    const users = [];
    for (let n = 0; n < 4; n++) users.push((await select(`INSERT INTO public.users(nombre,apellido,email,"passwordHash",rol,status,"createdAt","updatedAt")
        VALUES ('QA HU8',:tag,:email,:passwordHash,'USUARIO','ACTIVO',NOW(),NOW()) RETURNING id`,
        { tag, email: `hu8-${tag}-${n}@example.test`, passwordHash }))[0]);
    const [{ id: placeId }] = await select(`INSERT INTO public.places(nombre,categoria,latitud,longitud) VALUES (:name,'Parque',0,0) RETURNING id`, { name: `HU8 ${tag}` });
    const { createApp } = await import("../app.js");
    const { default: jwt } = await import("../src/utils/jwt.js");
    const { PushNotificationService } = await import("../src/services/PushNotificationService.js");
    const { default: pushRepository } = await import("../src/repositories/PushNotificationRepository.js");
    const sent = [];
    const service = new PushNotificationService({ delivery: { isFcmConfigured: () => true, isInvalidTokenError: () => false, send: async (message) => sent.push(message) } });
    const tokens = users.map(({ id }) => jwt.generateToken({ id, email: `qa-${id}@example.test`, sessionVersion: 0 }));
    server = createApp({ pushNotificationService: service, saturationEventSecret: "synthetic-hu8-only-local-internal-secret" }).listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    const url = `http://127.0.0.1:${server.address().port}/api`;
    const request = (path, { actor = 0, method = "GET", body, token = tokens[actor], headers = {} } = {}) => fetch(url + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal((await request(`/places/${placeId}/favorite`, { method: "POST", token: null })).status, 401);
    const concurrent = await Promise.all([request(`/places/${placeId}/favorite`, { method: "POST" }), request(`/places/${placeId}/favorite`, { method: "POST" })]);
    assert.deepEqual(concurrent.map(r => r.status).sort(), [201, 409]);
    assert.equal((await (await request("/places/favorites")).json()).data.some(p => p.id === placeId), true);
    assert.equal((await (await request("/places/favorites", { actor: 1 })).json()).data.some(p => p.id === placeId), false);
    assert.equal((await (await request(`/places/${placeId}`)).json()).data.esFavorito, true);
    assert.equal((await (await request(`/places/${placeId}`, { actor: 1 })).json()).data.esFavorito, false);
    assert.equal((await request(`/places/${placeId}/favorite`, { method: "DELETE", actor: 1 })).status, 204);
    assert.equal((await (await request(`/places/${placeId}`)).json()).data.esFavorito, true);
    assert.equal((await request(`/places/${placeId}/favorite`, { method: "DELETE" })).status, 204);
    assert.equal((await request(`/places/${placeId}/favorite`, { method: "DELETE" })).status, 204);
    assert.equal((await (await request(`/places/${placeId}`)).json()).data.esFavorito, false);
    assert.equal((await request(`/places/${placeId}/favorite`, { method: "POST" })).status, 201);
    assert.equal((await request("/places/1e2/favorite", { method: "POST" })).status, 400);
    console.log("PASS: HTTP real agregar/concurrencia409/lista privada/detalle/eliminar idempotente/volver a agregar/JWT.");
    const favoritesBeforeRepeat = await select(`SELECT * FROM public.favorites WHERE user_id=:id ORDER BY place_id`, { id: users[0].id });
    const stateBeforeRepeat = await select(`SELECT * FROM public.place_saturation WHERE place_id=:placeId`, { placeId });
    const { migrateFavorites } = await import("../src/database/migrateFavorites.js");
    const { migrateSaturationAlerts } = await import("../src/database/migrateSaturationAlerts.js");
    assert.equal(await migrateFavorites(db), false);
    assert.equal(await migrateSaturationAlerts(db), false);
    assert.deepEqual(await select(`SELECT * FROM public.favorites WHERE user_id=:id ORDER BY place_id`, { id: users[0].id }), favoritesBeforeRepeat);
    assert.deepEqual(await select(`SELECT * FROM public.place_saturation WHERE place_id=:placeId`, { placeId }), stateBeforeRepeat);
    console.log("PASS: repetir migraciones010/011 conserva favoritos y baseline ya registrados.");
    const fid = `synthetic-fid-${tag}-qa-only`;
    const registration = await request("/notifications/devices", { method: "POST", body: { token: fid, platform: "web" } });
    assert.equal(registration.status, 200);
    let bindingA = (await registration.json()).data.registrationId;
    assert.ok(bindingA);
    const oldBindingSameJwt = bindingA;
    const refreshed = await request("/notifications/devices", { method: "POST", body: { token: fid, platform: "web" } });
    assert.equal(refreshed.status, 200);
    bindingA = (await refreshed.json()).data.registrationId;
    assert.notEqual(bindingA, oldBindingSameJwt);
    assert.equal((await request("/notifications/devices", { method: "DELETE", body: { token: fid, registrationId: oldBindingSameJwt } })).status, 204);
    assert.equal((await select(`SELECT registration_id FROM public.push_device_tokens WHERE token=:fid`, { fid }))[0].registration_id, bindingA);
    console.log("PASS: re-registro con MISMO JWT cambia binding y logout tardío del binding anterior conserva el dispositivo nuevo.");
    // NO inicialización manual: marcar el primer favorito fijó la base real SIN_DATOS.
    for (let actor = 0; actor < 3; actor++) {
        const response = await request(`/places/${placeId}/reports`, { method: "POST", actor, body: { level: "SATURADO" } });
        assert.equal(response.status, 201, JSON.stringify(await response.json()));
    }
    const transition = await service.reconcilePlace({ placeId });
    assert.deepEqual(transition, { changed: true, previousLevel: "SIN_DATOS", newLevel: "SATURADO" });
    assert.deepEqual(await service.reconcilePlace({ placeId }), { changed: false, initialized: false });
    const [{ count }] = await select(`SELECT count(*)::int AS count FROM public.push_notification_outbox WHERE place_id = :placeId`, { placeId });
    assert.equal(count, 1);
    await service.dispatchPending();
    const actual = sent.filter(message => message.data.placeId === String(placeId));
    assert.equal(actual.length, 1);
    assert.equal(actual[0].fid, fid);
    assert.equal(actual[0].notification, undefined);
    assert.equal(actual[0].data.userId, String(users[0].id));
    assert.equal(actual[0].data.registrationId, bindingA);
    console.log("PASS: 3 reportes HTTP reales → cálculo CrowdRadar → transición única → outbox → entrega FCM doble data-only Web (NO recepción FCM real).");
    const rejectedLevel = await request(`/internal/places/${placeId}/saturation`, { method: "POST", body: { level: "INVENTADO" }, headers: { "x-saturation-event-secret": "synthetic-hu8-only-local-internal-secret" } });
    assert.equal(rejectedLevel.status, 400);
    assert.equal((await request(`/internal/places/${placeId}/saturation`, { method: "POST", body: {} })).status, 401);
    // La misma consulta excluye retirados HU7 y reportes fuera de ventana.
    await db.query(`UPDATE public.saturation_reports SET is_public=FALSE, moderation_version=1, reviewed_denunciations=1, review_decision='REMOVE' WHERE place_id=:placeId`, { replacements: { placeId } });
    assert.equal((await service.reconcilePlace({ placeId })).newLevel, "SIN_DATOS");
    const claimed = await pushRepository.claimPending();
    const oldEvent = claimed.find(row => row.placeId === placeId);
    assert.ok(oldEvent);
    assert.equal(await pushRepository.isEligible(oldEvent), true);
    const registrationB = await request("/notifications/devices", { actor: 1, method: "POST", body: { token: fid, platform: "web" } });
    assert.equal(registrationB.status, 200);
    const bindingB = (await registrationB.json()).data.registrationId;
    assert.notEqual(bindingB, bindingA);
    assert.equal(await pushRepository.isEligible(oldEvent), false);
    await pushRepository.removeDeviceById(oldEvent.deviceTokenId, oldEvent.registrationId);
    assert.equal((await select(`SELECT id FROM public.push_device_tokens WHERE token=:fid`, { fid })).length, 1);
    assert.equal((await request(`/places/${placeId}/favorite`, { actor: 1, method: "POST" })).status, 201);
    await db.query(`UPDATE public.saturation_reports SET is_public=TRUE, moderation_version=1, reviewed_denunciations=1, review_decision='KEEP', created_at=NOW() WHERE place_id=:placeId`, { replacements: { placeId } });
    assert.equal((await service.reconcilePlace({ placeId })).newLevel, "SATURADO");
    await service.dispatchPending();
    assert.equal(sent.at(-1).data.registrationId, bindingB);
    assert.equal(sent.at(-1).data.userId, String(users[1].id));
    await db.query(`UPDATE public.saturation_reports SET created_at=NOW()-INTERVAL '31 minutes' WHERE place_id=:placeId`, { replacements: { placeId } });
    assert.equal((await service.reconcilePlace({ placeId })).newLevel, "SIN_DATOS");
    await db.query(`UPDATE public.users SET "sessionVersion"="sessionVersion"+1 WHERE id=:id`, { replacements: { id: users[1].id } });
    assert.equal((await request("/places/favorites", { actor: 1 })).status, 401);
    const beforeSend = sent.length;
    await service.dispatchPending();
    assert.equal(sent.length, beforeSend);
    console.log("PASS: HU7 retiro/caducidad30m cambian cálculo; sin cambio no hay alerta; transferencia FID purga cola y binding/versión caducados no entregan a otra sesión/cuenta.");
    console.log("PASS: entorno HU8 aislado conservado para inspección; ningún SMTP ni FCM real, bases personales sin acceso.");
} finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.close();
}
