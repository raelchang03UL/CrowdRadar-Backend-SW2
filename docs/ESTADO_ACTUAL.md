# Estado técnico verificado — 22/09/2026

Esta línea base se trabajó en `develop`. Los commits de entrega permanecen intactos en `main` y en el tag `sprint1-entrega-2026-09-22`. Los SDK se instalaron fuera de los repositorios. El `.env` local no se publica.

## Entorno

Windows 11 25H2 (build 26200.9457); Git 2.51.0.windows.1; Node 22.20.0; npm 10.9.3; PostgreSQL 18; Java 21.0.7; Flutter 3.41.9 estable; Dart 3.11.5; Android SDK Platform/Build-Tools 36.0.0; platform-tools/ADB 37.0.1; emulador 37.1.11.0, Android 16 API 36. Flutter 3.41.9 reproduce el hash de `.metadata` del frontend.

`flutter doctor -v` aprobó Flutter, Windows, Chrome, Visual Studio, dispositivo Android y red. Muestra una advertencia en Android por seis licencias **opcionales** (Google TV, XR, ARM DBT, SDK Preview, Glass y MIPS), no requeridas por la compilación realizada. Las licencias de Platform, Build-Tools, NDK y CMake usadas por el proyecto sí fueron aceptadas. El emulador inició y el APK se instaló.

## Validaciones y resultado real

| Área | Comprobación | Resultado |
| --- | --- | --- |
| Backend | `npm ci` | Correcto; 151 paquetes desde `package-lock.json`; lockfile sin cambios. |
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
