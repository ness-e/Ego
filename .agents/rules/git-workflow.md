# Git Workflow & Versioning Rule

## 1. Principio de Cambios Atómicos
- Cada commit debe representar una única unidad lógica de cambio (un bug fix, una feature, un refactor).
- Nunca mezcles refactorizaciones de código con cambios funcionales en el mismo commit.

## 2. Convención de Commits Semánticos (Conventional Commits)
Formato obligatorio: `<tipo>(<alcance>): <descripción corta en presente>`

Tipos permitidos:
- `feat`: Nueva funcionalidad
- `fix`: Corrección de bug
- `docs`: Modificaciones únicamente en documentación
- `style`: Formateo, espaciado, sin cambios en código lógico
- `refactor`: Refactorización de código sin alterar comportamiento
- `perf`: Mejora de rendimiento
- `test`: Adición o corrección de pruebas
- `chore`: Tareas de build, dependencias o configuración

## 3. Restricciones Duras
- Prohibido realizar `git push --force` sobre ramas principales.
- El build y los tests deben pasar antes de generar un commit.
