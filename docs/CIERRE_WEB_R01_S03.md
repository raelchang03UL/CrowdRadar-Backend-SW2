# Cierre Web R01/S3 — evidencia para revisión

19/10/2026, America/Lima. Rama de ambos repositorios: `integration/cierre-web-r01-s03-20261019`. Esta página describe contenido/pruebas; existencia remota y **par exacto final** se acreditan en los cuerpos de sus PR. No implica merge en develop, aceptación de HU/Release/Sprint ni despliegue.

## Procedencia e identidad

- Base develop comprobada: backend `ffe9b19865c4952d5cb87a34f38fa71331197155`,frontend `dfdb75371d9c3a8ecdb7bc79cf8346988659f0ba`; ambas son ancestros. Candidatos iniciales B`eeff38b86c53d22180655ee5aa6fa501a2a5b061`/F`18cec26d0f2da755b9e436f04b715f431f54563d`,29/26commits sobre esas bases, más archivos pendientes F3/C2. Se preservan commits/autores, sin rebase/cherry-picks de reconstrucción.
- Nick:backend PR[33](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/pull/33)/[34](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/pull/34)/[35](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/pull/35)/[36](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/pull/36)/[37](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/pull/37),frontend[16–20](https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2/pulls). Detalle→búsqueda y saturación→filtro conservan sus dependencias. Sus heads están en la ascendencia de la consolidación, no se cierran/fusionan esos PR automáticamente.
- Manu:backend `d49578c`,`b109ca8`,`1595d36`;frontend `5791c59`,`218a35d`,`26eb200`,`5f09315` en la ascendencia, conservando ramas independientes y autores. Conciliaciones locales posteriores explicitan esquema/premio/errores; no atribuir todos los commits a Rael.
- Diego:autenticación/SMTP/mapa ya incluidos en develop;B#31/#32/#38 yF#14/#15 son antecedentes integrados, no PR nuevos de este cierre. Adapter SMTP conservado, no sustituido.
- Base-equipo B#27/F#10 también está incorporada como antecedente. No se cambia su estado ni el de Issues/Project; usar Refs, no Closes/Fixes.

## Contenido revisable

HU1–2 autenticación/perfil/recuperación/cambio;HU3detalle,búsqueda,categoría,saturación/filtro;HU4reportes/karma/historial propio;HU5validación/confiabilidad/estado/denuncia;HU6historial/comparación/horarios. Políticas provisionales aprobadas según CONTRATO_API; no nuevas reglas por este cierre.

Pendientes previos guardados:tests reproducibles backend;I1sesión vigente/antigua;I2resultado confirmado/cooldown/incertidumbre sin reenvío;I3/C2mapa,catálogo y perfil. F11 mínimo:solo ignorar índice activo si ya coincide la ruta real. No router nuevo,experimento visual,Favoritos,HU7/8,cloud ni dependencias nuevas.

Demo:cinco lugares reales y observaciones **sintéticas**, sin monitoreo. CLI check/migrate/seed/serve limitada a crowdradar_demo_local+localhost+procedencia; inicialización administrativa manual, no ejecutada de nuevo. Ya no conecta a QA ni crea/adopta bases. Migraciones001–007 y todas las protecciones históricas conservadas. [Procedimiento completo/fuentes](CATALOGO_DEMO_LOCAL.md).

## Validación final

| Tipo | Resultado |
| --- | --- |
| Node22.20/npm10.9,npm test |173/173,0fallidas/omitidas;HTTP loopback/dobles, no runner SQL completo |
| Sintaxis |95JS correctos |
| npm audit sin fix |10paquetes:1crítico,5altos,4moderados; ver interpretación inferior |
| Flutter3.41.9/Dart3.11.5 |analyze0problemas;562aprobadas/2opt-in omitidas/0fallidas;Web31,2s |
| F11 rojo→verde |1aprobada/6fallidas antes;7/7después. Incluye200/401tardíos,logout y rutas |
| Demo PostgreSQL real |check/seed0nuevos/5existentes;guardas sin ampliar;cuenta sintética2:0reportes/0premios/0puntos→1/1/10 |
| Navegador IAB final |alta/login,buscar/seleccionar,plegar/Enter,reporte+10,historial→perfil,ciclo perfil/historial,mapa,logout/rutas |
| diff-check |correcto en ambos repositorios |

SQL de solo lectura confirmó los totales previos2reportes/2premios/20puntos y posteriores3/3/30; los anteriores se conservaron. No se inventaron estadísticas ni se envió correo real. Seed idempotente/concurrente/conflicto se probó en PostgreSQL en el corte C2; pruebas nuevas35 de demo usan dobles, no atribuirles ese SQL.

Build final `main.dart.js` SHA256:`4ae6c604b64025361b874ffe9504ff8438b39c99cf8c119b8ffd622e8ccc4fc8`. Salida relativa falló al escribir shaders; se repitió solo build con ruta absoluta nueva, sin modificar código. Las pruebas finales representan el contenido funcional; cambios documentales posteriores no alteran ese contenido.

Evidencia SQL/resultados ligera en [resumen](evidencias/cierre_web_2026_10_19/resumen.json). Capturas y comparaciones depuradas en el [repositorio frontend](https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2/blob/integration/cierre-web-r01-s03-20261019/docs/CIERRE_WEB_R01_S03.md). No se requieren snapshots tmp ni credenciales de Rael.

### Avisos npm: publicación de revisión no es exposición pública

Proxy-addr aparece crítico(transitivo);fast-uri,brace-expansion,braces,chokidar,nodemon altos;moment,qs,sequelize,uuid moderados. Hay rutas de desarrollo y de producción: no reducirlo a “solo dev”. El aviso del árbol no demuestra explotación de nuestras rutas, ni las pruebas descartan esos avisos. No se aplicó audit fix ni degradaciones mayores sugeridas por metadata. Revisar/actualizar con alcance autorizado antes de Internet; no se desplegó ni se relajaron TLS/CORS/guardas.

## Pendientes de aceptación, separados

Las2opt-in(local_api_smoke/local_recovery_api),QA Release01 desde cero segura,SMTP/recepción real autorizados,Android/Chrome normal/lector/manual200%,criterios/catálogo y revisión humana. Publicación de rama para revisión no los convierte en pruebas aprobadas ni en bloqueo automático de PR. Modelo y UML editable en modelos/consolidacion.puml siguen vigentes; no entidades nuevas.

Siguiente decisión humana:revisar ambos PR y autorizar o rechazar su integración compatible a develop. No merge,Issue cerrado,Project cambiado ni aceptación de R01/S3 por este documento.
