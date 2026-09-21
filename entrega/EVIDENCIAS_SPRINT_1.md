# Evidencias reales del Sprint 1

Fecha de verificación: 20/09/2026

## Repositorios y ramas

- Frontend base: commit `71ec715` (`Sprint 1`).
- Backend base: commit `828a6aa` (`Comit final`).
- Rama local en ambos: `entrega-sprint-1`.
- Frontend `origin`: `https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2.git`.
- Backend `origin`: `https://github.com/raelchang03UL/CrowdRadar-Backend-SW2.git`.
- Frontend `upstream`: `https://github.com/Walturx/CrowdRadar-FrontEnd.git`.
- Backend `upstream`: `https://github.com/Walturx/CrowdRadar-Backend.git`.
- La publicación se limita a `origin`; no se hace push a `upstream`.

## Entorno disponible

| Componente | Resultado real |
| --- | --- |
| Git | 2.51.0.windows.1 disponible. |
| Node.js | 22.20.0 disponible. |
| npm | 10.9.3 disponible. |
| Java | 21.0.7 disponible. |
| PostgreSQL | Servicio `postgresql-x64-18` activo; puerto 5432 accesible. |
| Base PostgreSQL usada | `crowdradar_sprint1`; conexión confirmada con el usuario `postgres`. |
| Flutter y Dart | No encontrados en `PATH`. |
| Android SDK | No detectado. |

El archivo `.env` no se incluye en los commits porque contiene las credenciales de la base local. La configuración publicable se documenta mediante `.env.example`.

## Pruebas ejecutadas

### Backend

Comando:

```powershell
npm test
```

Resultado: 4 pruebas aprobadas, 0 fallidas.

1. HU 1.2 registra al ciudadano, evita correo duplicado y verifica el hash bcrypt.
2. HU 1.1 inicia sesión, genera un JWT y rechaza una contraseña incorrecta.
3. HU 1.3 exige JWT para consultar el perfil y no expone `passwordHash`.
4. HU 1.4 actualiza datos, los devuelve en la consulta siguiente y rechaza un nombre inválido.

Estas pruebas usan el servidor Express real y las rutas reales; sustituyen el repositorio por memoria para aislar la lógica. La salida completa está en `evidencias/backend-tests.txt`.

### Arranque del backend

Comando:

```powershell
npm start
```

Resultado: inicio correcto en el puerto 3000. `GET /` respondió HTTP 200 con `{"message":"CrowdRadar API"}`.

### PostgreSQL

- Conexión confirmada exclusivamente a `crowdradar_sprint1`.
- Sequelize creó `public.users` con 11 columnas.
- Se registró el usuario de prueba `codex.sprint1.20260920222357094@example.com`.
- Registro HTTP 201, login HTTP 200 con JWT, consulta de perfil HTTP 200 y actualización HTTP 200.
- Una consulta posterior devolvió `Ciudadano Actualizado`, teléfono `912345678` y distrito `Miraflores`.
- La fila persistida tiene rol `USUARIO`, estado `ACTIVO` y un hash bcrypt de 60 caracteres distinto de la contraseña.
- La salida del flujo está en `evidencias/backend-e2e-postgresql.txt`.

### Frontend

No se ejecutaron `flutter pub get`, `flutter test` ni `flutter run` porque `flutter` y `dart` no están instalados. El código fue revisado, pero la compilación queda pendiente y se registra como bloqueo.

## Fuentes de planificación

- `../Grupo 04 - Informe (1).pdf`, en especial roles, Release 01, Sprint 1 y Anexo A.
- Hoja pública `Historias de Usuario`, pestaña `Sprint1`, enlazada desde el PDF.
- Código fuente local de frontend y backend.

## Limitaciones honestas

- No existe evidencia de compilación o ejecución Flutter en esta revisión.
- No se realizaron pruebas end-to-end móvil-backend-base de datos; sí se completó el flujo API-backend-PostgreSQL.
- El backlog marca como completadas únicamente las tareas de persistencia PostgreSQL comprobadas; las tareas que requieren Flutter/Android siguen en revisión o bloqueadas.
