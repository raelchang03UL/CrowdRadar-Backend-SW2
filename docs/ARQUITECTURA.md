# Arquitectura backend

Corte local R01,17/10/2026; código no publicado. API monolítica por capas: app/rutas/JWT→controladores→servicios→repositorios/modelos→PostgreSQL. Se conserva Express,Sequelize,JWT,bcrypt ySMTP de Diego. No se implementan microservicios ni Supabase Auth.

## Responsabilidades y decisiones

- Composición en app.js: CORS exacto,JSON,rutas e inyección del servicio de recuperación. startServer valida entorno,autentica ycomprueba esquema conSELECT antes de escuchar. CLI de migraciones separado; nunca DDL por arranque/petición.
- Controladores traducenHTTP/DTO/errores públicos. Auth yperfil no devuelven detalles SQL; hashes yversiones no pertenecen al perfil. BIGINT karma se valida/normaliza a entero seguro.
- Servicios conservan reglas: bcrypt8 caracteres/72bytes; JWT2h/versión persistida; token de reset aleatorio/hash/15min/uso único. Cambio/reset bloquean usuario,invalidan enlaces yversiones en una transacción. Logout sigue siendo local.
- PlaceService valida coordenadas yDTO; búsqueda/categoría/nivel forman una consulta AND. SaturationQueryService es función de política compartida: último reporte/persona,3 personas/30min,empate insuficiente. No calcula aforo.
- SaturationReportRepository: usuario FOR UPDATE,revalidar sesión,lockusuario-lugar,validar lugar/cooldown con relojSQL,INSERT reporte/ledgerPK yUPDATEkarma en una transacción. Alternativa premiar después desdeUserService permitía escrituras parciales; se retira ese helper no usado yse conserva la consulta dekarma deManu. Coste: lock más largo yorden consistente conauth. Concurrencia/rollback reales probados.
- ReportRepository siempre filtra por usuario de JWT. Sin moderación ni acceso ciudadano a recursos administrativos.

## Patrones y límites

Repository es patrón de acceso a datos existente, noGoF; facilita dobles,SQL parametrizado ytransacciones explícitas. No se añade GenericRepository ni se ocultan locks. createSaturationReportRepository es construcción/composición inyectable, noFactoryMethod por nombre.

Adapter SMTP de objeto existente: PasswordRecoveryService→contrato sendResetLink/sendPasswordChangedNotification→RecoveryMailDelivery→Nodemailer. Frente aSMTP dentro del negocio, aísla transporte ypermite dobles. El coste es mantener ambos métodos/promesas/errores. ColaRAM sin reintentos ni durabilidad; no se reimplementó al consolidar.

Readiness específico frente aSchemaManager dinámico: sigue los guardsauth/recovery ycomprueba historial/columnas. C1 corrigió disponibilidad falsa de detalle. No se añadieron capas ni se movieron carpetas para aparentarSOLID. Cubit es presentación reactiva frontend,noGoFState; funcionescreate no demuestranFactoryMethod.

## Esquema e integridad

001places,002usuarios/versión,003recuperación y004direccion/reportes conservan sus migraciones publicadas. Dos identidades004 de reportes:005 transición explícita normaliza tipo/FK/índice sin borrarfilas ni marcar la004canónica comoejecutada enlegacy.006 añade karma yledger único porreporte; no inventa premios retrospectivos. Runner protegido por databaseSafety; las bases históricas/Supabase siguen bloqueadas.

## Evidencia y alcance

130 pruebas Node HTTP/dobles y6bloques PostgreSQL18 real en dosbases nuevas: creación/legacy,idempotencia,concurrencia,preservación,201/409,rollback ysesión. Ver ESTADO_ACTUAL para versiones/límites. No acreditaSMTP real,Android ni despliegue. Audit heredado10avisos pendiente de corrección compatible.

[UML editable](modelos/consolidacion.puml): componentes ysecuencia de reporte. Fuente revisada, no renderizada conPlantUML en esta sesión; no se instaló un renderizador. Para futura nube ver CONFIGURACION_LOCAL/plan; no afirmar compatibilidad serverless porque existaexportdefaultapp.
