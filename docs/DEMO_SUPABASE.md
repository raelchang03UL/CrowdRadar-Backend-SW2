# Preparación de la base para la demo — 04/11/2026

Preparación local, todavía **sin destino Supabase habilitado ni SQL remoto**. `src/config/demoSupabaseTarget.js` conserva `null`: la configuración demo falla antes de conectar. Las bases y fixtures históricos mantienen sus restricciones.

## Identidad y autorización

El futuro perfil versionado debe proceder de evidencia verificada del proyecto **nuevo**: project-ref, organización y titular, fecha de creación/verificación, huella de esa evidencia, identificador de procedencia, inventario inicial de esquemas, endpoints/usuarios exactos y huella SHA-256 de la CA de cada endpoint. No se aceptan estos datos desde una variable `ALLOW_*`, un dominio genérico, argumentos CLI ni una petición HTTP. Un nombre de host parecido no concede permiso.

`CROWDRADAR_DEPLOYMENT=demo-vercel-20261104` selecciona la configuración estricta; no autoriza por sí solo. El runtime Vercel exige ese identificador. Las URLs deben carecer de parámetros y fragmentos: no pueden sustituir la verificación SSL. Se exige una CA con la huella prevista, `rejectUnauthorized:true` y comprobación de hostname. Los secretos siguen fuera de Git.

| Conexión | Uso y restricciones |
| --- | --- |
| `DEMO_BOOTSTRAP_DATABASE_URL` | Operación administrativa explícita sobre el único destino aprobado; no se entrega a la API. Comprueba inventario y vacío inicial antes de crear roles/procedencia. |
| `MIGRATION_DATABASE_URL` | `crowdradar_demo_migrator`, sin superusuario, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS, membresías ni creación de otras bases/esquemas. Puede crear/alterar objetos de `public`. |
| `DATABASE_URL` | `crowdradar_demo_api`, sin propiedad de tablas, membresías, DDL ni tablas temporales. Grants explícitos por tabla y secuencia según consultas existentes. |

El bootstrap comprueba ausencia de objetos de usuario en `public`, inventario exacto de esquemas y ausencia de usuarios/objetos/buckets en las tablas de plataforma verificadas. No adopta roles, esquemas ni marcas preexistentes. Crea la procedencia en `crowdradar_demo_identity`, cuyo esquema y tabla pertenecen a `postgres`; API/migrador solo pueden leerla. La guarda detecta permisos de escritura tanto de tabla como por columna.

La API comprueba identidad efectiva, conexión TLS, privilegios y procedencia antes de los SELECT de readiness; no ejecuta DDL. La capacidad de migración requiere la misma comprobación, vive cinco minutos y pertenece únicamente a la instancia Sequelize/configuración validada. Un cambio de gestor, base, host, puerto, usuario o TLS, incluso durante la validación, la invalida. La CLI canónica comprueba esa capacidad antes de cada función y la revoca al terminar. Las funciones/migraciones históricas001–012 se conservan sin cambios.

## Operaciones explícitas preparadas

`scripts/demo-supabase.js` admite `preflight`, `bootstrap`, `check-api`, `check-migration`, `grants` y `catalog`. El archivo privado de configuración debe seleccionarse explícitamente mediante `node --env-file`; este script no carga `.env` de forma implícita. Ninguna operación funciona mientras el perfil versionado sea `null`. La migración sigue siendo `scripts/migrate.js`, con las funciones canónicas en su orden existente.

El catálogo contiene los cinco lugares demostrativos existentes, con identificadores negativos y sin observaciones de saturación ni usuarios ficticios remotos. Un conflicto de ID/nombre/datos detiene la operación. Los grants permiten solo las operaciones SQL utilizadas; `UPDATE(id)` sobre `places` es necesario para los locks de favoritos/alertas de PostgreSQL. La API puede borrar límites expirados para la limpieza acotada del ejecutor autenticado. No tiene escritura sobre historial de migraciones ni procedencia.

