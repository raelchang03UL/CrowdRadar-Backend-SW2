import test from "node:test";
import assert from "node:assert/strict";
import { migratePlaceDetails, placeDetailsMigration } from "../src/database/migratePlaceDetails.js";
import * as details from "../src/database/migratePlaceDetails.js";

test("detalle: readiness exige historial y columna sin DDL", async () => {
    const queries = [];
    await details.assertPlaceDetailsSchemaReady({ query: async (sql, options) => {
        queries.push(sql);
        assert.match(sql, /^SELECT /);
        if (sql.startsWith("SELECT name")) {
            assert.equal(options.replacements.name, placeDetailsMigration);
            return [{ name: placeDetailsMigration }];
        }
        assert.match(sql, /SELECT direccion FROM public\.places LIMIT 0/);
        return [];
    } });
    assert.equal(queries.length, 2);
});

for (const scenario of ["historial ausente", "columna ausente", "conexión caída"]) {
    test(`detalle: readiness falla cerrado con ${scenario}`, async () => {
        const queries = [];
        await assert.rejects(details.assertPlaceDetailsSchemaReady({ query: async (sql) => {
            queries.push(sql);
            assert.match(sql, /^SELECT /);
            if (scenario === "conexión caída") throw new Error("private connection details");
            if (sql.startsWith("SELECT name")) return scenario === "historial ausente" ? [] : [{ name: placeDetailsMigration }];
            throw new Error("private SQL details");
        } }), (error) => error.code === "SCHEMA_NOT_READY" && /npm run db:migrate/.test(error.message) && !/private/.test(error.message));
        assert.ok(queries.length > 0);
    });
}

test("HU 3.3 migración aditiva confirma dirección e historial en una transacción", async () => {
    const sentencias = [], transaction = {};
    const sequelize = {
        transaction: (action) => action(transaction),
        query: async (sql, options) => {
            assert.equal(options.transaction, transaction);
            sentencias.push(sql);
            if (sql.startsWith("SELECT name")) return [];
            if (sql.startsWith("INSERT INTO public.crowdradar_migrations")) assert.equal(options.replacements.name, placeDetailsMigration);
            return [];
        }
    };
    assert.equal(await migratePlaceDetails(sequelize), true);
    assert.equal(sentencias.length, 4);
    assert.match(sentencias[0], /pg_advisory_xact_lock/);
    assert.match(sentencias[2], /ADD COLUMN direccion VARCHAR\(250\)/);
    assert.match(sentencias[2], /direccion IS NULL/);
    assert.ok(sentencias.every((sql) => !/\b(DROP|DELETE|UPDATE|users)\b/i.test(sql)));
});
test("HU 3.3 migración repetida no ejecuta DDL ni toca catálogo", async () => {
    const sentencias = [];
    assert.equal(await migratePlaceDetails({
        transaction: (action) => action({}),
        query: async (sql) => { sentencias.push(sql); return sql.startsWith("SELECT name") ? [{ name: placeDetailsMigration }] : []; }
    }), false);
    assert.equal(sentencias.length, 2);
});
