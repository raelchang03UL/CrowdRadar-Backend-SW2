const localHosts = ["localhost", "127.0.0.1", "::1"];

// Entorno de demostración separado: no concede acceso a ningún runner QA.
export const demoLocalDatabase = "crowdradar_demo_local";
export const demoLocalProvenance = "CrowdRadar/SW2/demo-local/v1";
export function assertDemoLocalDatabase({ config: { database, host } }) {
    if (!localHosts.includes(host) || database !== demoLocalDatabase) {
        throw new Error("DEMO_TARGET_INVALID: solo crowdradar_demo_local en PostgreSQL local.");
    }
}
export async function assertDemoLocalProvenance(db) {
    assertDemoLocalDatabase(db);
    const [rows] = await db.query("SELECT shobj_description(oid, 'pg_database') AS provenance FROM pg_database WHERE datname = current_database()");
    if (rows.length !== 1 || rows[0].provenance !== demoLocalProvenance) {
        throw new Error("DEMO_PROVENANCE_UNKNOWN: detenerse; no adoptar ni modificar esta base.");
    }
}

export const consolidationTestDatabases = Object.freeze([
    "crowdradar_consolidacion_fresh_20261017", "crowdradar_consolidacion_legacy_20261017"
]);
export function assertIsolatedConsolidationDatabase({ config: { database, host } }) {
    if (!localHosts.includes(host) || !consolidationTestDatabases.includes(database)) {
        throw new Error("QA de consolidación solo admite sus dos bases locales aisladas identificadas.");
    }
}

export function assertIsolatedAuthTestDatabase({ config: { database, host } }) {
    if (!localHosts.includes(host) || database !== "crowdradar_auth_test") {
        throw new Error("La comprobación de autenticación solo admite crowdradar_auth_test en PostgreSQL local.");
    }
}

export function assertLocalDevelopmentDatabase({ config: { database, host } }) {
    if (!localHosts.includes(host) ||
        !["crowdradar_dev", "crowdradar_hu31_test"].includes(database)) {
        throw new Error("El fixture solo admite crowdradar_dev o crowdradar_hu31_test en PostgreSQL local.");
    }
}

export function assertIsolatedPlacesTestDatabase(connection) {
    assertLocalDevelopmentDatabase(connection);
    if (connection.config.database !== "crowdradar_hu31_test") {
        throw new Error("La comprobación aislada solo admite crowdradar_hu31_test.");
    }
}

// El comando de migración es portable, no una allowlist de desarrollo.
// Se conserva una barrera contra los destinos históricos/protegidos conocidos.
export function assertMigrationTarget({ config: { database, host } }) {
    if (["crowdradar_sprint1", "postgres", "template0", "template1"].includes(database) ||
        /(^|\.)supabase\.(co|com)$/i.test(host ?? "")) {
        throw new Error("Destino protegido: no se permite migrar la entrega, bases de sistema ni Supabase.");
    }
}
