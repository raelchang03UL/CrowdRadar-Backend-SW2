# CrowdRadar Backend

API REST para registro, inicio de sesión, consulta y actualización del perfil. El incremento local HU 3.1 añade lectura autenticada de lugares. Está construida con Node.js, Express, Sequelize y PostgreSQL.

Para colaborar con el equipo y usar IA sobre el código, empieza por [CONTRIBUTING.md](CONTRIBUTING.md) y [AGENTS.md](AGENTS.md). Las guías de [coordinación](docs/COORDINACION_EQUIPO.md), [arquitectura](docs/ARQUITECTURA.md) y [contrato API](docs/CONTRATO_API.md) viajan con el repositorio. `develop` reúne los aportes integrados de los siete: publicar una rama permite revisarla, pero no incorpora su trabajo a la base común hasta integrar el PR.

## Requisitos

- Node.js y npm.
- PostgreSQL en ejecución.
- Una base de datos local y credenciales con permisos para crear/actualizar la tabla `users`.

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

El arranque autentica la conexión y conserva el mecanismo histórico `User.sync()` sin `force` ni `alter`; su migración formal sigue pendiente. **No crea ni migra `places` al arrancar.** Ejecuta antes `npm run db:migrate`. La respuesta de control está disponible en `GET http://localhost:3000/`.

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

## Endpoints del Sprint 1

| Método | Ruta | Autenticación | Propósito |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | No | Registrar un ciudadano. |
| `POST` | `/api/auth/login` | No | Validar credenciales y obtener JWT. |
| `GET` | `/api/users/profile` | Bearer JWT | Consultar el perfil autenticado. |
| `PUT` | `/api/users/profile` | Bearer JWT | Actualizar nombre, apellido, teléfono o distrito. |
| `GET` | `/api/places` | Bearer JWT | Listar lugares activos con coordenadas válidas. |

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

Opcionalmente, `npm run db:seed:user-demo` crea **Rael Chang** mediante el mismo registro/bcrypt, con `DEMO_USER_EMAIL` y `DEMO_USER_PASSWORD` suministrados solo en la sesión local. No hay valores predeterminados. Ejecuta después del primer arranque que prepara `users`; si existe otra cuenta/contraseña no la sobrescribe. No guardar esas variables en documentos ni Git.

Para las rutas protegidas usa el token retornado por login:

```text
Authorization: Bearer <token>
```

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

## Estado verificado

El 22/09/2026 se verificaron arranque y flujo HTTP contra `crowdradar_dev`, y el frontend Android completó registro, login, perfil y actualización contra esta base. `crowdradar_sprint1` no se modificó. Consulta [ESTADO_ACTUAL.md](docs/ESTADO_ACTUAL.md) para resultados, límites y evidencias; [PLAN_TECNICO_SW2.md](docs/PLAN_TECNICO_SW2.md) para prioridades. La evidencia histórica del Sprint 1 permanece en [entrega](entrega/).
