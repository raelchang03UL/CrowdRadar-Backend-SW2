# CrowdRadar Backend - Sprint 1

API REST para las historias del Sprint 1: registro, inicio de sesión, consulta del perfil y actualización del perfil. Está construida con Node.js, Express, Sequelize y PostgreSQL.

## Requisitos

- Node.js y npm.
- PostgreSQL en ejecución.
- Una base de datos local y credenciales con permisos para crear/actualizar la tabla `users`.

En la revisión local del 20/09/2026 se usaron Node.js 22.20.0, npm 10.9.3 y PostgreSQL 18.

## Configuración

1. Instala las dependencias:

   ```powershell
   npm ci
   ```

2. Crea la base de datos desde `psql` o pgAdmin:

   ```sql
   CREATE DATABASE crowdradar_sprint1;
   ```

3. Copia `.env.example` como `.env` y reemplaza los valores locales:

   ```powershell
   Copy-Item .env.example .env
   ```

   Variables requeridas:

   - `DB_HOST`: host de PostgreSQL, normalmente `127.0.0.1`.
   - `DB_PORT`: puerto de PostgreSQL, normalmente `5432`.
   - `DB_NAME`: nombre de la base, por ejemplo `crowdradar_sprint1`.
   - `DB_USER`: usuario de PostgreSQL.
   - `DB_PASSWORD`: contraseña del usuario.
   - `JWT_SECRET`: secreto largo y aleatorio para firmar tokens.
   - `PORT`: puerto HTTP, por defecto `3000`.

   `.env` está ignorado por Git. No publiques credenciales.

## Ejecución

```powershell
npm start
```

Al iniciar, Sequelize sincroniza el modelo `User` una sola vez. La respuesta de control está disponible en `GET http://localhost:3000/`.

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

Ejemplo de registro:

```json
{
  "nombre": "Ana",
  "apellido": "Ruiz",
  "email": "ana.ruiz@correo.pe",
  "password": "ClaveSegura123",
  "telefono": "987654321",
  "distrito": "Lima"
}
```

Para las rutas protegidas usa el token retornado por login:

```text
Authorization: Bearer <token>
```

## Pruebas

```powershell
npm test
```

Las pruebas HTTP de `test/sprint1.test.js` levantan Express en un puerto efímero y reemplazan únicamente el repositorio por memoria. Comprueban rutas, validaciones, bcrypt y JWT sin modificar PostgreSQL. La persistencia contra PostgreSQL debe verificarse aparte con un `.env` local válido.

## Verificación local

El 20/09/2026 se verificó el arranque contra PostgreSQL 18 usando exclusivamente la base `crowdradar_sprint1`. Sequelize creó `public.users` y se completó por HTTP el flujo de registro, login, consulta de perfil, actualización y consulta posterior. La evidencia está en `../entrega/evidencias/backend-e2e-postgresql.txt`.
