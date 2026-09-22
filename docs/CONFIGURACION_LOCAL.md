# Configuración local desde una clonación limpia

Línea base comprobada en Windows 11 con Node 22.20.0, npm 10.9.3, PostgreSQL 18, Java 21.0.7, Flutter 3.41.9/Dart 3.11.5 y Android SDK Platform/Build-Tools 36. Los SDK van fuera de los repositorios. No uses la base `crowdradar_sprint1` ni Supabase para desarrollo.

## 1. Clonar ambos repositorios

```powershell
$workspaceRoot = Join-Path $env:USERPROFILE 'Documents\CrowdRadar-SW2'
New-Item -ItemType Directory -Path $workspaceRoot -Force | Out-Null
Set-Location $workspaceRoot
git clone -b develop https://github.com/raelchang03UL/CrowdRadar-Backend-SW2.git CrowdRadar-Backend
git clone -b develop https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2.git CrowdRadar-FrontEnd
```

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
npm start
```

`npm start` ejecuta `sequelize.sync()` y crea `public.users` si falta; el usuario configurado necesita permiso de creación de tablas. Comprueba `http://localhost:3000/` y en otra terminal `psql -h localhost -U postgres -d crowdradar_dev -c "\dt"`. Aún no hay migraciones versionadas: no uses `sync({ force: true })` en bases con datos. `.env` está ignorado y `.env.example` no contiene secretos reales.

## 3. Android y Flutter

Instala Flutter 3.41.9 estable fuera del repo y añade `<flutter>\bin` al PATH de usuario. Dart viene incluido. Instala Java 21 y Android SDK Command-line Tools, platform-tools/ADB, Platform 36, Build-Tools 36 y un emulador API 36; acepta las licencias de los paquetes instalados. Usa `flutter doctor -v` y `flutter devices` para comprobarlo. No se necesita Android Studio para la compilación por línea de comandos.

Con el backend aún en ejecución:

```powershell
Set-Location (Join-Path $workspaceRoot 'CrowdRadar-FrontEnd')
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
flutter run -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

El APK queda en `build/app/outputs/flutter-apk/app-debug.apk` y no entra a Git. Para teléfono físico, sustituye `10.0.2.2` por la IP LAN de la PC, permite el puerto 3000 en el firewall local y usa la misma red. `localhost` dentro de Android **no** es la PC. El backend acepta HTTP local; esta configuración no es apta para producción.

En esta PC con una ruta de usuario que contiene espacios, Gradle falló inicialmente con `Unable to establish loopback connection`. Se resolvió en la terminal de compilación usando una carpeta temporal corta ya creada (`C:\Users\RAELCH~1\t`) para `TEMP`, `TMP` y `JAVA_TOOL_OPTIONS=-Djava.io.tmpdir=C:\Users\RAELCH~1\t`. Es una contingencia local; no la copies si tu compilación normal funciona.
