# Entrega del Sprint 1 - CrowdRadar

## Alcance

El Sprint 1 cubre las historias `1.1` a `1.4`: iniciar sesión, registrar ciudadano, visualizar el perfil y actualizar el perfil. La duración definida en el informe es de dos semanas.

El equipo histórico se conserva tal como aparece en el PDF y en la hoja de historias. Rael Chang se incorpora como integrante actual de apoyo en integración, verificación y preparación de esta entrega.

## Ubicación de los proyectos

- Frontend publicado: `https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2`
- Backend publicado: `https://github.com/raelchang03UL/CrowdRadar-Backend-SW2`

Ambos repositorios trabajan en la rama `entrega-sprint-1`. El remoto `origin` apunta a los repositorios de Rael Chang y `upstream` conserva los repositorios públicos originales de Walturx. La publicación se realiza únicamente a `origin`; no se hace push a `upstream`.

## Estado verificado

- El backend contiene las cuatro rutas del Sprint 1.
- Las pruebas HTTP con repositorio en memoria pasan para registro, login/JWT, consulta y actualización de perfil.
- PostgreSQL 18 está instalado, el servicio está activo y el backend conecta a `crowdradar_sprint1`.
- Sequelize creó `public.users` y el flujo HTTP real de registro, login, perfil y actualización fue aprobado contra PostgreSQL.
- Flutter/Dart y el SDK Android no están instalados en esta PC. El frontend fue revisado estáticamente, pero no se afirmó compilación ni ejecución.
- El archivo `.env` del backend no se incluye en el repositorio porque contiene credenciales locales; solo se publica `.env.example`.

## Orden recomendado para la demostración

1. Mantener PostgreSQL y el backend local en ejecución.
2. Instalar/verificar Flutter y Android SDK con `flutter doctor`.
3. Ejecutar `flutter pub get` y `flutter test`.
4. Iniciar un emulador y ejecutar Flutter con la URL local del backend.
5. Demostrar registro, login, consulta y actualización del perfil desde Android, guardando capturas reales.

## Archivos de entrega

- `Sprint_Backlog_CrowdRadar.xlsx`: planificación, estado y evidencias.
- `EVIDENCIAS_SPRINT_1.md`: comandos, resultados y limitaciones verificadas.
- `evidencias/backend-tests.txt`: salida real de las pruebas automatizadas del backend.
- `evidencias/backend-e2e-postgresql.txt`: resultado del flujo HTTP real con persistencia PostgreSQL.
