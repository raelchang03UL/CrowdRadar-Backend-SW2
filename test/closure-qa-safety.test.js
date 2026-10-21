import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
    consolidationQaDatabases, assertIsolatedConsolidationDatabase,
    assertConsolidationQaProvenance, closureQaProvenance
} from "../src/database/databaseSafety.js";

const run = "cierre-20261019";
const names = ["crowdradar_cierre_fresh_20261019", "crowdradar_cierre_legacy_20261019"];
test("perfil de cierre exige selección explícita y solo sus dos nombres exactos", () => {
    assert.deepEqual(consolidationQaDatabases(run), names);
    assert.throws(() => consolidationQaDatabases("otro"), /QA_RUN_INVALID/);
    for (const database of names) {
        assert.throws(() => assertIsolatedConsolidationDatabase({ config: { host: "localhost", database } }));
        for (const host of ["localhost", "127.0.0.1", "::1"]) {
            assert.doesNotThrow(() => assertIsolatedConsolidationDatabase({ config: { host, database } }, run));
        }
    }
});
test("cierre rechaza sistema, históricos, QA anteriores, demo y remotos antes de SQL", async () => {
    for (const database of ["postgres", "template0", "template1", "crowdradar_sprint1", "crowdradar_dev",
        "crowdradar_auth_test", "crowdradar_demo_local", ...consolidationQaDatabases(), `${names[0]}_extra`]) {
        await assert.rejects(assertConsolidationQaProvenance({
            config: { host: "localhost", database }, query: () => assert.fail("No debe conectar")
        }, run));
    }
    for (const host of ["db.example", "db.project.supabase.co", "aws-0.pooler.supabase.com"]) {
        await assert.rejects(assertConsolidationQaProvenance({
            config: { host, database: names[0] }, query: () => assert.fail("No debe conectar")
        }, run));
    }
});
test("cierre exige identidad y procedencia, nunca adopta base de nombre coincidente", async () => {
    const db = (rows) => ({ config: { host: "localhost", database: names[0] }, query: async (sql) => {
        assert.match(sql, /^SELECT /);
        return [rows];
    } });
    for (const rows of [[], [{ name: names[0], provenance: null }], [{ name: names[1], provenance: closureQaProvenance }]]) {
        await assert.rejects(assertConsolidationQaProvenance(db(rows), run), /QA_PROVENANCE_UNKNOWN/);
    }
    await assert.doesNotReject(assertConsolidationQaProvenance(db([{ name: names[0], provenance: closureQaProvenance }]), run));
});
test("runner rechaza perfil desconocido antes de intentar conectar", () => {
    const result = spawnSync(process.execPath, ["scripts/verify-consolidation-db.js"], {
        encoding: "utf8", timeout: 15000, env: {
            ...process.env, CROWDRADAR_QA_RUN: "otro", CROWDRADAR_QA_ENV_FILE: "",
            DB_HOST: "127.0.0.1", DATABASE_URL: ""
        }
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /QA_RUN_INVALID/);
});
