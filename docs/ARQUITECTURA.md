# Arquitectura backend

Descripción de HU 3.1, los incrementos A/B/C y el incremento de revisión HU 3.2. La base `develop` comprobada el 11/10/2026 (`46267e7`) ya incluye HU 3.1, A/B/C y SMTP (PR backend #26, #29, #30 y #31). Padres y pruebas históricas se conservan en ESTADO_ACTUAL. Confirmar Git y la integración al reutilizarla: HU 3.2 está pendiente de integrar, y una descripción de arquitectura no constituye prueba de despliegue ni entrega real de correo.

## Responsabilidades

```text
Cliente Flutter
  → app.js (CORS, JSON, rutas)
  → src/routes (validación de entrada y JWT)
  → src/controllers (HTTP y respuesta)
  → src/services (reglas y datos públicos)
  → src/repositories (acceso a datos)
  → src/models / Sequelize → PostgreSQL
```

`AuthService` cifra contraseñas con bcrypt; `src/utils/jwt.js` firma JWT HS256 de dos horas con `sessionVersion`. Desde HU 2.3, el middleware verifica firma/expiración y consulta usuario activo/versión en DB para cada petición protegida; falla cerrado si la DB no está disponible. No admite JWT legacy sin versión. `UserRepository` excluye `passwordHash` y `sessionVersion` de consulta/actualización del perfil. Lugares filtra activos y valida coordenadas antes de devolver un DTO explícito.

El cambio de contraseña bloquea la fila de usuario en una transacción, vuelve a verificar su versión/estado, comprueba contraseña actual y no reutilización, y confirma bcrypt más incremento de versión juntos. Dos cambios simultáneos con el mismo JWT no pueden sobrescribirse: el segundo queda invalidado. Las peticiones ya autenticadas/en curso no se cancelan retroactivamente; las siguientes se rechazan. Un login concurrente puede recibir una versión que acaba de invalidarse y deberá repetirse. El cierre local HU 2.4 no incrementa la versión.

HU 2.1–2.2 añade `PasswordRecoveryController` → `PasswordRecoveryService` → `PasswordRecoveryRepository`. Solicitud genera 32 bytes criptográficos, persiste solo SHA-256 y caduca a los 15 minutos. La validación previa es pública y no consume; el restablecimiento bloquea primero usuario y consume el token mediante UPDATE condicionado a vigencia/uso, antes de bcrypt. El commit confirma consumo, hash y versión juntos; cualquier error revierte todo. Todas las rutas que alteran contraseñas usan ese mismo orden de locks e invalidan enlaces pendientes. Una nueva solicitud invalida el enlace previo bajo lock de usuario.

El repositorio aplica límites por IP/correo normalizado con UPSERT transaccional y claves hash ordenadas para evitar ciclos de locks. Persisten entre reinicios. No se confían cabeceras de proxy. La URL solo procede de configuración validada. Solicitudes conocidas/desconocidas comparten respuesta, piso de 200 ms y no esperan I/O de entrega. Un correo normalizado ambiguo no selecciona arbitrariamente una cuenta.

`PasswordRecoveryService({delivery,resetUrl,repository})` desacopla la entrega. Su interfaz contiene `sendResetLink({email,resetUrl})` y `sendPasswordChangedNotification({email})`; la notificación se programa solo después del commit. `createApp({recoveryService})` permite pruebas integradas sin modificar el servidor global. Sin adaptador, el servicio normal devuelve 503 uniforme antes del lookup y no genera tokens. El adaptador real es `RecoveryMailDelivery` (SMTP genérico con `nodemailer`; el equipo usa Brevo); `src/config/mail.js` lo configura desde `SMTP_*` y solo `startServer` lo construye, de modo que importar `app.js` en pruebas nunca envía correo. No existe captura de correo en producción ni flags de prueba en variables de entorno.

El [contrato API](CONTRATO_API.md) define el intercambio con Flutter. No devolver modelos completos nuevos por comodidad ni aceptar campos de rol/estado desde formularios ciudadanos.

## Configuración y persistencia

### Incremento local HU 3.2 (11/10/2026)

`SaturationQueryController` → `SaturationQueryService` → `SaturationQueryRepository` separa HTTP, política provisional y lectura SQL. El GET protegido no registra reportes. Una CTE usa el reloj PostgreSQL de una sola sentencia para consultar lugar activo y último voto por persona en la ventana inclusiva de 30 minutos; excluye futuros y ordena fecha/ID de forma determinística. El servicio entrega DTO explícito sin identidades y aplica mínimo tres personas/nivel más votado/empate sin nivel. No añade ponderación de confianza ni afirma aforo/tiempo real.

Se reutiliza solo la migración inmutable de almacenamiento HU 4.1, `src/database/migrateReports.js` en `d49578cfdff7ef5bdc77c97c14207642715f41b1` (blob `da04019f28d6fbc4858cc53458ed09da2d9dd661`). El runner explícito aplica `004-saturation-reports`; el arranque únicamente verifica historial y columnas. Integración y política deben revisarse con el equipo, sin tomar la autoría del POST de HU 4.1 ni renumerar las claves `004-saturation-reports`/`004-places-direccion`.

`npm run test:db:saturation` usa exclusivamente la base local aislada de auth: SQL/JWT/HTTP reales con usuarios/lugares/reportes revertidos por transacción y comparaciones de preservación. El runner inyecta esa transacción en las lecturas de sus fixtures, no en el servidor normal; no confirma datos ficticios. Las pruebas Node separadas cubren también frontera inclusiva, futuros, errores públicos y precisión de IDs BIGSERIAL.

`src/config/environment.js` configura DB por `DB_*` o `DATABASE_URL`, TLS opcional con certificado verificado y CORS por orígenes exactos. `.env` es privado. `app.js` autentica conexión, verifica esquema de autenticación y escucha HTTP; nunca ejecuta DDL ni sincroniza modelos.

`scripts/migrate.js` ejecuta `001-create-places` (inmutable) y `002-users-session-version`, con transacción, bloqueo e historial por migración. `002` crea el baseline `users` en una DB limpia o reconoce sus columnas previas y añade solo la versión; no transforma datos históricos ni adopta una columna de seguridad sin historial. `src/database/databaseSafety.js` protege destinos de migración y restringe fixtures/pruebas a DB locales. Ver comandos en [configuración](CONFIGURACION_LOCAL.md). Nuevos esquemas deben extender este ciclo mediante migraciones aditivas, no mediante sincronización automática en cada arranque.

`003-password-recovery` extiende ese runner sin editar las migraciones previas: crea `password_reset_tokens` (hash único y un enlace no consumido por usuario) y `password_recovery_limits`. Requiere 002 y rechaza tablas preexistentes sin historial. El arranque verifica ambas migraciones mediante SELECT, sin DDL.

Los scripts no eliminan la base histórica. Cada PC reproduce esquema/fixtures, no copia credenciales. Una migración aplicada no se reescribe para cambiar su significado; añadir una nueva y probar actualización/base limpia.

## Pruebas y límites

`npm test` usa Node Test Runner, HTTP loopback y repositorios/conexiones dobles; cubre validaciones, bcrypt, JWT y contratos. `npm run test:db:places` comprueba SQL real exclusivamente en `crowdradar_hu31_test`. `npm run test:db:auth` comprueba migración y flujo HTTP de cambio sobre PostgreSQL exclusivamente en `crowdradar_auth_test`, incluidas concurrencia y rollback. No equivale a una prueba visual del frontend.

`npm run test:db:recovery` prueba SQL/HTTP reales en la misma DB aislada de autenticación, con transporte exclusivo de memoria. Incluye consumo concurrente, expiración durante espera de lock, renovación, revocación de JWT, rollback y límites persistentes entre instancias. Ningún transporte de prueba demuestra entrega real.

Deuda conocida: errores/validaciones históricas de perfil desiguales, catálogo limitado/no paginado y CI. La entrega SMTP no reintenta (la cola vive en memoria) y solo registra el código de error; antes de producción, acordar fiabilidad/reintentos, observación sin secretos y mantenimiento/retención de filas de tokens/límites. La respuesta de solicitud mitiga diferencias temporales, sin garantizar tiempo idéntico bajo carga extrema. Recuperación no se declara terminada mientras falte entrega real.

Para despliegue futuro: URLs por entorno, HTTPS, secretos externos, migraciones controladas, DB con TLS y logs sin credenciales/tokens. No hay despliegue autorizado/configurado en esta guía; el correo se configura por PC con secretos propios.
