# Arquitectura backend

## Arquitectura candidata de primer despliegue — 20/10/2026

Preparación documental, sin despliegue ni habilitación remota. La publicación del par backend `05b399a` / frontend `4a227bb` en los PR [#39](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/pull/39) / [#21](https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2/pull/21) no acredita integración o aceptación. El par que finalmente llegue a `develop` y sus evidencias deben fijarse antes de ejecutar el procedimiento de [configuración](CONFIGURACION_LOCAL.md#primer-despliegue-procedimiento-condicionado--20102026).

```text
Flutter Web estático en Vercel ── HTTPS/JWT ──> Express en Vercel (candidato)
Flutter Android conservado ───── HTTPS/JWT ──>          │
                                                     ├─ TLS/pooler → PostgreSQL NUEVO en Supabase
                                                     └─ Adapter SMTP existente → Brevo
Operador de migración separado ─── TLS/directa o sesión → PostgreSQL nuevo
```

El navegador solo conoce la URL pública de Express. Supabase Auth, REST de tablas y claves `anon`/`service_role` no forman parte de este diseño; Data API deshabilitada y permisos SQL efectivos revisados. JWT, autorización y transacciones continúan en la API propia.

| Decisión / estado | Evidencia y cambio mínimo necesario | Alternativa / coste / prueba de salida |
| --- | --- | --- |
| Hosting Express serverless: candidato, no demostrado | `app.js` exporta `createApp()` antes de `startServer`; el export omite validación, readiness y construcción SMTP. Preparar inicialización asíncrona única por instancia, esperada por cada petición y que falle cerrada, reutilizando las comprobaciones SELECT existentes, sin DDL. | Vercel soporta Express, pero eso no prueba nuestro ciclo de vida. Servidor persistente es alternativa solo si falla el ensayo y se aprueban host/coste. Probar frío, caliente, peticiones iniciales simultáneas, esquema ausente, reconexión y fallo SMTP/configuración sin filtrar secretos. [Soporte oficial](https://vercel.com/docs/frameworks/backend/express). |
| Conexiones y migrador separados: estructura local existente, operación remota pendiente | `databaseConfiguration` limita pool; `migrationConnection` selecciona URL exclusiva. API comienza con max1/min0 por instancia, conservando presupuesto total de instancias, conexiones del pooler y reserva administrativa; no afirmar que max1 limita toda la nube. | Pooler transaccional para API sujeto a prueba de pg/Sequelize y locks/SET LOCAL; migración directa o sesión. Coste: medir saturación/espera y ajustar concurrencia; no cerrar el pool compartido al terminar cada petición. [Guía Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres). |
| SMTP Adapter: conservar; ejecución posterior y durabilidad son decisiones distintas | `PasswordRecoveryService.queueDelivery` mantiene promesas en RAM y consume el rechazo; terminar la Function puede interrumpir el envío. Añadir lifecycle explícito en un paquete futuro, con presupuesto/errores medibles y respuesta uniforme. | `waitUntil` puede esperar dentro del límite de la Function; no persiste tareas ni reintenta. Si la demo exige recuperación fiable tras caída, diseñar outbox/worker separado: lease, reintentos acotados, vencimiento y custodia cifrada del enlace, nunca token plano durable. SMTP no garantiza una sola recepción ante respuesta ambigua. [Ciclo de vida](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil). |
| Separación de privilegios: propuesta, sin grants remotos | Rol migrador propietario de esquema; rol API con permisos mínimos de sus consultas, sin DDL/CREATEDB/superusuario. No distribuir URL migradora al runtime ni a Flutter. | RLS puede ser defensa adicional, pero no sustituye autorización Express ni evita un rol con privilegios excesivos. Probar denegación de DDL y acceso ajeno, y ausencia de REST/GraphQL público. [Data API](https://supabase.com/docs/guides/api/securing-your-api#disable-the-data-api). |

Estas decisiones conservan capas y Adapter; una función `initialize…` no sería Factory Method por su nombre. Las futuras tareas de inicialización y outbox tienen problemas verificables, no justifican reorganizar carpetas o introducir microservicios.

La brecha del runtime se comprueba en `app.js`: el export por defecto recibe `createApp()` sin pasar por `startServer`, donde hoy viven `validateEnvironment`, `sequelize.authenticate`, las seis comprobaciones de esquema y `recoveryServiceFromEnvironment`. `GET /` devuelve un mensaje y no acredita esas comprobaciones. En `src/services/PasswordRecoveryService.js`, `queueDelivery` guarda promesas en `pendingDeliveries` y consume sus errores; no existe una cola durable. `src/config/environment.js` y `src/config/migrationConnection.js` ya separan configuración/pool/migrador; se deben extender solo ante los requisitos concretos del ensayo, sin introducir otra capa de repositorios. La excepción futura de destino pertenece a `src/database/databaseSafety.js` y exige identidad aprobada y pruebas negativas antes de habilitar SQL remoto.

La evidencia local de JWT, transacciones, premios y recuperación sigue siendo válida para sus versiones; no demuestra TLS remoto, permisos efectivos, cold starts ni entrega SMTP bajo terminación de Function. El ensayo debe registrar cada una de esas propiedades por separado y conservar Android como cliente del mismo contrato HTTPS.

HU7 exige decidir autorización administrativa en servidor, mínimo privilegio, validación de cada acción, auditoría sin datos sensibles y política de moderación/recuperación antes de implementar pantallas; ocultar botones no autoriza. HU8.3 exige decidir evento, destinatario/consentimiento, canal, frecuencia, deduplicación, baja y mecanismo durable de alertas; no asumir que la cola SMTP de recuperación cumple esa historia. Ambas permanecen fuera de esta implementación.

## Herramienta de demo local — 19/10/2026

`scripts/demo-local.js` compone configuración/guardas/migraciones/arranque; no es ruta HTTP ni Factory Method. Check verifica destino/procedencia sin DML; no aprovisiona ni conecta a QA. Creación inicial manual por administrador sobre base nueva, nunca adopción/comentario de una ajena. Seed encapsula SQL transaccional de catálogo; no cambia modelos ni crea cuentas/reportes. Alternativa descartada: conexión QA/shared.env por mezcla de datos/secretos. Coste: requisito administrativo inicial explícito; no provisionador cloud.35 pruebas con dobles y evidencia PostgreSQL separada. SMTP Adapter/runtime conservados.

Contenido del candidato R01/S3 en `integration/cierre-web-r01-s03-20261019`; publicación acreditada por PR, integración/aceptación/despliegue pendientes. Express,Sequelize,PostgreSQL,JWT,bcrypt y SMTP de Diego conservados. Cortes anteriores fechados son históricos. Evidencia actual en [CIERRE_WEB_R01_S03](CIERRE_WEB_R01_S03.md).

## Responsabilidades comprobadas

- `app.js` compone CORS exacto, JSON limitado a 32 KB, rutas y manejo público de errores. `startServer` valida configuración y comprueba esquema mediante SELECT antes de escuchar; no ejecuta DDL. El export por defecto no pasa por ese arranque: no usarlo como prueba de compatibilidad serverless.
- Rutas/controladores traducen HTTP, JWT, entradas y errores. Los nuevos adaptadores de validación/historial son breves y delegan negocio a servicios; no se movieron carpetas para uniformar nombres.
- Servicios conservan reglas y DTO. `ReportValidationService` decide permisos/forma, conteos y confiabilidad; `PlaceHistoryService` decide períodos, bloques y recomendaciones. Reutiliza la evaluación pura de saturación con política horaria explícita; la consulta actual conserva 30 minutos. Ninguna política llega del cliente.
- Repositorios contienen SQL parametrizado, locks y transacciones. `ReportValidationRepository` limita primero los 50 reportes recientes, luego agrega sus votos, sin una consulta por elemento. Historial limita personas/bloques a 10001 filas, rechaza más de 10000 y usa statement_timeout local de 5 segundos.
- `SaturationReportRepository`: usuario FOR UPDATE, revisión de sesión bajo lock, lock usuario/lugar, lugar activo, cooldown con reloj SQL, reporte + ledger único + karma en una transacción. Fallos revierten todo. No se conceden premios retrospectivos.
- `ReportValidationRepository`: revalida actor activo/versión/expiración dentro de transacción; impide autovoto/autodenuncia. PK compuesta impide duplicados concurrentes. Peso fijado al votar; votar no concede karma. Denunciar no oculta ni elimina.
- Autenticación mantiene bcrypt (8 caracteres/72 bytes), JWT de 2 horas/versionado, reset aleatorio con hash/15 minutos/uso único. Cambio/reset invalidan sesiones en la transacción; logout sigue siendo local. Perfil usa DTO explícito; BIGINT de IDs es texto y karma se normaliza a entero seguro.

## Decisiones y patrones

| Estado / clasificación | Problema, participantes y HU | Alternativa, beneficio, coste y prueba |
| --- | --- | --- |
| Existente: capas, arquitectura | app/rutas/controladores → servicios → repositorios/modelos; HU1–6 | ORM/SMTP dentro de rutas sería corto, pero mezclaría negocio y transporte. Se conservan fronteras/imports, sin migración masiva por funcionalidad. AuthService aún utiliza modelo: no se afirma DIP/DDD completo. |
| Reutilizado/ampliado: Repository, acceso a datos, no GoF | Place/Report/Validation/History repositories; HU3–6 | SQL directo en servicios dispersaría autorización y locks. Centraliza consultas/atomicidad; cuesta mantener orden de bloqueos y dobles. Pruebas PostgreSQL reales y HTTP. No GenericRepository. |
| Existente: Adapter de objeto, GoF | PasswordRecoveryService → sendResetLink/sendPasswordChangedNotification → RecoveryMailDelivery → Nodemailer | Aísla SMTP y permite dobles frente a correo dentro del negocio. Coste: mantener contrato de promesas/errores y operación del proveedor. Tests de fallo/configuración; SMTP real no repetido. |
| Corregido: readiness específico, no patrón GoF | app.js + assertPlaceDetails/ConsolidatedReports/Karma/ValidationSchemaReady | Solo README no evita aceptar tráfico con esquema ausente. SELECT falla cerrado sin migrar al arrancar. Tests de esquema ausente/presente y no-DDL. No SchemaManager dinámico. |
| Reutilizado: composición/inyección | createApp, createPlaceRepository, createSaturationReportRepository, createMigrationConnection | Funciones de construcción, no Factory Method por llamarse create. Permiten dobles y roles distintos sin jerarquías. Coste: contratos explícitos; tests de configuración/rollback. |
| Local: política pura compartida | evaluateSaturation + historyPolicy; HU3.2/6.x | Copiar la fórmula divergiría. Parametrización interna evita duplicar reglas; no necesita Strategy polimórfica. Tests de mínimo, último voto y empate. |

Cohesión/SRP: presentación de HTTP no contiene fórmulas/SQL; persistencia no decide mensajes visuales. DRY no elimina validación backend porque haya formularios. ISP/LSP se comprueban con los dos métodos del adaptador y dobles compatibles, no con una cuota de interfaces. KISS/YAGNI: sin microservicios, event bus, repositorio genérico ni módulos HU7/8 adelantados.

## Evolución de esquema y conexiones

Migraciones históricas conservadas. 005 concilia ambas identidades publicadas de reportes sin fingir que se aplicó la otra; 006 añade karma/ledger sin retroactividad; 007 agrega votos, denuncias e índice horario. No se reescriben migraciones aplicadas ni se borran filas/bases.

API lee DATABASE_URL o DB_*. Solo CLI lee MIGRATION_DATABASE_URL; pool de migración de una conexión y pool API acotado/configurable. TLS mantiene rejectUnauthorized:true y CA opcional. Esto prueba selección de configuración, no permisos efectivos de un rol remoto. databaseSafety conserva las barreras históricas/Supabase; no se habilitó destino remoto.

## Seguridad y límites reales

JSON 32 KB, errores sin SQL/secretos, consultas parametrizadas, JWT/versión/estado, PK de participación y transacciones. Recuperación usa límites persistentes PostgreSQL y socket IP; no confía X-Forwarded-For. Login/lecturas/votos no tienen un límite global antiabuso nuevo. CORS no es autorización. Probar carga/índices y presupuesto de conexiones antes de exponer.

SMTP usa cola RAM sin reintentos durables; 202 no acredita recepción. Ni waitUntil ni un proceso persistente solucionan por sí solos durabilidad. Ver preparación de nube y bloqueos en CONFIGURACION_LOCAL y avisos de dependencias en ESTADO_ACTUAL. No se promete ausencia de errores ni protección absoluta.

[UML editable](modelos/consolidacion.puml): componentes, secuencia atómica y validación. Fuente revisada, no renderizada por PlantUML (no se instaló herramienta). Estado y pruebas identifican el par funcional.
