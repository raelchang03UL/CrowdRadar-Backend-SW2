import test from "node:test";
import assert from "node:assert/strict";
import { assertDemoLocalDatabase, assertDemoLocalProvenance, demoLocalProvenance, assertIsolatedConsolidationDatabase, assertLocalDevelopmentDatabase } from "../src/database/databaseSafety.js";
import { demoLocalEnvironment } from "../src/config/demoLocalEnvironment.js";
import { demoLocalPlaces } from "../src/database/demoLocalPlaces.js";
import { seedDemoLocalPlaces } from "../src/database/seedDemoLocalPlaces.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function memoryDatabase({ database = "crowdradar_demo_local", host = "127.0.0.1", provenance = demoLocalProvenance, places = [] } = {}) {
    let rows = new Map(places.map(place => [place.id, { ...place }]));
    let queries = 0, transactions = 0;
    return { config: { database, host }, get rows() { return [...rows.values()]; }, get queries() { return queries; }, get transactions() { return transactions; },
        async transaction(run) {
            transactions++;
            const tx = { rows: new Map([...rows].map(([id,row]) => [id,{ ...row }])) };
            const result = await run(tx); rows = tx.rows; return result;
        },
        async query(sql, options) {
            queries++;
            if (sql.includes("shobj_description")) return [[{ provenance }]];
            if (sql.includes("pg_advisory_xact_lock")) return [];
            const place = options.replacements, tx = options.transaction;
            if (sql.startsWith("SELECT *")) return [...tx.rows.values()].filter(row => row.id === place.id || row.nombre.toLowerCase() === place.nombre.toLowerCase());
            if (sql.startsWith("INSERT INTO")) { tx.rows.set(place.id,{ ...place }); return []; }
            throw new Error("Unexpected SQL in seed double");
        },
    };
}

for (const host of ["localhost","127.0.0.1","::1"]) {
    test(`demo permite exclusivamente destino local ${host}`, () => assert.doesNotThrow(() => assertDemoLocalDatabase(memoryDatabase({host}))));
}
for (const database of ["crowdradar_dev","crowdradar_sprint1","postgres","template0","template1","crowdradar_demo_local_backup","crowdradar_consolidacion_fresh_20261017"]) {
    test(`seed rechaza ${database} antes de SQL`, async () => {
        const db=memoryDatabase({database}); await assert.rejects(seedDemoLocalPlaces(db),/DEMO_TARGET_INVALID/); assert.equal(db.queries,0);
    });
}
for (const host of ["db.example.org","db.fake.supabase.co","0.0.0.0","127.0.0.2"]) {
    test(`seed rechaza host ${host}`, async () => { const db=memoryDatabase({host}); await assert.rejects(seedDemoLocalPlaces(db),/DEMO_TARGET_INVALID/); assert.equal(db.queries,0); });
}
test("la guarda demo no amplía guards ni runners QA/desarrollo", () => {
    const db=memoryDatabase(); assert.throws(()=>assertIsolatedConsolidationDatabase(db)); assert.throws(()=>assertLocalDevelopmentDatabase(db));
});
for (const provenance of [null,"unknown","CrowdRadar/SW2/demo-local/v0"]) {
    test(`procedencia desconocida ${provenance}: sin transacción ni adopción`, async () => {
        const db=memoryDatabase({provenance}); await assert.rejects(assertDemoLocalProvenance(db),/DEMO_PROVENANCE_UNKNOWN/); assert.equal(db.transactions,0);
    });
}
test("seed repetido sin duplicados, sin usuarios/premios generados", async () => {
    const db=memoryDatabase(); assert.deepEqual(await seedDemoLocalPlaces(db),{inserted:5,unchanged:0,total:5});
    const before=structuredClone(db.rows); assert.deepEqual(await seedDemoLocalPlaces(db),{inserted:0,unchanged:5,total:5}); assert.deepEqual(db.rows,before);
    assert.equal(new Set(db.rows.map(p=>p.id)).size,5); assert(db.rows.every(p=>p.activo&&p.demostrativo));
});
for (const field of ["nombre","categoria","direccion","referencia","latitud","longitud","activo","demostrativo"]) {
    test(`conflicto ${field}: rollback completo sin sobrescrituras`, async () => {
        const conflict={...demoLocalPlaces[2], [field]: typeof demoLocalPlaces[2][field]==="boolean" ? false : typeof demoLocalPlaces[2][field]==="number" ? 0 : "Ajeno"};
        const db=memoryDatabase({places:[conflict]}),before=structuredClone(db.rows);
        await assert.rejects(seedDemoLocalPlaces(db),/DEMO_CATALOG_CONFLICT/); assert.deepEqual(db.rows,before); // También revierte las dos inserciones previas.
    });
}
test("mismo nombre en otro ID es conflicto y no duplica", async () => {
    const db=memoryDatabase({places:[{...demoLocalPlaces[0],id:99}]});await assert.rejects(seedDemoLocalPlaces(db),/DEMO_CATALOG_CONFLICT/);assert.equal(db.rows.length,1);
});
test("config demo no hereda URL, SMTP ni privilegios del input", () => {
    const env=demoLocalEnvironment({DB_HOST:"localhost",DB_USER:"synthetic",DB_PASSWORD:"test-only",DB_NAME:"personal",SMTP_HOST:"smtp.example.org",JWT_SECRET:"private"});
    assert.equal(env.DB_NAME,"crowdradar_demo_local");assert.equal(env.SMTP_HOST,"");assert.notEqual(env.JWT_SECRET,"private");assert.equal(env.CORS_ORIGINS,"http://127.0.0.1:5543,http://localhost:5543");assert.equal(env.KARMA_POINTS_PER_REPORT,"10");assert.equal(env.REPORT_COOLDOWN_MINUTES,"3");
});
for (const patch of [{DATABASE_URL:"postgres://remote/private"},{MIGRATION_DATABASE_URL:"postgres://remote/private"},{DB_HOST:"db.example.org"},{DB_PORT:"999999"},{DB_PASSWORD:""}]) {
    test(`config insegura rechazada: ${Object.keys(patch)[0]}`, () => assert.throws(()=>demoLocalEnvironment({DB_HOST:"localhost",DB_USER:"synthetic",DB_PASSWORD:"test-only",...patch}),/DEMO_CONFIG_INVALID/));
}

test("CLI no aprovisiona bases ni admite init antes de leer configuración", () => {
    const script = fileURLToPath(new URL("../scripts/demo-local.js", import.meta.url));
    const result = spawnSync(process.execPath, [script, "init"], {
        env: { ...process.env, CROWDRADAR_DEMO_ENV_FILE: "archivo-inexistente-deliberado" },
        encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^DEMO_USAGE:/);
    assert.equal(result.stdout, "");
});
