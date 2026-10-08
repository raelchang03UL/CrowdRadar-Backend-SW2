# Cómo contribuir a CrowdRadar

El equipo tiene siete integrantes activos. Cada persona trabaja con su clon, su cuenta Git y una rama por tarea; la IA ayuda a su autor, que comprende, prueba y responde por el cambio.

## Lectura inicial

1. [Reglas de este repositorio](AGENTS.md).
2. [Acuerdo de coordinación](docs/COORDINACION_EQUIPO.md), canónico para ambos repositorios.
3. [Arquitectura backend](docs/ARQUITECTURA.md) y [contrato API](docs/CONTRATO_API.md).
4. [Configuración local](docs/CONFIGURACION_LOCAL.md) y [estado técnico](docs/ESTADO_ACTUAL.md).
5. Issue aprobado de la tarea en el [Project](https://github.com/users/raelchang03UL/projects/1).

El contexto maestro de la carpeta padre ayuda si está disponible, pero no se descarga al clonar este repositorio. Estas guías permiten arrancar sin un historial de chat.

## Empezar con una base revisada

Comprobar primero `git status`, rama y remotos. Los comandos siguientes suponen un clon limpio; con cambios locales, detenerse a identificar su dueño y conservarlos.

```powershell
git fetch origin
git switch develop
git pull --ff-only origin develop
git switch -c feature/hu-X-Y-descripcion
```

Nunca iniciar trabajo del ciclo desde `main` ni actualizar desde `upstream`. En esta PC existe una referencia `main` local histórica del backend distinta de `origin/main`; no usarla ni corregirla como parte de una HU.

Clonar también [frontend](https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2) para integración. Revisar el README de la rama que realmente se utiliza: una funcionalidad local sin push no existe todavía para los demás.

## Entregar un incremento

1. Acordar Issue, archivos compartidos, contrato y criterios con la persona que integra el frontend.
2. Implementar solo el alcance aprobado. Probar `npm test`; ejecutar pruebas PostgreSQL aisladas si cambia persistencia. No instalar/actualizar paquetes fuera de la autorización.
3. Revisar `git diff`, `git diff --check` y archivos no rastreados. Actualizar solo las guías cuyo hecho cambió.
4. Con autorización, seleccionar rutas explícitas para commits pequeños y publicar la rama en `origin`. Mensaje sugerido: `feat(auth): permitir cambiar contraseña`; cuerpo `Refs #5` si corresponde a este repo. Para otro repo usar su URL o `owner/repo#n` completo.
5. Abrir PR hacia `develop` con la [plantilla](.github/pull_request_template.md), evidencia y enlace al PR compañero. Mantener `Refs` mientras falten criterios; cerrar el Issue padre solo tras integración y validación de ambos lados.
6. Obtener revisión de otra persona. Integrar primero el cambio compatible del backend cuando el frontend lo requiera, probar el par y registrar los dos SHA de integración en el Issue/PR. Git no fusiona dos repositorios de manera atómica.

No se hacen commits por cada paso de la IA ni se actualiza README por cada línea. Git guarda el detalle; PR guarda la explicación y las pruebas. Para bloqueos, criterios pendientes y trabajo de hoy, usar Issue/Project con autorización.

## Automatización

En la auditoría del 07/10/2026 no existe `.github/workflows`. Los comandos ejecutados localmente no constituyen CI. El acuerdo de coordinación propone el pipeline y protecciones para una tarea posterior; no declararlos activos hasta comprobar sus ejecuciones y configuración.
