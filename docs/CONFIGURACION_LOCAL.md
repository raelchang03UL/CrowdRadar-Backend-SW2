# Configuración local desde una clonación limpia

Línea base comprobada en Windows 11 con Node 22.20.0, npm 10.9.3, PostgreSQL 18, Java 21.0.7, Flutter 3.41.9/Dart 3.11.5 y Android SDK Platform/Build-Tools 36. Los SDK van fuera de los repositorios. No uses la base `crowdradar_sprint1` ni Supabase para desarrollo.

## 1. Clonar ambos repositorios

**Vigencia:** HU 3.1 y los incrementos A/B/C siguen en ramas dependientes de revisión, sin integrar. Clonar `develop` reproduce la base anterior, no las migraciones/pantallas descritas aquí. Para revisar el par final A/B/C publicado, usar `feature/hu-2-1-2-recuperacion` en ambos clones; sus padres y pruebas constan en ESTADO_ACTUAL. No se reejecutó una clonación limpia del incremento; la prueba histórica permanece en ESTADO_ACTUAL. Cada integrante usa su PostgreSQL y secretos locales.

```powershell
$workspaceRoot = Join-Path $env:USERPROFILE 'Documents\CrowdRadar-SW2'
New-Item -ItemType Directory -Path $workspaceRoot -Force | Out-Null
Set-Location $workspaceRoot
git clone -b develop https://github.com/raelchang03UL/CrowdRadar-Backend-SW2.git CrowdRadar-Backend
git clone -b develop https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2.git CrowdRadar-FrontEnd
```

Solo para revisar A/B/C, con ambos clones limpios y las ramas ya publicadas:

```powershell
git -C CrowdRadar-Backend fetch origin
git -C CrowdRadar-FrontEnd fetch origin
git -C CrowdRadar-Backend switch --track origin/feature/hu-2-1-2-recuperacion
git -C CrowdRadar-FrontEnd switch --track origin/feature/hu-2-1-2-recuperacion
```

Si esa rama local ya existe, usar `git switch feature/hu-2-1-2-recuperacion` y actualizar únicamente con `git pull --ff-only origin feature/hu-2-1-2-recuperacion`, sin sobrescribir cambios. Después de los merges autorizados, la base diaria volverá a ser develop.

## 2. Backend y base de datos

Inicia PostgreSQL 18. Desde `psql` o pgAdmin, crea **solo si no existe** la base de desarrollo:

```sql
CREATE DATABASE crowdradar_dev;
```

En PowerShell:

```powershell
Set-Location (Join-Path $workspaceRoot 'CrowdRadar-Backend')
Copy-Item .env.example .env
# Edita .env y coloca la contraseña PostgreSQL y un JWT_SECRET largo y aleatorio propios.
# El bloqueo entre reportes del mismo usuario y lugar dura 3 minutos por defecto.
# Puedes cambiarlo con REPORT_COOLDOWN_MINUTES, usando un entero mayor que cero.
# Mantén DB_NAME=crowdradar_dev, DB_HOST=localhost, DB_PORT=5432 y PORT=3000.
npm ci
npm test
npm run db:migrate
# Opcional: tres lugares ilustrativos, nunca saturación real.
npm run db:seed:demo
npm start
```

`npm start` **no crea ni migra tablas**: `npm run db:migrate` prepara explícitamente `places` y `users`/`sessionVersion`. La migración `002-users-session-version` preserva las columnas y filas históricas; si encuentra un esquema desconocido, se detiene para revisión, sin borrarlo. El arranque autentica y verifica que la migración esté aplicada; ya no usa `User.sync()`. El usuario que migra necesita permiso de creación/alteración de tablas. Comprueba `http://localhost:3000/`; si `psql` no está en PATH, usa `& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -U postgres -d crowdradar_dev -c "\dt"`. `.env` está ignorado y `.env.example` no contiene secretos reales.

Para reproducir el mapa HU 3.1 antes de iniciar el servidor:

