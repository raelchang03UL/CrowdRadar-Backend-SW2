# Configuración local desde una clonación limpia

Línea base comprobada en Windows 11 con Node 22.20.0, npm 10.9.3, PostgreSQL 18, Java 21.0.7, Flutter 3.41.9/Dart 3.11.5 y Android SDK Platform/Build-Tools 36. Los SDK van fuera de los repositorios. No uses la base `crowdradar_sprint1` ni Supabase para desarrollo.

## 1. Clonar ambos repositorios

**Vigencia (10/10/2026):** `develop` ya integra HU 3.1, el pulido A, HU 2.3 (B) y HU 2.1–2.2 (C): backend #26, #29 y #30; frontend #9, #11, #12 y #13. Clonar `develop` incluye las migraciones 001–003 y sus pantallas. Siguen en revisión, sin integrar, el envío real de correo (backend #31, `feature/hu-2-1-correo-smtp`) y el arreglo del mapa Web (frontend #14, `fix/web-referrer-mapa`): hasta su merge, `develop` responde 503 uniforme en la recuperación y el mapa Web muestra las teselas bloqueadas. No se reejecutó una clonación limpia del conjunto integrado; la prueba histórica permanece en ESTADO_ACTUAL. Cada integrante usa su PostgreSQL y secretos locales.

```powershell
$workspaceRoot = Join-Path $env:USERPROFILE 'Documents\CrowdRadar-SW2'
New-Item -ItemType Directory -Path $workspaceRoot -Force | Out-Null
Set-Location $workspaceRoot
git clone -b develop https://github.com/raelchang03UL/CrowdRadar-Backend-SW2.git CrowdRadar-Backend
git clone -b develop https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2.git CrowdRadar-FrontEnd
```

Solo para revisar el correo y el mapa antes de su merge, con ambos clones limpios:

```powershell
git -C CrowdRadar-Backend fetch origin
git -C CrowdRadar-FrontEnd fetch origin
git -C CrowdRadar-Backend switch --track origin/feature/hu-2-1-correo-smtp
git -C CrowdRadar-FrontEnd switch --track origin/fix/web-referrer-mapa
```

Si esas ramas locales ya existen, usar `git switch` y actualizar únicamente con `git pull --ff-only`, sin sobrescribir cambios. Para cualquier tarea nueva, la base es `develop`.

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

La configuración opcional `DATABASE_URL`, `DB_SSL`, `DB_SSL_CA` y `CORS_ORIGINS` está descrita en el README y `.env.example`. Mantén TLS verificado para una futura base remota autorizada. No hay despliegue en esta tarea.

### Recuperación de contraseña — hito C

Al actualizar este incremento, `npm run db:migrate` aplica además `003-password-recovery`: dos tablas nuevas para hashes de enlaces y límites persistentes, sin modificar usuarios ni reescribir 001/002. El arranque exige ese esquema y sigue sin ejecutar DDL. `npm run test:db:recovery` aplica/comprueba 003 exclusivamente en `crowdradar_auth_test` local, conservando los datos de otras ejecuciones.

`PASSWORD_RESET_URL="http://localhost:5500/#/reset-password"` define la base local confiable. Las comillas son obligatorias en `.env`: sin ellas dotenv trata `#/reset-password` como comentario y el arranque con correo se detiene por URL no confiable. El servicio añade el token a la query del fragmento; no utiliza cabeceras del cliente. Fuera de desarrollo/pruebas locales se exige HTTPS. No se admiten credenciales, query ni rutas distintas en la URL configurada. Con correo configurado, el arranque valida esa URL y se detiene si falta o no es confiable; sin correo, la API y el cambio autenticado arrancan aunque falte esa variable.

#### Correo por SMTP (Brevo)

Proveedor: Brevo (plan gratuito) por SMTP mediante `nodemailer`. Gmail se descartó porque la cuenta del proyecto no permitió crear contraseñas de aplicación; el adaptador es SMTP genérico y también funcionaría con Gmail (`smtp.gmail.com`, 465, contraseña de aplicación). Sin variables `SMTP_*`, `/password/forgot` sigue devolviendo 503 `RECOVERY_UNAVAILABLE` uniforme y no consulta cuentas; no hay flag de captura en el servidor normal. Para habilitar el envío en tu PC:

1. Crea tu cuenta Brevo gratuita, verifica tu teléfono y añade un remitente en ⚙️ → Senders, Domains & Dedicated IPs → Senders (confirmar el correo que llega).
2. En ⚙️ → SMTP & API → SMTP genera una clave SMTP. Copia el login (`…@smtp-brevo.com`) y la clave; solo se muestra una vez.
3. En tu `.env` (nunca en `.env.example`, documentos ni capturas compartidas) define `SMTP_HOST=smtp-relay.sendinblue.com`, `SMTP_PORT=587`, `SMTP_USER=<login>`, `SMTP_PASSWORD=<clave>` y `MAIL_FROM=CrowdRadar <remitente verificado>`. `MAIL_FROM` es obligatorio con Brevo.
4. Reinicia `npm start`. El log indica `envío por correo habilitado`. Una configuración incompleta, un puerto inválido o una `PASSWORD_RESET_URL` no confiable detienen el arranque con un mensaje sin secretos.

**Host:** usar `smtp-relay.sendinblue.com`, no `smtp-relay.brevo.com`. El 10/10/2026, desde Perú, `smtp-relay.brevo.com` resolvió al relay `smtp-relay-offshore-southamerica-east-v2`, cuyo certificado (Let's Encrypt) solo incluye nombres `sendinblue.com`; la verificación TLS fallaba (`ESOCKET`, altname inválido) y no se envió nada. Ambos nombres apuntan a la misma IP; con `sendinblue` la validación TLS completa y la autenticación son correctas. No desactivar la verificación de certificados para evitarlo.

El puerto 465 usa TLS directo; cualquier otro exige STARTTLS. La entrega es asíncrona y no se reintenta (cola en memoria): un fallo del proveedor no cambia la respuesta uniforme y solo registra su código (`EAUTH` clave rechazada, `ESOCKET` conexión/certificado), nunca destinatario, enlace ni token. Brevo reescribe el remitente `@gmail.com` a su dominio `brevosend.com` porque no puede firmar en nombre de Gmail; si no llega, revisar spam y Transactional → Logs en Brevo. Las contraseñas y enlaces nunca se escriben en documentos/logs.

Las pruebas construyen `PasswordRecoveryService` con `delivery.sendResetLink({email,resetUrl})` y `delivery.sendPasswordChangedNotification({email})`, y lo inyectan mediante `createApp({recoveryService})`. El transporte de memoria existe solo bajo `test/helpers`; se consulta después de `drainDeliveries()` dentro del proceso de prueba. Los runners QA separan sus presupuestos de abuso mediante un namespace de claves exclusivo de cada ejecución, conservando SQL/umbrales reales. Esto no se aplica al arranque normal.

No declarar HU 2.1/Sprint 2 terminados con un correo capturado: todavía faltan entrega real y recorrido manual de las plataformas afectadas.

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
