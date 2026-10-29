# CrowdRadar Backend

API REST para registro, inicio de sesión, perfil, recuperación/restablecimiento, lugares autenticados y alertas push de cambios de saturación en favoritos. Recuperación requiere configurar un proveedor de correo; las alertas push requieren configurar Firebase Cloud Messaging y una fuente interna de cambios. Está construida con Node.js, Express, Sequelize y PostgreSQL. Los incrementos publicados en ramas siguen pendientes de integración en `develop`; verifica la rama del PR que revisas.

Para colaborar con el equipo y usar IA sobre el código, empieza por [AGENTS.md](AGENTS.md), [CONTRIBUTING.md](CONTRIBUTING.md) e [inicio del equipo](docs/INICIO_EQUIPO.md), que incluye un prompt sin tarea asignada. Las guías de [coordinación](docs/COORDINACION_EQUIPO.md), [arquitectura](docs/ARQUITECTURA.md) y [contrato API](docs/CONTRATO_API.md) viajan con el repositorio. `develop` reúne los aportes integrados de los siete: publicar una rama permite revisarla, pero no incorpora su trabajo a la base común hasta integrar el PR.

**Descarga actual del equipo:** `integration/base-equipo` en backend y frontend contiene los avances A/B/C y las guías de inicio, pendientes de revisión/integración. Usarla para leer, ejecutar y revisar; iniciar tareas nuevas desde `develop` solo después de integrar y comprobar el par. Los comandos de clonación y el prompt están en la guía de inicio.

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

Antes del primer arranque y de actualizar este incremento, ejecuta `npm run db:migrate`. Aplica `001-create-places`, `002-users-session-version`, `003-password-recovery` y `004-saturation-push-alerts`; esta última crea tokens de dispositivo, niveles actuales y una cola transaccional. El arranque solo autentica y verifica el esquema; **no ejecuta DDL ni `User.sync()`**. Si falta la migración, se detiene con instrucciones. La respuesta de control está en `GET http://localhost:3000/`.

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
| `POST` | `/api/auth/password/forgot` | No | Solicitar enlace con respuesta uniforme; sin proveedor devuelve 503. |
| `POST` | `/api/auth/password/reset/validate` | No | Validar enlace antes del formulario, sin consumirlo. |
| `POST` | `/api/auth/password/reset` | No | Restablecer una vez, invalidar sesiones y exigir login. |
| `GET` | `/api/users/profile` | Bearer JWT | Consultar el perfil autenticado. |
| `PUT` | `/api/users/profile` | Bearer JWT | Actualizar nombre, apellido, teléfono o distrito. |
| `GET` | `/api/places` | Bearer JWT | Listar lugares activos con coordenadas válidas. |

`GET /api/places` devuelve `{ "data": [...] }`, con `id`, `nombre`, `categoria`, `referencia`, `latitud`, `longitud` y `demostrativo`. Vacío: HTTP 200 y `data: []`. Sin autorización: 401. Fallo de datos/consulta: 503 con un mensaje público, sin detalles internos. No hay endpoint de alta/edición de lugares en esta HU.

## HU 8.3 — alertas de cambios de saturación

El cliente registra y desregistra el token de este dispositivo en `POST`/`DELETE /api/notifications/devices` usando el JWT de la sesión. En Android/iOS, inicializa Firebase con las opciones públicas de la app entregadas mediante `--dart-define`: `FIREBASE_API_KEY`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_PROJECT_ID`, `FIREBASE_ANDROID_APP_ID` y, para iOS, `FIREBASE_IOS_APP_ID`. Web push no está habilitado en esta implementación.

El backend requiere `FCM_PROJECT_ID` y credenciales de Application Default Credentials para enviar. En desarrollo, `GOOGLE_APPLICATION_CREDENTIALS` debe apuntar a un archivo de cuenta de servicio fuera del repositorio. Nunca copies la clave en Git o en el chat. Sin FCM configurado, la cola conserva alertas pendientes y el servidor lo indica en su log.

La fuente de saturación debe llamar `POST /api/internal/places/{id}/saturation`, enviar `{ "level": "..." }` y el encabezado `x-saturation-event-secret`. Configura `SATURATION_EVENT_SECRET` con un valor aleatorio de al menos 32 caracteres tanto en la fuente como en el backend. El primer nivel reportado inicializa el estado; repetirlo no genera notificaciones; solo un cambio real encola alertas. Se envían a los tokens de usuarios asociados al lugar mediante `favorites`, por lo que la migración/esquema de favoritos debe estar disponible antes de procesar cambios. El envío se reintenta mediante la cola hasta cinco veces. `GET /api/places/{id}` proporciona el detalle que abre la notificación.

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

HU 2.1–2.2: URL local confiable `PASSWORD_RESET_URL=http://localhost:5500/#/reset-password`, con query del token dentro del fragmento Flutter. HTTPS fuera de desarrollo/pruebas loopback. Configurar esa URL no habilita envío: falta elegir proveedor, remitente y credenciales; no se inventan SMTP ni un modo de captura en producción. La solicitud normal responde 503 `RECOVERY_UNAVAILABLE` sin consultar cuentas ni almacenar tokens. El 202 uniforme y el recorrido completo solo están comprobados con transporte exclusivo de pruebas. Ver [contrato](docs/CONTRATO_API.md) y [configuración](docs/CONFIGURACION_LOCAL.md).

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
