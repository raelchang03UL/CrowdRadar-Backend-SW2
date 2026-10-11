# CrowdRadar Backend

Esta rama de revisión añade HU 3.6 sobre HU 3.2: filtrar lugares por la misma estimación ciudadana de saturación. Conserva la política provisional aprobada por el usuario y pendiente de acuerdo/revisión del equipo. No incorpora registro de reportes (HU 4.1) ni métricas de confianza.

API REST para registro, inicio de sesión, consulta/actualización del perfil, cambio seguro de contraseña, recuperación/restablecimiento y lectura autenticada de lugares. Recuperación envía el enlace por SMTP (Brevo) cuando cada PC configura sus variables `SMTP_*`; sin ellas responde 503 uniforme. Está construida con Node.js, Express, Sequelize y PostgreSQL. La base `develop` comprobada el 11/10/2026 (`46267e7`) ya integra HU 3.1, HU 2.3, HU 2.1–2.2 y envío SMTP (PR #26, #29, #30 y #31). Verifica Git y la rama del PR que revisas; esto no declara HU 3.2 integrada.

Para colaborar con el equipo y usar IA sobre el código, empieza por [CONTRIBUTING.md](CONTRIBUTING.md) y [AGENTS.md](AGENTS.md). Las guías de [coordinación](docs/COORDINACION_EQUIPO.md), [arquitectura](docs/ARQUITECTURA.md) y [contrato API](docs/CONTRATO_API.md) viajan con el repositorio. `develop` reúne los aportes integrados de los siete: publicar una rama permite revisarla, pero no incorpora su trabajo a la base común hasta integrar el PR.

## HU 3.6 — filtro de saturación

Rama `feature/hu-3-6-filtro-saturacion`, dependiente de `feature/hu-3-2-consulta-saturacion` (padre backend `0605b51fb5aa6933de9b587e9ad9c73f5e46c2d1`). [Issue frontend #7](https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2/issues/7). Revisar el par y primero la dependencia HU 3.2; no se declara integrado en `develop`.

`GET /api/places?nivel=TRANQUILO|MODERADO|SATURADO` exige JWT y devuelve el DTO histórico de lugares. Sin `nivel`, vacío o espacios conserva Todos. Con un nivel, una consulta batch utiliza la política/evaluación existentes de HU 3.2; empate e información insuficiente no coinciden con ningún nivel. Entrada inválida devuelve 400 público; sin coincidencias, 200 con `data: []`. Cambiar/quitar el filtro vuelve a consultar; no calcula distancias ni promete monitoreo automático.

Sin dependencias, variables o migraciones nuevas. Se requiere el esquema de reportes del padre HU 3.2 y su coordinación compartida con HU 4.1. Prueba adicional: `npm run test:db:saturation-filter`, exclusivamente sobre la base local aislada ya preparada, sin migrar ni confirmar fixtures. [Contrato](docs/CONTRATO_API.md) y [validaciones](docs/ESTADO_ACTUAL.md).

## Requisitos

- Node.js y npm.
- PostgreSQL en ejecución.
- Una base de datos local y credenciales con permisos para ejecutar sus migraciones explícitas.

La línea base de desarrollo se verificó con Node.js 22.20.0, npm 10.9.3 y PostgreSQL 18. Consulta [CONFIGURACION_LOCAL.md](docs/CONFIGURACION_LOCAL.md) para reproducir ambos proyectos desde cero.

## Configuración

1. Instala las dependencias:

   ```powershell
   npm ci
   ```

2. Crea la base de datos desde `psql` o pgAdmin:

   ```sql
   CREATE DATABASE crowdradar_dev;
   ```

3. Copia `.env.example` como `.env` y reemplaza los valores locales:

   ```powershell
   Copy-Item .env.example .env
   ```

   Variables requeridas:

   - `DB_HOST`: host de PostgreSQL, normalmente `127.0.0.1`.
   - `DB_PORT`: puerto de PostgreSQL, normalmente `5432`.
   - `DB_NAME`: usa `crowdradar_dev` para desarrollo. Conserva `crowdradar_sprint1` solo como evidencia de la entrega.
   - `DB_USER`: usuario de PostgreSQL.
   - `DB_PASSWORD`: contraseña del usuario.
   - `JWT_SECRET`: secreto largo y aleatorio para firmar tokens.
   - `PORT`: puerto HTTP, por defecto `3000`.

   `.env` está ignorado por Git. No publiques credenciales.

## Ejecución

```powershell
npm start
```

Antes del primer arranque y de actualizar este incremento, ejecuta `npm run db:migrate`. Aplica `001-create-places`, `002-users-session-version`, `003-password-recovery` y `004-saturation-reports`: 002 crea `users` en una base limpia o añade la versión de sesión a su esquema histórico reconocido; 003 añade tablas de tokens/límites y 004 el almacenamiento compartido de reportes, sin borrar usuarios. El arranque solo autentica y verifica el esquema; **no ejecuta DDL ni `User.sync()`**. Si falta la migración, se detiene con instrucciones. La respuesta de control está en `GET http://localhost:3000/`.

Los fixtures admiten únicamente `crowdradar_dev` o `crowdradar_hu31_test` en PostgreSQL local. El comando de migración es explícito y portable; bloquea la base de entrega, bases de sistema y hosts Supabase. En esta tarea todas las conexiones reales fueron locales. No se realizó despliegue.

La conexión admite variables `DB_*` o `DATABASE_URL` (tiene precedencia). `DB_SSL=true` exige verificación del certificado; `DB_SSL_CA` permite una CA propia con saltos `\n`. No se permiten parámetros `sslmode`/`ssl` en la URL que eludan esa política. `CORS_ORIGINS` es una lista de orígenes exactos separados por comas, sin rutas ni `*`; por defecto permite Web local en el puerto 5500. Android/CLI sin `Origin` siguen sujetos al JWT. Estas opciones se prueban mediante dobles, no contra servicios remotos.

## HU 3.1 — esquema y datos de demostración

```powershell
npm run db:migrate
# Opcional y explícito: solo para demostrar el mapa, NO datos reales.
npm run db:seed:demo
npm start
```

La migración es transaccional y serializa ejecuciones concurrentes. Si existe `places` sin historial, falla en lugar de adoptar o sobrescribir un esquema desconocido. No hay comandos de borrado ni rollback destructivo.

El fixture carga tres posiciones ilustrativas en Lima con `demostrativo=true` y nombres `Demo · ...`. Usa IDs negativos reservados; se puede repetir sin duplicados y no sobrescribe filas ocupadas. No es un catálogo canónico, no mide saturación y no representa monitoreo en tiempo real. Sin cargarlo, una base nueva devuelve una lista vacía.

Para desarrollo con recarga automática:

```powershell
npm run dev
```

## Endpoints actuales en esta rama

| Método | Ruta | Autenticación | Propósito |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | No | Registrar un ciudadano. |
| `POST` | `/api/auth/login` | No | Validar credenciales y obtener JWT. |
| `POST` | `/api/auth/password/change` | Bearer JWT | Verificar contraseña actual, cambiarla e invalidar todas las sesiones anteriores. |
| `POST` | `/api/auth/password/forgot` | No | Solicitar enlace con respuesta uniforme (202); sin `SMTP_*` devuelve 503. |
| `POST` | `/api/auth/password/reset/validate` | No | Validar enlace antes del formulario, sin consumirlo. |
| `POST` | `/api/auth/password/reset` | No | Restablecer una vez, invalidar sesiones y exigir login. |
| `GET` | `/api/users/profile` | Bearer JWT | Consultar el perfil autenticado. |
| `PUT` | `/api/users/profile` | Bearer JWT | Actualizar nombre, apellido, teléfono o distrito. |
| `GET` | `/api/places` | Bearer JWT | Listar lugares activos con coordenadas válidas. |
| `GET` | `/api/places/:id/saturation` | Bearer JWT | Consultar el nivel estimado con reportes recientes de personas distintas. |

`GET /api/places` devuelve `{ "data": [...] }`, con `id`, `nombre`, `categoria`, `referencia`, `latitud`, `longitud` y `demostrativo`. Vacío: HTTP 200 y `data: []`. Sin autorización: 401. Fallo de datos/consulta: 503 con un mensaje público, sin detalles internos. No hay endpoint de alta/edición de lugares en esta HU.

Ejemplo de registro:

```json
{
  "nombre": "Rael",
  "apellido": "Chang",
  "email": "tu-correo-unico@example.test",
  "password": "<elige-tu-contraseña-local>",
  "telefono": "900000000",
  "distrito": "Miraflores"
}
```

El valor de contraseña es un marcador, no una credencial predeterminada: elige una propia de al menos 8 caracteres y como máximo 72 bytes UTF-8. Todos los campos del formulario Web son obligatorios; nombre, apellido y distrito requieren al menos 2 caracteres; teléfono exactamente 9 dígitos. El backend no envía correo de verificación.

Opcionalmente, `npm run db:seed:user-demo` crea **Rael Chang** mediante el mismo registro/bcrypt, con `DEMO_USER_EMAIL` y `DEMO_USER_PASSWORD` suministrados solo en la sesión local. No hay valores predeterminados. Ejecuta después de `npm run db:migrate`; si existe otra cuenta/contraseña no la sobrescribe. No guardar esas variables en documentos ni Git.

Para las rutas protegidas usa el token retornado por login:

```text
Authorization: Bearer <token>
```

HU 2.3: enviar `currentPassword`, `newPassword` y `confirmPassword` al cambio de contraseña. La nueva debe tener mínimo 8 caracteres Unicode, no ser solo espacios, no superar 72 bytes UTF-8 y ser diferente de la actual. El éxito no devuelve JWT: vuelve a login. Cada petición protegida comprueba la versión de sesión persistida; todos los JWT anteriores quedan rechazados, incluso en otros clientes y después de reiniciar el backend. Los JWT antiguos sin versión tampoco se aceptan: inicia sesión nuevamente tras actualizar. El cierre local HU 2.4 por sí solo continúa sin revocar JWT.

HU 2.1–2.2: URL local confiable `PASSWORD_RESET_URL="http://localhost:5500/#/reset-password"` (entre comillas: sin ellas `.env` corta el valor en `#`), con query del token dentro del fragmento Flutter. HTTPS fuera de desarrollo/pruebas loopback. Configurar esa URL no habilita envío: hacen falta además las variables `SMTP_*` de Brevo descritas en la configuración local. Sin ellas, la solicitud responde 503 `RECOVERY_UNAVAILABLE` sin consultar cuentas ni almacenar tokens. No existe modo de captura en producción. Ver [contrato](docs/CONTRATO_API.md) y [configuración](docs/CONFIGURACION_LOCAL.md).

## HU 3.2 — consulta de saturación

La propuesta local cuenta el último reporte de cada persona durante los 30 minutos anteriores a la consulta (ambos límites incluidos, reportes futuros excluidos). Exige tres personas distintas; gana el nivel con más votos (`TRANQUILO`, `MODERADO` o `SATURADO`). Si faltan personas o hay empate, devuelve `level: null` con el motivo correspondiente. No exige usuarios simultáneamente conectados, no mide aforo y no pondera confianza. La actualización ocurre al consultar/reintentar, no mediante tiempo real. El [contrato](docs/CONTRATO_API.md) contiene el DTO y errores.

Reutiliza **sin cambios** únicamente `src/database/migrateReports.js` de la rama publicada `feature/hu-4-1-nivel-saturacion`, commit `d49578cfdff7ef5bdc77c97c14207642715f41b1`; no copia el POST ni el formulario de ese compañero. Antes de integrar, el equipo debe coordinar ese almacenamiento compartido y aprobar la política. `004-saturation-reports` y la migración independiente `004-places-direccion` tienen nombres de historial distintos: no se renumeran ni se reescriben migraciones aplicadas.

Sin reportes reales de HU 4.1, un lugar activo muestra información insuficiente. `db:seed:demo` sigue cargando solo lugares y **nunca niveles ficticios**. La prueba siguiente crea reportes únicamente dentro de una transacción aislada que revierte.

```powershell
npm run test:db:saturation
```

Reutiliza exclusivamente `crowdradar_auth_test` en PostgreSQL local; la base debe existir (el runner auth la prepara). Aplica migraciones explícitas, verifica preservación/idempotencia y usa HTTP/JWT/SQL reales sobre fixtures revertibles. No borra tablas/filas ni confirma reportes de prueba. Las secuencias PostgreSQL pueden avanzar aun con rollback. No equivale a recorrido Web ni Android.

## Pruebas

```powershell
npm test
```

Las pruebas HTTP de `test/sprint1.test.js` levantan Express en un puerto efímero y reemplazan únicamente el repositorio por memoria. Comprueban rutas, validaciones, bcrypt y JWT sin modificar PostgreSQL. La persistencia contra PostgreSQL debe verificarse aparte con un `.env` local válido.

La suite cubre autorización, lugares, ciclo de migración/arranque, configuración, CORS, fixtures y límites de contraseña. Validación final del 07/10/2026: **24/24** pruebas, sin dependencias nuevas. Los dobles de conexión no demuestran un despliegue remoto.

```powershell
npm run test:db:places
```

Esta comprobación requiere PostgreSQL local y permiso de crear bases: crea o reutiliza exclusivamente `crowdradar_hu31_test`, nunca usa `DB_NAME` como destino. Verifica idempotencia, preservación de una tabla `users` centinela, restricciones SQL, fixture repetible y exclusión de inactivos. Las inserciones negativas se revierten mediante transacción; la base aislada se conserva para inspección. No la uses para datos personales.

```powershell
npm run test:db:auth
```

Usa exclusivamente `crowdradar_auth_test` local, separada de la tabla centinela de lugares. Verifica migración limpia (primera ejecución), actualización aditiva e idempotencia, preservación de usuarios, restricciones y HTTP real con bcrypt/PostgreSQL: dos cambios simultáneos, rechazo del JWT viejo, login nuevo y rollback de hash/versión. No elimina tablas ni bases; conserva usuarios de prueba con credenciales aleatorias nunca impresas. Requiere permiso `CREATEDB`. No se incluyen credenciales ni nuevas dependencias.

```powershell
npm run test:db:recovery
```

Usa la misma base aislada `crowdradar_auth_test` y aplica explícitamente 003. Comprueba validación sin consumo, reset concurrente con un ganador, expiración bajo lock, reutilización, nueva solicitud, invalidación tras cambio autenticado, JWT anterior/login nuevo, rollback y abuso persistente. No elimina datos ni imprime enlaces/contraseñas. El correo se captura únicamente en memoria de pruebas; los límites QA usan namespace por ejecución con SQL/umbrales reales. Falta entrega de correo real y recorrido manual Chrome/Android para este incremento.

## Estado verificado

El 22/09/2026 se verificaron arranque y flujo HTTP contra `crowdradar_dev`, y el frontend Android completó registro, login, perfil y actualización contra esta base. `crowdradar_sprint1` no se modificó. Consulta [ESTADO_ACTUAL.md](docs/ESTADO_ACTUAL.md) para resultados, límites y evidencias; [PLAN_TECNICO_SW2.md](docs/PLAN_TECNICO_SW2.md) para prioridades. La evidencia histórica del Sprint 1 permanece en [entrega](entrega/).