API: Supavisor transaccional, una conexión Sequelize por instancia, mínimo cero y liberación ociosa breve. Migraciones: conexión directa o pooler de sesión en el endpoint exacto aprobado. Las consultas pg/Sequelize actuales no usan prepared statements con nombre. El pool de una conexión es una decisión conservadora para esta demo y exige comprobar que cada consulta dentro de una transacción reciba esa transacción. No limita por sí solo el total de conexiones al escalar ni acredita rendimiento remoto. [Conexiones oficiales de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

La configuración de proveedor, el cierre de Data API/GraphQL, los permisos efectivos en Supabase y la compatibilidad real de Supavisor siguen pendientes. El fixture local no sustituye esas comprobaciones.

## Evidencia local y límites

Se creó un clúster PostgreSQL18.1 exclusivo en `tmp/cierre-demo-web-20261104/qa/postgres`, loopback `127.0.0.1:55491`, base de usuario `crowdradar_demo_infra_test`. No se migró `postgres` de sistema ni se reutilizó otra instancia. TLS usa una CA local de prueba de tres días; claves y configuración privada permanecen fuera del repositorio backend y bajo permisos del usuario local.

El harness `test/helpers/demoSupabaseLocalHarness.js` solo se activa mediante `test/demo-supabase-local.test.js` con `CROWDRADAR_DEMO_SQL_QA=local-20261104` y `node --experimental-test-module-mocks --test test/demo-supabase-local.test.js`. Sin ese opt-in, la suite normal lo omite. Antes de SQL verifica directorio físico del clúster, dirección, puerto y comentario de procedencia. No conecta con Supabase.

El adapter exclusivo de prueba hace exactamente tres transformaciones, registradas en la evidencia:

1. `REVOKE CREATE,TEMPORARY ON DATABASE postgres FROM PUBLIC` se dirige a la base de usuario del fixture.
2. El `GRANT CONNECT ON DATABASE postgres` equivalente se dirige a esa misma base de usuario.
3. La columna `current_database() AS database` se comprueba contra el nombre real del fixture y se normaliza al nombre contractual `postgres` para probar el resto de la guarda.

El perfil y endpoint sintéticos se inyectan únicamente mediante el módulo de pruebas; producción conserva `null`. Estas transformaciones permiten probar SQL/permisos reales sin tocar una base de sistema; **no prueban identidad, propiedad, hostname ni TLS del Supabase futuro**.

Resultados conservados bajo `../qa` respecto del backend:

- `db-safety-unit-final.log`:13/13 pruebas focalizadas de configuración/guardas; incluyen cambios internos del gestor, verificador TLS inesperado y carrera durante autorización.
- `db-local-sql-second.log` y `db-local-sql-evidence-initial.json`:9 bloques SQL más el test padre,10/10; bootstrap desde vacío,001–012 y13 entradas históricas, repetición idempotente, permisos y readiness.
- `db-local-sql-final.log` y `db-local-sql-evidence.json`: comprobación posterior de permisos por columna, membresía y privilegios efectivos, reconexión y rechazo real de CA/hostname incorrectos. El bloque de vacío inicial se omite al repetir porque su resultado inicial se conserva; no se vuelve a adoptar ni reinicializar la base.
- `db-migration-byte-preservation.json`:13 archivos históricos de migración idénticos byte por byte a HEAD.
- `runtime-db-smoke-rerun.log`:7/7 bloques SQL/HTTP con rol API y pool uno; registro/login/favorito/tres reportes, reconciliación concurrente con un evento, claim sin envío doble, backoff/reintento con proveedor simulado y conexión libre durante la entrega. Ocho consumos concurrentes persistieron y tres fueron permitidos;701 límites vencidos se eliminaron en lotes500+201 conservando la ventana reciente. API temporal3054 y pools del runner cerrados; fixtures sintéticos locales conservados.

No se enviaron correos ni push reales, no hubo SQL remoto y no se habilitó un proyecto. El resultado de la suite completa corresponde a la validación integrada registrada por el coordinador.

## Ejecución periódica: investigación, no configuración

La documentación oficial permite combinar [Supabase Cron](https://supabase.com/docs/guides/cron), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net) y [Vault](https://supabase.com/docs/guides/functions/schedule-functions) para un POST cada minuto. El endpoint existente `/api/internal/push/process` ya requiere su secreto; una futura configuración debe guardar ese secreto en Vault y usar HTTPS hacia la URL exacta de la API. No debe incluir secretos en el texto del job ni conceder lectura de Vault a API/migrador.

No se creó job, daemon, extensión ni secreto remoto. Disponibilidad, cuota/coste gratuito, activación de extensiones, permisos y comportamiento ante pausa del proyecto deben verificarse en la cuenta/proyecto aprobado antes de configurarlo. Un job ejecutado no acredita recepción/apertura de una notificación.
