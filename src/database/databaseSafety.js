const localHosts = ["localhost", "127.0.0.1", "::1"];

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