```powershell
npm run db:migrate
npm run test:db:places
# Opcional: tres lugares DEMOSTRATIVOS, no una fuente real.
npm run db:seed:demo
npm start
```

Los fixtures solo admiten PostgreSQL local con `crowdradar_dev` o `crowdradar_hu31_test`; la prueba de lugares crea/reutiliza únicamente la segunda y necesita permiso `CREATEDB`. `npm run test:db:auth` usa otra base exclusiva, `crowdradar_auth_test`, para probar usuarios, migración y concurrencia del cambio de contraseña. La migración bloquea destinos históricos/de sistema/Supabase; no se ejecutó remotamente. No borra tablas ni bases. Sin seed se obtiene una lista vacía. Una tabla `places` preexistente sin historial causa un error deliberado: revisar su origen, no borrarla ni usar `force`.

Después de aplicar HU 2.3, inicia sesión de nuevo: los JWT sin `sessionVersion` no se aceptan. El cambio exitoso de contraseña invalida todas las versiones anteriores y exige login en cada cliente; recargar Flutter también pierde su sesión local en memoria. La UI utiliza `POST /api/auth/password/change` con contraseña actual, nueva y confirmación. No hace falta una nueva variable de entorno ni instalar paquetes para este incremento.

La configuración opcional `DATABASE_URL`, `DB_SSL`, `DB_SSL_CA` y `CORS_ORIGINS` está descrita en el README y `.env.example`. `REPORT_COOLDOWN_MINUTES` también es opcional y toma `3` si no se define; controla el periodo de bloqueo de reportes de saturación por usuario y lugar. Mantén TLS verificado para una futura base remota autorizada. No hay despliegue en esta tarea.

### Recuperación de contraseña — hito C

Al actualizar este incremento, `npm run db:migrate` aplica además `003-password-recovery`: dos tablas nuevas para hashes de enlaces y límites persistentes, sin modificar usuarios ni reescribir 001/002. El arranque exige ese esquema y sigue sin ejecutar DDL. `npm run test:db:recovery` aplica/comprueba 003 exclusivamente en `crowdradar_auth_test` local, conservando los datos de otras ejecuciones.

`PASSWORD_RESET_URL=http://localhost:5500/#/reset-password` define la base local confiable. El servicio añade el token a la query del fragmento; no utiliza cabeceras del cliente. Fuera de desarrollo/pruebas locales se exige HTTPS. No se admiten credenciales, query ni rutas distintas en la URL configurada. Un proveedor habilitado debe validar su URL al construir el servicio; sin proveedor, la API y el cambio autenticado arrancan aunque falte esa variable.

El envío real está deshabilitado: todavía no se eligieron proveedor, remitente ni credenciales. No hay variables SMTP ni un flag de prueba que capture enlaces en el servidor normal. `/password/forgot` devuelve 503 `RECOVERY_UNAVAILABLE` de manera uniforme para cualquier correo. Para completar la entrega real falta elegir esos datos e implementar/verificar el adaptador; configurar la URL por sí sola no produce un 202 ni entrega correo. Las contraseñas y enlaces nunca se escriben en documentos/logs.

Las pruebas construyen `PasswordRecoveryService` con `delivery.sendResetLink({email,resetUrl})` y `delivery.sendPasswordChangedNotification({email})`, y lo inyectan mediante `createApp({recoveryService})`. El transporte de memoria existe solo bajo `test/helpers`; se consulta después de `drainDeliveries()` dentro del proceso de prueba. Los runners QA separan sus presupuestos de abuso mediante un namespace de claves exclusivo de cada ejecución, conservando SQL/umbrales reales. Esto no se aplica al arranque normal.

No declarar HU 2.1/Sprint 2 terminados con un correo capturado: todavía faltan entrega real y recorrido manual de las plataformas afectadas.

### Reportes de saturación

