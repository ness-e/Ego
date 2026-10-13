// Declaración ambiental mínima para el import interno `lodash` de los
// tipos de `recharts` (F5T11/M31). Sin `@types/lodash` instalado y sin red
// para añadirlo, esto permite que `tsc --noEmit -p` resuelva el módulo.
// No afecta al runtime (solo tipos).
declare module "lodash";
