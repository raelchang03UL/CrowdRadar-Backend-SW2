# Plan técnico SW2

## Puerta actual — 20/10/2026

QA desde cero/legacy y las2opt-in ya ejecutados;no repetirlos como propuesta abierta. Decisiones de dirección ausente y catálogo sinGPS/radio aprobadas porRael20/10,registradas en CONTRATO_API/Issues. Integración del par PR39/21 espera revisión ajena real y smoke del develop resultante. #28completa la revisión con un dictamen de no aceptación global;no convierte el Release en aceptado. HU7/8 y despliegue siguen fuera de implementación.

## Preparación del primer despliegue — 20/10/2026

Plan ejecutable separado del cierre Web HU1–6. HU7/8 continúan pendientes, cuatro Sprints sin cambios. La matriz/Issues controlan aceptación y los PR/Git la integración; esta sección no anticipa sus resultados. No se desplegó ni habilitó Supabase. Se reutilizan [arquitectura](ARQUITECTURA.md#arquitectura-candidata-de-primer-despliegue--20102026) y [procedimiento D0–D6](CONFIGURACION_LOCAL.md#primer-despliegue-procedimiento-condicionado--20102026).

| Orden | Paquete futuro / dependencia | Criterio de salida verificable |
| --- | --- | --- |
| 0 | Identidad del par integrado, propietarios de cuentas/cupo gratuito y autorización de destinos | SHA de ambos `develop`, evidencia Web, operadores y matriz de variables sin secretos; project-ref/hosts/base/roles del Supabase NUEVO aprobados antes de SQL remoto. |
| 1 | Runtime Express/Vercel y revisión de avisos/abuso; depende de0 | Inicialización esperada en frío/caliente/concurrente, sin DDL y sin omitir SMTP/readiness; fallos públicos seguros; política IP/proxy probada y tratamiento individual de audit. |
| 2 | DB remota preparada; depende de1 y permiso remoto específico | Guarda limitada al proyecto nuevo, TLS con rechazo de CA/host incorrectos, roles mínimos efectivos, API sin DDL, migrador separado, migraciones históricas intactas, Data API cerrada, pruebas de locks/rollback/presupuesto del pooler. |
| 3 | Correo en runtime elegido; depende de1–2 y remitente/destinatario autorizados | Recepción/reset/aviso demostrados y comportamiento ante terminación/timeout documentado; decidir durabilidad/reintentos sin confundir waitUntil con cola persistente. Reutilizar AdapterSMTP, no migrar SupabaseAuth. |
| 4 | Build/publicación de ambos artefactos; depende de1–3 y permiso de despliegue | Flutter/Node/locks fijados, URLAPI HTTPS correcta, CORS exacto y secretos solo servidor; smoke real por par publicado y hashes, recuperación funcional y captura sin datos sensibles. |
| 5 | Operación/retirada segura; depende de4 | Logs depurados, límites/cuotas, backup privado y restauración ensayada, rollback de app compatible con esquema y prueba de fallos. No promesa de disponibilidad absoluta. |

D6 (elegibilidad, cuotas y colaboración) se verifica antes de0 y de nuevo al ejecutar cada servicio. El procedimiento canónico contiene la tabla de entradas/salidas D0–D6 y la separación de configuración API/migrador/Web; no duplicar aquí comandos ni secretos. El primer incremento de código futuro es la inicialización serverless esperada y sus pruebas, limitado al problema demostrado del export de `app.js`; no se convierte en un cambio de proveedor ni reescritura.

Rael es responsable de coordinación/preparación e identifica el operador antes de ejecutar; Diego conserva la procedencia del SMTP y participa como referente de su configuración/evidencia; Nick/Manu son consultados si cambian contratos/esquemas de sus aportes. No son nuevas asignaciones automáticas de HU ni Story Points. Tiempo/capacidad/revisor deben acordarse para cada paquete antes de comprometer un Sprint.

### Checklist de una única tarea técnica pendiente

Reutilizar una tarea equivalente si existe; en caso contrario, título propuesto **Preparar primer despliegue Web/API/Supabase nuevo** y responsable `raelchang03UL`, sin fecha/puntos inventados. Crear o actualizar solo bajo autorización vigente, mantener pendiente hasta completar su alcance de preparación y enlazar estas tres guías; no duplicar #28 para sumar tarjetas Done.

- [ ] Par integrado/evidencia y brechas del hosting identificados; condiciones de coste cero y colaboración aceptadas.
- [ ] Paquete mínimo de inicialización, política IP/antiabuso y tratamiento de audit definido y revisado.
- [ ] Identidad Supabase nueva/roles/TLS/pooling/migraciones/Data API y pruebas negativas especificados, sin permisos globales.
- [ ] Operador/remitente/destinatario y decisión de lifecycle/durabilidad SMTP documentados privadamente donde corresponda.
- [ ] Build reproducible, HTTPS/CORS/secretos por entorno y orden API→Web definidos.
- [ ] Logs/cuotas/backups/restauración/rollback y pruebas de fallos con criterios verificables.
- [ ] Solicitud futura única de ejecución enumera destinos, operaciones, datos sintéticos y límite de coste; no hay despliegue implícito.

**Salida de preparación:** checklist con decisiones, responsables operativos, pruebas que se ejecutarán y solicitud concreta de ejecución revisables desde los tres documentos. **Salida de despliegue:** requiere otro paquete autorizado y evidencia real de D0–D6. No cerrar esta tarea como si ya existiera un servicio público por haber redactado el plan; registrar el alcance que efectivamente se complete.

Preparar esta tarea no equivale a desplegarla. Puede permanecer abierta tras aceptar HU1–6; sus riesgos no deben esconderse ni usarse para fabricar un Release02 terminado. HU7 requerirá diseño de autorización administrativa/auditoría; HU8.3 requerirá evento/canal/consentimiento/frecuencia/deduplicación y entrega de alertas. Refinarlas después, sin implementarlas en el cierre actual.

## Situación de cierre — 19/10/2026

I1 resolvió continuidad401;I2 distingue cooldown sin premio de incertidumbre;I3/C2/F11 cubren mapa/perfil/navegación. No reimplementar esas correcciones de las propuestas históricas. Rama de revisión integration/cierre-web-r01-s03-20261019, sin merge/aceptación/despliegue. Siguientes puertas ya identificadas:revisión humana/integración del par,QA desde cero/opt-in/SMTP autorizados y seguridad/runtime antes de nube; no nuevos compromisos por este documento. Estado/evidencia canónicos en ESTADO_ACTUAL/CIERRE_WEB_R01_S03; no depende de la matriz externa para revisar el PR.

## Prioridades anteriores — auditoría19/10 antes de I1/I2/C2/F11

Propuesta, no Sprint Backlog ni autorización de implementación/publicación. Planeamiento actual:4 Sprints (HU 1–2,3–4,5–6,7–8). El candidato local R01/S3 pasa análisis/build y muchas pruebas, pero **no está aceptado ni integrado**; detalles y24 dictámenes en la matriz canónica de la raíz y ESTADO_ACTUAL.

| Prioridad | Área / brecha comprobada | Siguiente paso acotado |
| --- | --- | --- |
| Alto | Autenticación/UX:401en mapa y perfil conserva sesión y ofrece solo Reintentar; Validar sí redirige | Limpiar/redirigir solo generación vigente;401tardío no cierra sesión nueva;503/timeout no cierra sesión. Sin persistencia/revocación nueva. |
| Medio, requisito de aceptación | HU 4.2: rechazo no premia, pero no informa ausencia de puntos; espera restante no disponible | Acordar mensaje/contrato, añadir prueba de rechazo/saldo; no contador ficticio. |
| Alto | Reproducibilidad/pruebas: R01desde cero no repetible en bases existentes;2 opt-in omitidas y sin SMTP real nuevo | Instancia QA nueva o destinos estrictos aprobados, sin borrar bases; revisar runners contra esquema actual. Verificar recepción autorizada, no duplicar adaptador. |
| Alto | Integración:12 PR abiertos y aportes Manu ya incluidos en candidato, pero no develop | Revisar R01 por par/procedencia; elegir una vía que no duplique PR. Después revisar007/HU 5–6 y aceptar por criterio. No HU 7/8 todavía. |
| Alto, antes de Internet | Seguridad/configuración: audit10 paquetes/6 producción, inicialización serverless/colaRAM/IPproxy no resueltas | Paquetes compatibles y verificables; TLS remoto/roles/pooler/destino NUEVO aprobado. No force-fix ni bypass databaseSafety. |
| Medio | Base de datos: migraciones001–007 locales, compatibilidad005/ledger006 probadas históricamente y007 repetida | Permisos efectivos, backups/restauración y revisión de migraciones/retención; no reescribir historia ni migrar bases personales. |
| Medio | Arquitectura frontend/backend y deuda técnica | Conservar capas, AdapterSMTP y Repository/Cubit; mejorar401y legibilidad del código S3 con pruebas. MapPage grande, sin reorganización general ni patrón por cuota. |
| Medio | Pruebas/organización del equipo | CI con versiones/locks y QAefímera en paquete aprobado; revisión humana, contrato y par deSHA. Hoy no hay workflows rastreados. |
| Mejora futura | UX/despliegue | Resumir ficha móvil larga, distinguir lugares homónimos con datos reales y validar accesibilidad. DemoWeb en nube solo tras puertas de CONFIGURACION_LOCAL; no rediseño ahora. |

Próximas5 prioridades:1)401coherente y después mensaje no-premio;2)QA/SMTP reproducibles;3)R01 revisión/integración/aceptación;4)S3 revisión/integración/aceptación;5)puerta de demo segura con servidor/correo/DB aprobados. Reglas uniformes de cuentas ya autorizadas deben conciliarse con Issues heredados; catálogo, políticas provisionales y plataforma de aceptación aún requieren revisión grupal. El detalle del primer paquete401y sus pruebas/criterio está en la matriz, no se ejecuta desde este plan.

