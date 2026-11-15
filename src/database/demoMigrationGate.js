const lifetimeMs = 5 * 60 * 1000;
const identity = db => JSON.stringify([db.config?.database, db.config?.host, db.config?.port, db.config?.username,
    db.options?.dialectOptions?.ssl, db.connectionManager?.config?.host,
    db.connectionManager?.config?.port, db.connectionManager?.config?.username,
    db.connectionManager?.config?.database, db.connectionManager?.config?.dialectOptions?.ssl]);

// A test can construct a separate store. The real store is private to
// databaseSafety and its verifier is fixed, never supplied by env/request data.
export function createDemoMigrationGate(verify, now = Date.now) {
    const capabilities = new WeakMap();
    return Object.freeze({
        async authorize(db, env) {
            capabilities.delete(db);
            const before = { identity: identity(db), manager: db.connectionManager };
            await verify(db, env);
            if (before.identity !== identity(db) || before.manager !== db.connectionManager) throw new Error("DEMO_CONNECTION_CHANGED");
            capabilities.set(db, { identity: identity(db), manager: db.connectionManager, expiresAt: now() + lifetimeMs });
        },
        permits(db) {
            const capability = capabilities.get(db);
            if (capability && now() < capability.expiresAt && capability.manager === db.connectionManager && capability.identity === identity(db)) return true;
            capabilities.delete(db);
            return false;
        },
        revoke(db) { capabilities.delete(db); }
    });
}
