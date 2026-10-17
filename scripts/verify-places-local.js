import "dotenv/config";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { QueryTypes } from "sequelize";
import app from "../app.js";
import sequelize from "../src/config/database.js";
import jwt from "../src/utils/jwt.js";
import { assertLocalDevelopmentDatabase } from "../src/database/databaseSafety.js";
import { migratePlaceDetails } from "../src/database/migratePlaceDetails.js";
import { seedPlacesDemo } from "../src/database/seedPlacesDemo.js";

// Solo desarrollo local. No crea usuarios, no muestra credenciales y no envía correo.
assertLocalDevelopmentDatabase(sequelize);
assert.equal(sequelize.config.database, "crowdradar_dev");
const select = (sql) => sequelize.query(sql, { type: QueryTypes.SELECT });
const fingerprint = (rows) => createHash("sha256").update(JSON.stringify(rows)).digest("hex");
let server;
try {
    const usersBefore = fingerprint(await select("SELECT * FROM public.users ORDER BY id"));
    const placesBefore = await select("SELECT id, nombre, categoria, referencia, latitud, longitud, activo, demostrativo FROM public.places ORDER BY id");
    await migratePlaceDetails(sequelize);
    assert.equal(await migratePlaceDetails(sequelize), false);
    await seedPlacesDemo(sequelize);
    assert.equal(fingerprint(await select("SELECT * FROM public.users ORDER BY id")), usersBefore, "Usuarios de desarrollo deben permanecer intactos");
    const placesAfter = await select("SELECT id, nombre, categoria, referencia, latitud, longitud, activo, demostrativo FROM public.places ORDER BY id");
    for (const place of placesBefore) assert.deepEqual(placesAfter.find((stored) => stored.id === place.id), place);
    console.log("PASS: migración y fixture locales conservan usuarios y campos anteriores del catálogo.");
    const [user] = await select('SELECT id, rol, "sessionVersion" FROM public.users WHERE status = \'ACTIVO\' ORDER BY id LIMIT 1');
    assert.ok(user, "Hace falta una cuenta local activa para validar autenticación real.");
    const token = jwt.generateToken(user);
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    const base = `http://127.0.0.1:${server.address().port}/api/places`;
    const request = (path = "", authenticated = true) => fetch(`${base}${path}`, {
        headers: authenticated ? { Authorization: `Bearer ${token}` } : {}
    });
    assert.equal((await request("", false)).status, 401);
    assert.equal((await request("/-103", false)).status, 401);
    const response = await request("/-103");
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.nombre, "Demo · Parque Central");
    assert.equal(data.categoria, "Parque");
    assert.match(data.direccion, /ilustrativa/);
    assert.equal(data.activo, undefined);
    assert.equal((await request("/2147483647")).status, 404);
    assert.equal((await request("/abc")).status, 400);
    console.log("PASS: Express + autenticación + repositorio + PostgreSQL reales: detalle, dirección y errores 400/401/404.");
} catch {
    // No imprime filas, SQL, hashes de contraseña ni JWT si falla una aserción.
    console.error("FAIL: comprobación local de lugares. Revisa migraciones, cuenta local y catálogo demostrativo.");
    process.exitCode = 1;
} finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
}