La migración `004-saturation-reports` crea la tabla `saturation_reports` al ejecutar `npm run db:migrate`, después de las migraciones anteriores. El endpoint requiere JWT y permite los niveles `TRANQUILO`, `MODERADO` y `SATURADO`. El primer reporte se registra normalmente; los reportes posteriores del mismo usuario para el mismo lugar se rechazan durante `REPORT_COOLDOWN_MINUTES` (3 minutos por defecto). La migración no crea la base PostgreSQL ni modifica el archivo `.env` real.

## 3. Android y Flutter

Instala Flutter 3.41.9 estable fuera del repo y añade `<flutter>\bin` al PATH de usuario. Dart viene incluido. Instala Java 21 y Android SDK Command-line Tools, platform-tools/ADB, Platform 36, Build-Tools 36 y un emulador API 36; acepta las licencias de los paquetes instalados. Usa `flutter doctor -v` y `flutter devices` para comprobarlo. No se necesita Android Studio para la compilación por línea de comandos.

Con el backend aún en ejecución:

```powershell
Set-Location (Join-Path $workspaceRoot 'CrowdRadar-FrontEnd')
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
flutter emulators
# En esta PC: flutter emulators --launch CrowdRadar_API36
# Espera a que Android arranque y consulta el ID real con flutter devices.
flutter run -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

El APK queda en `build/app/outputs/flutter-apk/app-debug.apk` y no entra a Git. Para teléfono físico, sustituye `10.0.2.2` por la IP LAN de la PC, permite el puerto 3000 en el firewall local y usa la misma red. `localhost` dentro de Android **no** es la PC. El backend acepta HTTP local; esta configuración no es apta para producción.

En esta PC con una ruta de usuario que contiene espacios, Gradle falló inicialmente con `Unable to establish loopback connection`. Se resolvió en la terminal de compilación usando una carpeta temporal corta ya creada (`C:\Users\RAELCH~1\t`) para `TEMP`, `TMP` y `JAVA_TOOL_OPTIONS=-Djava.io.tmpdir=C:\Users\RAELCH~1\t`. Es una contingencia local; no la copies si tu compilación normal funciona.

## 4. Flutter Web / Chrome (misma aplicación)

Con backend en puerto 3000, abre otra terminal normal:

```powershell
Set-Location (Join-Path $workspaceRoot 'CrowdRadar-FrontEnd')
# Solo si todavía no están resueltos los paquetes: flutter pub get
flutter run -d chrome --web-hostname=localhost --web-port=5500 --no-pub --dart-define=API_BASE_URL=http://localhost:3000
```

URL: **http://localhost:5500/#/login**. Se conserva el router con fragmento `#/`; `/login` sin `#` no es la URL canónica. `web/index.html` solo inicia Flutter, no es otra aplicación. No desactives la seguridad del navegador. En esta PC Oracle ocupa `127.0.0.1:5500`: no detenerlo. `--web-hostname=localhost` enlazó Flutter a `::1:5500`, y localhost accedió correctamente por IPv6. Si falla, revisa `Get-NetTCPConnection -LocalPort 5500 -State Listen` y la resolución IPv6 de localhost; no cambies silenciosamente a 5000.

Para crear tu cuenta: Regístrate → nombre/apellido/distrito de 2 caracteres o más, correo único válido, contraseña propia de mínimo 8 caracteres y máximo 72 bytes, teléfono de 9 dígitos → Registrarme. El aviso confirma la cuenta y vuelve a login; usa ese mismo correo/contraseña. La cuenta persiste en `crowdradar_dev`; la sesión/JWT solo en memoria: recargar pide login. Nunca publiques la contraseña. El usuario demo opcional se documenta en README, sin claves predeterminadas.

Para reiniciar: en Backend `npm start`; en Frontend repite el comando Chrome anterior. Mantén ambas terminales abiertas; Ctrl+C detiene cada proceso propio. Para validar Web final: `flutter analyze --no-pub`, `flutter test --no-pub` y `flutter build web --no-pub --dart-define=API_BASE_URL=http://localhost:3000`. La carpeta `build/web` está ignorada.