## Plan anterior — 08/10/2026 y línea base Sprint1

Las propuestas/resultados inferiores se conservan como antecedentes: referencias a proveedor no elegido, ramas sin integrar y Sprints2–8 no describen el estado vigente. La línea base Sprint1 tuvo evidencia Android/PostgreSQL; no acredita Android del candidato actual.

| Prioridad | Área | Hallazgo y dirección |
| --- | --- | --- |
| Crítico | Reproducibilidad / base de datos | Migraciones explícitas de `places` y `users`/versión de sesión publicadas en ramas de revisión, sin DDL al arrancar. Recuperación añade otra migración aditiva. Revisar/integrar las bases antes de usarlas como línea común; mantener `crowdradar_sprint1` intacta y preparar permisos/backups para despliegue. |
| Alto | Autenticación y seguridad | HU 2.3 invalida sesiones en PostgreSQL; recuperación reutiliza esa política. Falta elegir proveedor/remitente y probar correo real; no cerrar HU 2.1. Mantener HTTPS/secretos fuertes antes de exposición y revisar política de contraseñas/MFA sin cambiarla silenciosamente. Audit histórico: 9 paquetes (5 altos/4 moderados), sin actualización masiva ni nuevo audit en estos incrementos. |
| Alto | Pruebas | C: 51 comprobaciones backend, PostgreSQL auth/recuperación/lugares y 226 Flutter; dos integraciones opt-in aprobadas con widgets+API real. Builds Web/APK correctos. No equivalen a Chrome/Android manual, CI ni entrega de correo; detalle y límites en ESTADO_ACTUAL. |
| Medio | Configuración | DB por variables o URL, TLS verificado opcional y CORS configurable están cubiertos con dobles; solo PostgreSQL local fue ejecutado. Preparar secretos externos y configuración de staging cuando se autorice. |
| Medio | Arquitectura backend | Arranque separado de migraciones; servicios/repositorios controlan transacciones. Revisar errores históricos de perfil y operación de entrega asíncrona antes de producción, sin reestructurar todo el servidor. |
| Medio | Arquitectura frontend | Token solo en memoria, guardas y generaciones preservadas. Pantallas nuevas reutilizan tema/validación; revisar caducidad global y accesibilidad en plataformas reales antes de añadir persistencia. |
| Medio | Experiencia de usuario | Pulido A aplicado a login/registro/perfil/edición/mapa con widgets móviles/escritorio. Repetir Chrome normal/Android y revisar con el equipo; no hay certificación de accesibilidad. |
| Medio | Deuda técnica | Gradle/SDK XML y APIs obsoletas generan advertencias, aunque el APK compila. Revisar versiones de plugin/SDK de forma aislada cuando haya pruebas de regresión, no actualizar en bloque. |
| Mejora futura | Despliegue | Definir entorno de staging, HTTPS, secretos externos, migraciones de despliegue y pipeline de APK release firmado cuando exista un objetivo de publicación. |

