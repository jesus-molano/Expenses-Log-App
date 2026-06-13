# Estado, persistencia y sincronizacion

El estado de aplicacion se centraliza en `ExpenseStoreProvider`. Las pantallas
interactivas usan `useExpenseStore` para leer datos, ejecutar comandos y conocer
el estado de sync.

## Provider global

`ExpenseStoreProvider` vive en el `RootLayout`, por lo que dashboard, money,
settings y detail comparten una unica instancia del store.

El hook expone:

- `store`: datos normalizados de la app.
- Comandos de gastos: add, delete, clear, toggle paid, skip, move occurrence y
  move series.
- Comandos financieros: salario, ahorro, cuentas, ingresos y overrides
  mensuales.
- Comando de importacion bancaria: confirma decisiones revisadas y aplica los
  cambios en el mismo store.
- Comandos de preferencias: tema e idioma.
- Estado de sync: `syncStatus`, `syncMessage`, `isHydrated`.

`useExpenseStore` falla explicitamente si se llama fuera del provider. Eso evita
pantallas con stores paralelos o rehidrataciones accidentales.

## Comandos

Los comandos se dividen por responsabilidad:

- `expense-commands`: crea templates, categorias y overrides; paga, salta,
  mueve o borra gastos.
- `finance-commands`: modifica salario mensual, objetivos, cuentas e ingresos.
- `preference-commands`: actualiza tema e idioma en el store.
- `confirmBankImportInStore`: aplica decisiones del import bancario. Puede
  vincular movimientos a gastos, crear gastos, confirmar nominas, crear ingresos
  puntuales, guardar movimientos sin vincular o ignorarlos.

Los comandos reciben un `ExpenseStore` y devuelven otro. Esta forma mantiene la
logica testeable y evita mutaciones ocultas dentro de componentes.

## Persistencia local

La persistencia local usa `localStorage` con la clave
`expense-log-store-v1`. Al cargar:

1. Se lee localStorage.
2. Se normaliza el JSON.
3. Se aplican preferencias runtime desde cookies/DOM cuando corresponde.
4. Se guarda de nuevo el store normalizado.
5. Se hidrata React.

Al guardar:

1. Se asigna owner si hay usuario.
2. Se incrementa la revision local.
3. Se escribe localStorage.
4. Se emite `expense-store-updated`.
5. Se encola guardado cloud si hay Supabase, usuario e hidratacion completa.

Si localStorage falla, la app intenta seguir viva y emite igualmente el evento
de actualizacion.

## Sync cloud

La sync cloud usa Supabase `app_stores` con un JSONB completo del store por
usuario. Al hidratar con sesion:

1. Se carga el store local inicial.
2. Se pide el usuario con `supabase.auth.getUser()`.
3. Se carga el store cloud desde `app_stores`.
4. Se mezcla local y cloud.
5. Se asigna `userId` real a entidades sincronizables.
6. Se guarda local.
7. Se persiste el resultado en cloud.

Si la tabla `app_stores` no existe o no esta disponible, la app degrada a modo
local sin romper la experiencia.

## Merge local/cloud

La mezcla actual usa ids:

- Entidades cloud como base.
- Entidades locales como entrada con prioridad final.
- Tombstones combinados para filtrar elementos borrados.
- Mapas mensuales de salario y ahorro: cloud + local, con local al final.
- Cuentas: se prefieren las locales si existen; si no, cloud.
- Preferencias: local, luego cloud, luego defaults.

La politica de hidratacion protege cambios hechos por el usuario mientras
llegaba el cloud store: si la revision local cambio, se usa el store local mas
reciente y no se pisa el estado React con datos antiguos.

## Cola de guardado

Los cambios normales se guardan localmente y se encolan para cloud. Operaciones
mas sensibles, como borrar gastos o limpiar gastos, usan persistencia inmediata
para reducir ventanas de inconsistencia.

El estado de sync comunica preparando cloud, guardando, guardado, local o error.
Los mensajes se traducen con `src/shared/i18n`.

## Importacion bancaria

La UI actual no importa ni exporta stores JSON completos. El flujo de ajustes
importa movimientos bancarios del usuario desde CSV/XLS/XLSX:

1. Se lee el archivo en cliente.
2. Se detectan columnas de fecha, descripcion, importe/cargo/abono, saldo y
   cuenta.
3. Se normalizan movimientos y fingerprints.
4. Se comparan contra gastos, ingresos, alias y movimientos ya guardados.
5. Se muestran candidatos revisables.
6. Nada se aplica hasta que el usuario confirma.

Al confirmar, el resultado entra por `confirmBankImportInStore` y por el flujo
normal de persistencia: localStorage primero y cloud si hay usuario autenticado
e hidratacion completa.

Los duplicados probables se mantienen ignorados por defecto, pero son
editables. Si el usuario fuerza una accion, el comando conserva la trazabilidad
en `bankMovements` y aplica la decision correspondiente.

## Reglas actuales y limites

- El modelo cloud sigue siendo JSONB por usuario, no tablas normalizadas por
  entidad.
- Los tombstones evitan reaparicion de deletes, pero no son un sistema completo
  de resolucion por revision de cada campo.
- En ediciones concurrentes del mismo elemento, gana el item que entra al final
  en el merge por id.
- Los deletes deben seguir registrando tombstones en nuevos comandos.
- El import bancario debe conservar `bankMovements`, `bankMerchantAliases`,
  `finance.incomeEvents` y `finance.monthlySalary` al mezclar local/cloud.
