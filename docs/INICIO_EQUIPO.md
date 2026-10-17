# Inicio del equipo — personas e IA

Entrada compartida de backend y frontend. No requiere el historial de chats ni la carpeta personal de Rael. No sustituye el backlog: usa las fuentes enlazadas y comprueba Git antes de decidir qué falta.

## Descarga de revisión del equipo

La rama `integration/base-equipo` de **ambos** repositorios reúne los avances publicados A/B/C y estas guías. Es una instantánea compartida para lectura, ejecución y revisión, no una entrega aprobada ni un reemplazo de `develop`. No iniciar nuevas funcionalidades desde ella: primero revisar/integrar el par mediante sus PR y después crear tareas desde `develop` actualizado.

En una carpeta nueva y vacía, con Git instalado:

```powershell
git clone -b integration/base-equipo https://github.com/raelchang03UL/CrowdRadar-Backend-SW2.git CrowdRadar-Backend
git clone -b integration/base-equipo https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2.git CrowdRadar-FrontEnd
```

Abrir la carpeta padre con la IA y usar el prompt del final. Leer los documentos no exige instalar dependencias ni crear una base. Para ejecutar la aplicación, seguir la configuración canónica con servicios/secretos propios. Si se detecta un defecto durante revisión, acordar su rama y alcance antes de editar; no trabajar siete personas sobre esta rama compartida.

## 1. Elegir la base correcta

`main` es la entrega estable; `develop` reúne los aportes revisados e integrados de cualquier integrante. Una rama publicada no pasa automáticamente a `develop`. Los dos repositorios deben formar un par compatible.

**Situación comprobada el 08/10/2026:** HU 3.1, pulido visual, cambio de contraseña y el núcleo de recuperación están publicados en ramas dependientes, todavía no integradas en `develop`. Los PR backend #26 y frontend #9 siguen abiertos en borrador. No anunciar una base compartida actualizada hasta revisar e integrar los incrementos y probar el par resultante. Ver [estado backend](ESTADO_ACTUAL.md) y el estado del clon frontend, sin reutilizar este aviso como prueba futura.

- Para trabajo nuevo: clonar/actualizar `develop` en ambos repositorios después de comprobar qué está integrado. No implementar otra vez una función que ya existe en una rama pendiente.
- Para revisar ahora los avances A/B/C: usar `feature/hu-2-1-2-recuperacion` en ambos repositorios, sin tratarla como base común aprobada. El procedimiento está en [CONFIGURACION_LOCAL](CONFIGURACION_LOCAL.md).
- Para revisar esos mismos avances con las guías nuevas: usar el par `integration/base-equipo` de arriba. Sus PR muestran el conjunto pendiente hacia `develop`, no solo documentación, y no añaden funcionalidades a los PR HU 3.1 anteriores.
- Si falta un archivo indicado por esta guía, verificar rama/publicación. No reconstruirlo de memoria ni asumir que la clonación falló.

La carpeta padre puede llamarse `CrowdRadar-SW2`, con clones hermanos `CrowdRadar-Backend` y `CrowdRadar-FrontEnd`. Cada persona usa su propia cuenta Git, instalación y base local. No compartir `.env`, la base de Rael ni contraseñas. Clonar descarga archivos versionados, no servicios en ejecución, SDK, dependencias instaladas ni datos locales.

## 2. Lectura para entender el proyecto