## Próximas cinco tareas (valor alto, riesgo acotado)

1. Revisar e integrar, solo con autorización, HU 3.1 y luego las ramas dependientes A/B/C; probar el par de SHA en un clon nuevo del equipo.
2. Elegir proveedor/remitente autorizado, implementar/configurar su adaptador y demostrar entrega/recepción real de recuperación y aviso, sin publicar credenciales.
3. Repetir recorrido final Chrome normal/Android, teclado, enlaces e invalidación entre clientes; registrar capturas sin tokens y corregir únicamente fallos observados.
4. Automatizar CI con lockfiles, PostgreSQL aislado, análisis/tests/builds y la integración opt-in ya disponible; aprobar checks/protecciones por separado.
5. Revalidar alertas de npm audit individualmente y preparar correcciones compatibles con regresión, sin force ni actualizaciones mayores automáticas.

## Hallazgos HU 3.1 — 07/10/2026, no compromisos automáticos

- Alto: acordar una fuente canónica y el proceso de alta de lugares antes de presentar el mapa como monitoreo real. El fixture actual está identificado como demostrativo.
- Medio: la migración explícita de lugares es portable; fixtures siguen restringidos a desarrollo/prueba local. Definir permisos, copias y ejecución controlada de migraciones antes de un despliegue. Nunca reutilizar Supabase en este trabajo.
- Medio: OpenStreetMap requiere conectividad; la caída de teselas no está cubierta por el recorrido negativo del backend. Evaluar mensajes y política de uso antes de despliegue.
- Medio: las 24 pruebas backend y la comprobación PostgreSQL aislada amplían cobertura; todavía falta el E2E automatizado completo y una migración de `users`.
- Mejora futura: paginación/límites del catálogo cuando exista volumen real. No añadir búsqueda, filtros, saturación ni detalles completos dentro de HU 3.1.

