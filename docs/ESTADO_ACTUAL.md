# Estado actual

## Hito B — HU 2.3, 08/10/2026

Rama dependiente `feature/hu-2-3-cambio-password`, padre HU 3.1 `c2aa7c0a098e2b4a26557edf1170e3cb1582696b` (PR #26 pendiente). Frontend compañero parte del hito A `0361ae13017def4d9c135a78b3b95ab1f07bf635`. Sin integración en develop/main.

Cambio autenticado con contraseña actual/nueva/confirmación, bcrypt 8 caracteres Unicode/72 bytes UTF-8, rechazo de reutilización. La actualización transaccional bloquea el usuario y aumenta `sessionVersion`; JWT anteriores (también legacy sin claim) se rechazan. El cierre local HU 2.4 sigue sin revocar por sí mismo.

Migración explícita `002-users-session-version`: esquema users baseline en DB nueva, columna aditiva en la existente, historial/idempotencia. Ya no hay User.sync ni DDL al arrancar; falta de migración impide iniciar con instrucción pública. Ver configuración y contrato.

- `npm test`: 36 aprobadas, 0 fallidas. Primer intento restringido bloqueó loopback; la ejecución real detectó un nombre local que sombreaba el validador (TDZ), corregido y reejecutado. Regresión PostgreSQL lugares: cuatro comprobaciones aprobadas; sintaxis de 40 JS y diff correctos.
- `npm run test:db:auth`: PostgreSQL 18 real, exclusivamente `crowdradar_auth_test`; base limpia, actualización/preservación e idempotencia, CHECK negativo, arranque sin DDL, dos cambios concurrentes (200/401), hash/version persistidos, JWT anterior rechazado, nuevo login y rollback tras fallo posterior al UPDATE.
- Aplicación a `crowdradar_dev`: sus 4 usuarios previos conservaron todos los datos (comparación JSON excluyendo únicamente la nueva columna). Runner repetido sin cambios; servidor reiniciado en 3000. Ninguna conexión a Sprint 1 ni Supabase.

Integración opt-in `test/local_api_smoke_test.dart` frontend: 1/1 con widgets VM y HTTP real contra este servidor/crowdradar_dev. Registro/login/perfil → formulario → actual incorrecta → éxito → cierre/aviso → ruta protegida bloqueada; JWT viejo 401 y login nuevo correcto. No es navegador ni Android. La cuenta QA queda identificable y sus credenciales aleatorias solo vivieron en memoria.

Recorrido manual Chrome/Android pendiente; los registros siguientes son históricos y no describen la política de sesiones nueva.

## Registro histórico — cierre local HU 3.1 / Web, 07/10/2026

Fotografía de la validación local del 07/10/2026, anterior a su publicación: ambos repositorios estaban en `feature/hu-3-1-mapa-lugares`, sin staging/commit/publicación. Bases conservadas en esa revisión: backend `a6da9a72e736bcb18568533a4ec7bf7aa4daa3f3`, frontend `f214886d7a40aabfc3b10b0af1a266128cc421fe`. No se tocaron main, upstream, Issues ni Project durante esa validación. Para conocer la publicación/integración posterior, comprobar Git y los PR relacionados; los resultados siguientes conservan su fecha y alcance.

## Verificación final de este cierre

- PostgreSQL 18 activo. `.env` ignorado apunta a `crowdradar_dev`, localhost:5432; no se imprimieron credenciales. Sin conexión a Supabase ni a `crowdradar_sprint1`.
- **Migración explícita**: `npm run db:migrate` → `001-create-places ya aplicada; sin cambios.` El arranque solo autentica y conserva `User.sync()`; nunca ejecuta la migración de `places`. Fixtures restringidos a las dos bases locales; migración portable con barreras para entrega/sistema/Supabase.
- `npm test`: **24 aprobadas, 0 fallidas, 0 omitidas**, código 0. `npm run test:db:places`: 4 comprobaciones aprobadas (idempotencia/preservación, cuatro rechazos SQL con rollback, fixture repetible, exclusión de inactivos). `node --check`: **35 JS** correctos. `git diff --check`: código 0; solo avisos de normalización LF/CRLF.
- Backend real reiniciado tras la caída controlada, puerto 3000; `GET /` → 200 `{"message":"CrowdRadar API"}`. Migración y fixture demostrativo repetidos sin duplicación.
- Cuenta desechable **Rael Chang** registrada desde Flutter Web, correo QA único y contraseña aleatoria solo en memoria de la prueba. SQL confirmó `current_database() = crowdradar_dev`, nombre/apellido, distrito, teléfono de 9 dígitos y bcrypt (sin imprimir hash). Los 3 lugares activos son demostrativos.
- Web real: registro, duplicado, validaciones, login, contraseña incorrecta, mapa/selección, cierre/guardas y backend apagado comprobados en navegador integrado. `flutter run -d chrome` lanzó Chrome normal, pero el recorrido interactivo de ese Chrome no pudo completarse con el control disponible: **no equiparar la prueba IAB a una prueba manual en Chrome normal**. Detalle/capturas en ESTADO_ACTUAL del frontend.
- Frontend final: análisis sin problemas, **69/69 pruebas**, build Web correcto (`58,7 s`, código 0), sin nuevas dependencias. Android anterior del día se conserva como evidencia histórica; no se repitió tras las últimas mejoras de login/registro.

Configuración DB por variables/URL, TLS verificado y CORS explícito se cubren con dobles y CORS local; no se validó despliegue remoto. El fixture opcional de usuario no tiene contraseña predeterminada y no se ejecutó con una credencial demo persistida: la cuenta manual se creó por la interfaz. Solo el registro añade una validación pequeña del límite bcrypt de 72 bytes; recuperación/cambio de contraseña no se implementaron.

Pendientes: revisión/publicación autorizada de HU 3.1, recorrido Chrome de otro integrante, clonación limpia del incremento (todavía no publicado), migración `users`, E2E automático integral y fuente canónica. No se declaran HU 2.1–2.3, HU 3.2 ni HU 3.3 terminadas. Los registros siguientes son históricos del estado de cada ejecución, no instrucciones vigentes; README/CONFIGURACION controlan la ejecución actual.

## Inventario final para revisión (sin staging)

28 archivos: 9 modificados y 19 nuevos. Incluye trabajo local anterior conservado. Salida de `git status --porcelain=v1 --untracked-files=all` desde la raíz backend:

```text
 M .env.example
 M README.md
 M app.js
 M docs/CONFIGURACION_LOCAL.md
 M docs/ESTADO_ACTUAL.md
 M docs/PLAN_TECNICO_SW2.md
 M package.json
 M src/config/database.js
 M src/services/AuthService.js
?? scripts/migrate.js
?? scripts/seed-demo-user.js
?? scripts/seed-places-demo.js
?? scripts/verify-places-db.js
?? src/config/environment.js
?? src/controllers/PlaceController.js
?? src/database/databaseSafety.js
?? src/database/migratePlaces.js
?? src/database/seedDemoUser.js
?? src/database/seedPlacesDemo.js
?? src/models/Place.js
?? src/repositories/PlaceRepository.js
?? src/routes/place.routes.js
?? src/services/PlaceService.js
?? test/database-lifecycle.test.js
?? test/demo-user.test.js
?? test/environment.test.js
?? test/password-boundary.test.js
?? test/places.test.js
```

Revisión: `.env` no rastreado e ignorado, node_modules ignorado, sin asignaciones locales de contraseña/JWT detectadas en textos ni candidatos generados o mayores de 5 MB. `package-lock.json` y `entrega/` sin diferencias. Solo se añadieron comandos en package.json, no dependencias. `HEAD = develop = origin/develop`, diferencia `0 0` en referencias locales; los cambios están en archivos. `origin/main` conserva `1130a900d1e02c390c3acf5a8c3964077a44a34d`. La rama local main preexistente apunta a `828a6aaadb2ec52ea57855c3aeffe8b4f27f6e72`/upstream/main, no a la entrega: se informó, no se corrigió ni tocó fuera de alcance. Origin sigue siendo Rael, upstream Walturx; no hubo operaciones remotas de escritura.

## Registro inicial HU 3.1 — 07/10/2026

Rama `feature/hu-3-1-mapa-lugares`, base `develop` / `a6da9a72e736bcb18568533a4ec7bf7aa4daa3f3`. Al comenzar, ambos repositorios estaban limpios y sincronizados después de `git fetch --no-tags origin`; frontend desde el merge HU 2.4 `f214886d7a40aabfc3b10b0af1a266128cc421fe`. No se crearon commits ni se publicaron cambios.

- `GET /api/places` usa el middleware JWT existente y la estructura controlador → servicio → repositorio → modelo. Lista solo activos, en orden de ID, con coordenadas finitas y dentro de rango. El error devuelve 503 sin detalles de DB.
- Se sustituyó la sincronización global por migración transaccional de `places` y el `User.sync()` histórico, sin `force` ni `alter`. Historial `crowdradar_migrations`, bloqueo transaccional para concurrencia y rechazo de tabla preexistente sin historial. Guardas explícitas impiden migrar fuera de las dos bases locales admitidas.
- Primero se probó en `crowdradar_hu31_test`: migración repetida sin cambios, historial único, estructura y contenido de `users` centinela conservados, cuatro rechazos SQL de rango/NaN/infinito (código PostgreSQL `23514`), fixture repetido sin duplicados y exclusión de inactivos. No se borraron tablas ni bases.
- Después se aplicó a `crowdradar_dev`. Una comparación SHA-256 de filas y columnas antes/después confirmó `users` intacta (2 usuarios). Se cargaron explícitamente tres lugares con `demostrativo=true`. No se conectó a `crowdradar_sprint1` ni a Supabase.
- `npm test`: **12 pruebas, 12 aprobadas, 0 fallidas, 0 omitidas**. `node --check`: **27 archivos JS**, sin errores. `npm run test:db:places`, `db:migrate` repetido y `db:seed:demo` repetido: código 0. `git diff --check`: sin errores.
- Servidor real en puerto 3000: `GET /` 200; `/api/places` sin token 401; con JWT local 200 y los tres lugares. Login real desde Android y consulta del mapa funcionaron.

Android 16/API 36 compiló e instaló el frontend: login, mapa OpenStreetMap, tres marcadores, identificación breve, backend apagado con error comprensible y reintento correcto tras reiniciar. Evidencias locales en `CrowdRadar-FrontEnd/docs/evidencias/hu_3_1/2026_10_07` dentro de la carpeta general. La advertencia XML del SDK no impidió compilar.

Limitaciones: catálogo real pendiente; fixtures ilustrativos, sin saturación ni tiempo real. La migración cubre solo `places`, no resuelve la deuda de `users`. No hay despliegue, edición de lugares ni rollback destructivo. La base de prueba se conserva. Dependencias y `package-lock.json` sin cambios; `package.json` añade únicamente comandos. HU 3.2 y HU 3.3 no se implementaron ni se marcaron terminadas; Issues/Project no se modificaron.

## Registro histórico — 22/09/2026

Esta línea base se trabajó en `develop`. Los commits de entrega permanecen intactos en `main` y en el tag `sprint1-entrega-2026-09-22`. Los SDK se instalaron fuera de los repositorios. El `.env` local no se publica.

## Entorno

Windows 11 25H2 (build 26200.9457); Git 2.51.0.windows.1; Node 22.20.0; npm 10.9.3; PostgreSQL 18; Java 21.0.7; Flutter 3.41.9 estable; Dart 3.11.5; Android SDK Platform/Build-Tools 36.0.0; platform-tools/ADB 37.0.1; emulador 37.1.11.0, Android 16 API 36. Flutter 3.41.9 reproduce el hash de `.metadata` del frontend.

`flutter doctor -v` aprobó Flutter, Windows, Chrome, Visual Studio, dispositivo Android y red. Muestra una advertencia en Android por seis licencias **opcionales** (Google TV, XR, ARM DBT, SDK Preview, Glass y MIPS), no requeridas por la compilación realizada. Las licencias de Platform, Build-Tools, NDK y CMake usadas por el proyecto sí fueron aceptadas. El emulador inició y el APK se instaló.

## Validaciones y resultado real

| Área | Comprobación | Resultado |
| --- | --- | --- |
| Backend | `npm ci` | Correcto; 151 paquetes desde `package-lock.json`; lockfile sin cambios. |
| Backend | Clonación local limpia de `develop` | Sin `node_modules` ni `.env` al inicio; `npm ci` instaló 151 paquetes, `npm test` pasó 4/4 y el servidor arrancó con variables de entorno externas en el puerto 3001; `GET /` devolvió 200. La clonación temporal se eliminó tras la prueba. |
| Backend | `npm test` | 4 aprobadas, 0 fallidas. |
| Backend | `node --check` en 16 archivos JS | Sin errores sintácticos. |
| Backend | `npm audit` | 5 vulnerabilidades: 3 moderadas, 2 altas; paquetes señalados: `brace-expansion`, `fast-uri`, `qs`, `sequelize` y `uuid`. No se ejecutó `npm audit fix --force` ni se cambiaron dependencias. |
| PostgreSQL | `crowdradar_dev` | Base separada creada; `sequelize.sync()` creó `public.users`. `crowdradar_sprint1` conservó su registro previo (conteo: 1). No se tocó Supabase. |
| HTTP real | `GET /`; registro; login; perfil; actualización; perfil posterior | 200; 201; 200; 200; 200; 200 contra `crowdradar_dev`. Credenciales incorrectas: 401; actualización inválida: 400. |
| Frontend | `flutter pub get` | Correcto, `pubspec.lock` sin cambios. Hay 15 paquetes más nuevos incompatibles con las restricciones actuales; no se actualizaron. |
| Frontend | `flutter analyze` | Sin problemas. |
| Frontend | `flutter test` | 1 prueba aprobada. |
| Frontend | `flutter build apk --debug` | Correcto; APK debug de 162 915 859 bytes, generado en `build/app/outputs/flutter-apk/app-debug.apk` (ignorado por Git). |
| Android | Instalación y apertura en emulador | Correcto en Android 16 API 36, `emulator-5554`. |

Desde la interfaz Android se registró `androidbaseline20260922@example.com`, se inició sesión, se consultó el perfil y se actualizaron apellido, teléfono y distrito. Una consulta SQL posterior en `crowdradar_dev.public.users` confirmó `Rael | BaselineSW2 | 900000004 | Miraflores`. Son datos de prueba, no cuentas de producción. Capturas: [registro correcto](evidencias/android-register-result.png), [login correcto](evidencias/android-login-success.png), [perfil inicial](evidencias/android-profile.png), [perfil actualizado](evidencias/android-profile-updated.png).

Casos negativos verificados desde Android: [campos vacíos](evidencias/android-invalid-fields.png) muestran validaciones; [contraseña incorrecta](evidencias/android-wrong-login-result.png) muestra «Correo o contraseña incorrectos.»; con el backend apagado, [login](evidencias/android-backend-off.png) muestra un `ClientException with SocketException: Connection refused (OS Error: Connection refused, errno = 111)` hacia `10.0.2.2`. La app no se cierra, pero el mensaje de red es técnico y debe mejorar. Se reinició el backend y `GET /` volvió a responder 200.

## Hallazgos pendientes

- El esquema depende de `sequelize.sync()` en el arranque; no existen migraciones versionadas para cambios futuros.
- Las cinco alertas de `npm audit` requieren revisión selectiva y pruebas de regresión; una recomendación automática propone un cambio mayor incompatible de Sequelize, por eso no se aplicó.
- El token del frontend permanece en memoria; tras reiniciar la app se requiere login. No hay flujo de recuperación de sesión/expiración validado.
- El error por backend apagado se muestra como excepción técnica; el flujo principal no queda bloqueado.
- La compilación emite advertencias de AGP/SDK XML y APIs Gradle obsoletas; no impidieron el APK. En este equipo, el primer intento falló con `java.io.IOException: Unable to establish loopback connection` por la carpeta temporal de Windows. Se resolvió para la sesión de compilación usando una ruta TEMP/TMP corta, sin modificar el proyecto.
- No se realizó prueba en teléfono físico, APK release ni despliegue remoto.