1. `AGENTS.md` y `CONTRIBUTING.md` de ambos repositorios.
2. [Coordinación canónica](COORDINACION_EQUIPO.md): ramas, revisión, trazabilidad y definición de terminado.
3. [Arquitectura backend](ARQUITECTURA.md), arquitectura frontend y su `docs/GUIA_VISUAL.md`.
4. [Contrato API canónico](CONTRATO_API.md) del backend del par que realmente se está revisando.
5. README, configuración y `docs/ESTADO_ACTUAL.md` de ambos componentes.
6. [Project e Issues](https://github.com/users/raelchang03UL/projects/1): criterios y trabajo acordado. No inventar asignaciones ni puntos si faltan.

Si existe `CONTEXTO_CROWRADAR_SW2.md` en la carpeta padre, leerlo como contexto inicial. No se descarga al clonar estos repositorios y no es un requisito para que un compañero pueda empezar. Prioridad de fuentes y responsabilidades documentales en la guía de coordinación.

## 3. Antes de tocar código

La IA debe informar rama, HEAD y cambios locales de **ambos** repositorios; remotos, criterio de la tarea, dependencias y archivos compartidos. Comprobar `origin/develop` mediante una consulta/actualización autorizada, no confiar solo en referencias antiguas. Si falta acceso a GitHub, marcar esa comprobación como pendiente.

Si todavía no hay tarea elegida, proponer hasta tres tareas pequeñas a partir de brechas actuales. No comenzar a programar ni crear Issues automáticamente. El autor y el equipo acuerdan tarea, responsable, revisor y alcance. Consultar primero las ramas/PR pendientes para evitar rehacer trabajo.

Una vez elegida, partir de `develop` actualizado y crear una rama por tarea, por ejemplo `feature/hu-X-Y-descripcion`, `fix/...` o `docs/...`. No hacen falta siete ramas personales permanentes. Cada persona puede tener varias ramas sucesivas, una por incremento revisable. Comandos y manejo de clones sucios en CONTRIBUTING; no borrar cambios para actualizar.

Coordinar router, tema, autenticación, contrato, modelos y migraciones antes de modificarlos. Usar el mecanismo compartido de seguimiento acordado para anunciar tarea y archivos; esa coordinación no autoriza por sí sola a la IA a modificar GitHub.

## 4. Ejecutar y comprobar

Seguir [CONFIGURACION_LOCAL](CONFIGURACION_LOCAL.md) y el README frontend de las ramas elegidas: PostgreSQL propio, configuración privada, migraciones explícitas, backend y Flutter como procesos separados. En un clon nuevo se resuelven las dependencias desde los lockfiles; no actualizar versiones por iniciativa de la IA. Cada integrante crea su cuenta de prueba mediante registro; no hay contraseña predeterminada.

Las pruebas mínimas son `npm test`, `flutter analyze --no-pub`, `flutter test --no-pub` y `git diff --check` en los repos afectados. SQL exige la comprobación aislada pertinente. Cambios de interfaz requieren recorrido/capturas sin secretos en las plataformas afectadas. Registrar qué prueba usa dobles, PostgreSQL, navegador o Android; un build no demuestra un recorrido manual.

La base y los paquetes deben estar preparados antes de ejecutar esas comprobaciones. Si algo no puede ejecutarse, registrar causa y pendiente; nunca convertirlo en aprobado. Los runners de integración escriben cuentas/datos de prueba: leer sus barreras y ejecutarlos solo contra los destinos autorizados. No probar ataques contra servicios externos.

## 5. Qué falta en el correo

El correo del usuario ya está en `users`. La recuperación consulta una cuenta activa y vincula un token aleatorio a su usuario; guarda solo su hash, vencimiento y consumo. El restablecimiento vuelve a validar el token en backend y lo consume junto al cambio de contraseña. No basta con que el frontend muestre «válido».

El código actual usa un enlace con token, no un PIN numérico. Cambiar a PIN sería un cambio de contrato/alcance, no configurar el envío. Remitente es la identidad autorizada de CrowdRadar; destinatario es el correo registrado por cada usuario; proveedor SMTP/API es el servicio que entrega el mensaje. No hace falta una extensión del navegador ni una tabla nueva de buzones para verificar la cuenta.

**Pendiente:** elegir servicio y remitente autorizado, configurar secretos privados, implementar el adaptador de entrega y comprobar recepción real y errores del proveedor. No hay servicio contratado/configurado ni autorización para gastos. El servidor normal responde indisponibilidad uniforme; la captura en memoria pertenece solo a pruebas. No marcar HU 2.1/Sprint 2 como terminados por esa captura. El contrato y la arquitectura describen la interfaz de entrega y la deuda de fiabilidad.

Una prueba real necesita una cuenta registrada cuyo buzón controle el probador. Un enlace `localhost` apunta al dispositivo donde se abre: no demuestra recuperación desde otro teléfono/PC ni enlaces nativos Android. El despliegue futuro exige URL pública HTTPS y revisión de configuración; no está realizado por esta guía.

## 6. Entregar y continuar

Al terminar, informar: hecho, archivos, pruebas y resultado, pendientes, contrato afectado y siguiente paso. Git guarda el cambio; el PR enlaza Issue, evidencia y PR compañero. Actualizar solo los documentos cuyo hecho cambió, sin duplicar el backlog ni reescribir evidencias históricas.

Pedir la autorización necesaria para commit/push/PR/merge y cambios de Issues/Project. No publicar secretos ni cerrar automáticamente una HU transversal pendiente. Otro humano revisa; después del merge, probar y registrar el par de SHA backend/frontend. Los demás actualizan su `develop` limpio y continúan desde ahí, independientemente del autor del último aporte.

## Prompt inicial, sin tarea asignada todavía

> Trabaja en mis dos clones locales de CrowdRadar. Lee AGENTS.md y CONTRIBUTING.md de ambos; después docs/INICIO_EQUIPO.md, COORDINACION_EQUIPO.md y CONTRATO_API.md del backend, y arquitectura/estado/configuración de ambos más GUIA_VISUAL del frontend. Si existe el contexto maestro en la carpeta padre, léelo como contexto verificable. Primero informa rama, HEAD, cambios locales, remotos y diferencias entre trabajo integrado, ramas pendientes e historial. Contrasta el backlog y las pruebas disponibles; si no tienes acceso o no ejecutas una prueba, dilo. Explícame lo que funciona con evidencia y propón hasta tres tareas pequeñas que aún falten, sus riesgos, dependencias y criterio de terminado. No rehagas A/B/C ni amplíes el Sprint automáticamente. No modifiques código, instales paquetes, publiques, fusiones, asignes responsables/puntos ni cambies GitHub hasta que elijamos una tarea y te autorice esas acciones. Conserva cambios ajenos y secretos. Tras elegir la tarea, trabaja en su propia rama desde la base integrada aprobada y documenta solo los hechos que cambien.