## Dirección de incrementos — actualización 08/10/2026

HU 3.1 ya está publicada, aún sin integrar. Rael autorizó A → B → C en ramas dependientes, commits/push a origin sin merge ni cambios de backlog. A/B están publicados; C incorpora solo las partes verificables mientras falte correo real. Los apartados siguientes conservan el alcance de diseño, no comprometen responsables/puntos/fechas ni declaran historias cerradas.

### `feature/hu-2-1-2-recuperacion`

HU 2.1 y 2.2 forman un único recorrido: solicitar y restablecer. Implementado/probado en C con transporte exclusivo de pruebas: respuesta uniforme, límites persistentes, token aleatorio/hash, vencimiento15min, reemplazo y consumo atómico, bcrypt8caracteres/72bytes e invalidación persistente de sesiones. Frontend valida enlace antes del formulario y exige login nuevo. Envío real deshabilitado; faltan proveedor/remitente/adaptador, entrega/recepción y revisión manual antes de aceptar el recorrido completo. No imprimir tokens en logs/evidencias. Retención y entrega durable/reintentos requieren decisión antes de producción.

Criterio uniforme autorizado para sustituir el contradictorio del Issue backend #3 (no editado): misma respuesta pública para correo existente/inexistente, sujeto a validación/límites. Sin proveedor ambos reciben503; con transporte de prueba202/mensaje fijo del contrato. Piso temporal común200ms y entrega asíncrona mitigan atajos, pero no certifican tiempos indistinguibles bajo carga; verificarlo antes de exposición real.

Referencia para respuesta uniforme, token aleatorio/expirable y uso único: [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

### `feature/hu-2-3-cambio-password`

Implementada/publicada en B: sesión y contraseña actual, validación/confirmación, rechazo de reutilización, bcrypt y versión de sesión persistente. Invalidación de JWT anteriores y concurrencia probadas; C incorpora también invalidación de recuperaciones pendientes. Falta revisión/integración y recorrido manual final; no mezclar commits con HU 3.1.

HU 2.4 ya está integrada: conservar borrado local/guardas. El cierre local por sí solo no revoca JWT; B/C sí invalidan versiones anteriores tras cambiar/restablecer contraseña. No reimplementar HU 2.4.

### Sprint 3 después de HU 3.1

Siguiente rama propuesta `feature/hu-3-3-detalle-lugar`: endpoint autenticado de detalle con nombre, dirección y categoría, 404 público; pantalla reutilizando mapa/modelo, carga/error/reintento y pruebas de contrato/navegación. Resolver fuente/datos de dirección antes de comprometer. La identificación breve actual no completa HU 3.3. HU 3.2 espera una fuente real/modelo de reportes para saturación: no inventar cifras con fixtures.

### Despliegue futuro (no ejecutado)

Web estático y API persistente se despliegan separadamente; no convertir Express a funciones improvisadamente. Evaluar un host estático (p. ej. Vercel, si se autoriza) y PostgreSQL administrado con TLS verificado, secretos externos, orígenes CORS exactos, HTTPS, backups y migraciones explícitas. El router usa `#/`; cambiarlo a rutas de path exigiría fallback al index. No se creó cuenta, base remota ni despliegue.
