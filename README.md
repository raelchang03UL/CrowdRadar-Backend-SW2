# CrowdRadar Backend

## Candidato de revisión Web R01/S3 — 19/10/2026

Rama `integration/cierre-web-r01-s03-20261019`, preparada desde `eeff38b` más pendientes identificados F3/C2. La existencia remota y el par exacto se acreditan por los PR, no por esta cabecera. **Rama de revisión ≠ integrado en develop ≠ aceptado ≠ desplegado.** Se conservan historial/autores de Nick/Manu y la base de autenticación/SMTP/mapa de Diego.

Para ejecutar el par en otra PC: [demo reproducible sin QA ni rutas personales](docs/CATALOGO_DEMO_LOCAL.md). Usa `.env.demo.example` sin secretos, cinco lugares reales/observaciones demostrativas, API3043/Web5543 y SMTP deshabilitado. No hay cuentas/reportes/puntos precargados. [Pruebas, procedencia y límites](docs/CIERRE_WEB_R01_S03.md).

Consolida lugares/filtros, reporte atómico, karma e historial propio; añade HU5.1–5.4 (votos, confiabilidad, estado y denuncia) y HU6.1–6.3 (historial horario, comparación y horarios). Sin HU7/8 ni reescritura de SMTP. Arranque solo SELECT/readiness; migraciones explícitas 001–007 antes de servir. 005 concilia reportes históricos y 006 no inventa premios retrospectivos.

Lee [CONTRIBUTING](CONTRIBUTING.md), [contrato](docs/CONTRATO_API.md), [configuración](docs/CONFIGURACION_LOCAL.md), [arquitectura](docs/ARQUITECTURA.md) y [estado/pruebas](docs/ESTADO_ACTUAL.md). No uses el ZIP histórico ni el experimento visual como este incremento.

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

Antes del arranque general, ejecutar `npm run db:migrate`: recorre001–007, conserva las claves históricas004, concilia almacenamiento de reportes005, añade ledger/karma006 y validaciones007. No renumerar migraciones aplicadas ni usar una base histórica. El arranque comprueba esquema mediante SELECT y no ejecuta DDL ni User.sync(). Para la demo usar los comandos específicos demo:local del procedimiento enlazado, no este.env general.

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

## HU 3.5 — filtrar lugares por categoría

En `feature/hu-3-5-filtro-categoria`, `GET /api/places/categories` devuelve `{data: ["Cultura", "Parque", ...]}` con las categorías existentes de lugares activos, únicas y ordenadas. No se inventa un catálogo. Ambas rutas exigen JWT.

`GET /api/places?categoria=Parque` devuelve solo los lugares activos de esa categoría exacta, en orden de ID. La categoría se recorta y admite hasta 80 caracteres Unicode; sin parámetro, vacío o espacios muestra todos. Una categoría sin coincidencias devuelve 200 con `data: []`. Repetidos/propiedades extra devuelven 400; fallos de consulta, 503 público. No hay cambios de esquema ni dependencias.

La consolidación conserva detalle3.3 y búsqueda3.4 junto a categoría3.5 y nivel3.6: nombre/categoría/nivel se combinan con AND. Los PR originales conservan su estado; incorporar su ascendencia aquí no los fusiona ni cierra. Contrato completo y rutas HU4–6 en [CONTRATO_API](docs/CONTRATO_API.md).

## Resumen de endpoints (contrato canónico enlazado)

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
| `GET` | `/api/places` | Bearer JWT | Lugares activos; filtros AND nombre/categoria/nivel. |
| `GET` | `/api/places/categories` | Bearer JWT | Consultar categorías únicas de lugares activos. |

| `GET` | `/api/places/:id` | Bearer JWT | Detalle/dirección nullable por ID. |
| `GET` | `/api/places/:id/saturation` | Bearer JWT | Consultar el nivel estimado con reportes recientes de personas distintas. |
| `POST` | `/api/places/:id/reports` | Bearer JWT | Reporte y premio atómicos, cooldown3min. |
| `GET` | `/api/users/reports` y `/api/users/karma` | Bearer JWT | Historial propio y saldo real. |
| `GET/POST` | `/api/reports/…` | Bearer JWT | Validación/confiabilidad/estado/denuncia HU5. |
| `GET` | `/api/places/:id/history`, `comparison`, `quiet-hours` | Bearer JWT | Análisis histórico HU6; no predicción. |

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

Se conserva migrateReports de Manu (`d49578c`) y sus claves históricas, junto al POST/formulario e historial/puntos ya conciliados en el candidato. Las004 de detalle y reportes conservan nombres independientes;005/006 hacen compatibilidad/premio explícitos. No reescribirlas ni premiar reportes históricos retrospectivamente.

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

Esta comprobación requiere PostgreSQL local y permiso de crear bases: crea o reutiliza exclusivamente `crowdradar_hu31_test`, nunca usa `DB_NAME` como destino. Verifica idempotencia, preservación de una tabla `users` centinela, restricciones SQL, fixture repetible y exclusión de inactivos. Incluye HU 3.5 con repositorio ORM y HTTP real sobre PostgreSQL; solo la consulta de sesión se dobla, porque `users` centinela no es el esquema de autenticación. Comprueba catálogo, igualdad literal, cambio/quitar filtro, ausencia de coincidencias y 400/401. Sus fixtures adicionales se revierten y se comparan las filas de lugares/usuarios antes y después. La base aislada se conserva para inspección. No la uses para datos personales.

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
