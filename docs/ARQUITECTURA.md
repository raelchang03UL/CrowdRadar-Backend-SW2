# Arquitectura backend

Corte local del 18/10/2026. Rama `feature/local-s03-validacion-analitica-20261017`, dependiente de la consolidación R01. No publicada, integrada en develop ni aceptada formalmente. Se conservan Express, Sequelize, PostgreSQL, JWT, bcrypt y el SMTP de Diego.

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
