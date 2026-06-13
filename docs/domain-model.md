# Modelo de dominio

El dominio vive principalmente en `src/domain` y define el contrato de datos de
la app. La persistencia actual guarda un `ExpenseStore` completo en localStorage
y, si el usuario esta autenticado, en Supabase `app_stores`.

## Store raiz

`ExpenseStore` contiene:

- `categories`: categorias de gasto con icono y tono visual.
- `templates`: definiciones recurrentes o puntuales de gastos.
- `overrides`: cambios sobre ocurrencias concretas.
- `finance`: ingresos, salario, objetivos de ahorro y cuentas.
- `deleted`: tombstones para evitar que deletes reaparezcan al mezclar stores.
- `preferences`: tema e idioma.

La normalizacion garantiza arrays y objetos minimos aunque se importe o cargue
un store antiguo o parcial.

## Gastos recurrentes

Un `ExpenseTemplate` representa la serie:

- Nombre, descripcion, importe y moneda `EUR`.
- Categoria.
- Fecha de inicio y posible fecha de fin.
- Dia de vencimiento.
- Regla de recurrencia.
- `reminder`: recordatorio opcional antes del cobro, con `enabled` y
  `daysBeforeCharge` de 1 a 5.
- Estado `active`.
- Timestamps de creacion y actualizacion.

La recurrencia soporta:

- `once`: gasto puntual.
- `monthly`: mensual.
- `quarterly`: trimestral.
- `yearly`: anual, con `annualMonth` cuando aplica.
- `custom`: intervalo por dia, semana, mes o anio.
- `rrule`: preparado para reglas RRULE.

Una `ExpenseOccurrence` no es una entidad persistida por si misma. Se deriva de
un template, una fecha de ocurrencia y sus overrides. Incluye fecha estimada de
cobro, estado y orden visual.

## Overrides

`ExpenseOccurrenceOverride` guarda excepciones para una ocurrencia concreta:

- Estado: `due`, `paid` o `skipped`.
- Fecha movida (`dueDate`) cuando cambia respecto a la ocurrencia original.
- Orden manual (`sortOrder`).
- Cambios puntuales de nombre, importe o categoria.
- Datos de pago (`paidAt`, `amountPaid`).
- Metadata de recordatorio descartado:
  `reminderDismissedAt` y `reminderDismissedChargeDate`.
- Nota opcional.

El patron importante es que el template conserva la serie, y el override cambia
solo una ocurrencia. Mover toda la serie actualiza el template; mover solo una
ocurrencia crea o actualiza un override.

## Categorias

Las categorias tienen `id`, `userId`, `name`, `icon` y `tone`. Los tonos validos
son `blue`, `green`, `orange`, `rose`, `violet` y `slate`. El color real lo
resuelve el design system mediante tokens de categoria.

Cuando se crea un gasto desde texto o formulario, la app reutiliza una categoria
existente o crea una nueva segun el nombre normalizado.

## Finanzas

`FinanceStore` contiene:

- `incomeEvents`: ingresos puntuales con importe, fecha y nota.
- `monthlySalary`: salario por mes, indexado por `YYYY-MM`.
- `monthlySavingsTargets`: objetivo de ahorro por mes.
- `accounts`: hasta tres cuentas de plan.

Las cuentas usan propositos controlados:

- `salary`
- `expenses`
- `daily`
- `savings`
- `investment`
- `other`

La pantalla `/money` calcula un `MonthlyMoneyPlan` con ingresos, gastos
planificados, aportacion a gastos, ahorro, inversion, restante y shortfall.

## Importacion bancaria

Los movimientos bancarios normalizados se guardan en `bankMovements`. Cada
`BankMovement` incluye:

- Fecha contable (`bookedAt`), descripcion, importe, moneda y cuenta opcional.
- `merchantKey` normalizado para agrupar y matchear.
- `fingerprint` estable para detectar duplicados.
- Metadata de conciliacion cuando aplica:
  `matchedTemplateId`, `matchedOccurrenceDate`, `matchedIncomeEventId` o
  `matchedSalaryMonth`.

`bankMerchantAliases` guarda alias confirmados por el usuario, por ejemplo un
concepto bancario como `APPLE.COM/BILL` vinculado a un gasto `iCloud`.

La importacion no aplica cambios automaticamente. El dominio devuelve
candidatos y la UI obliga a confirmar, editar, vincular, crear o ignorar:

- Gastos: coincidencias exactas, posibles coincidencias, recurrentes nuevos,
  pagos unicos nuevos y duplicados probables.
- Ingresos: nominas detectadas, ingresos puntuales y duplicados probables.
- Duplicados probables: se ignoran por defecto, pero el usuario puede guardar
  sin vincular o aplicar una accion manual bajo confirmacion.

La deteccion de nomina agrupa ingresos positivos por pagador/concepto
normalizado, tolera variaciones de importe, meses parciales y desplazamientos
por fin de semana. Al confirmar nominas, `monthlySalary[monthId]` se calcula
como suma de los movimientos de nomina confirmados para ese mes, preservando
cada movimiento en `bankMovements`.

## Preferencias

Las preferencias persistidas son:

- `theme`: `dark`, `rose-pine`, `catppuccin` o `light`.
- `language`: `es` o `en`.

El tema se aplica al DOM con `data-theme`. El idioma se aplica al atributo
`lang`. Ambos tambien se guardan en cookies para mantener la shell visual y de
idioma entre cargas.

## Tombstones

`deleted` conserva ids eliminados de:

- Categorias.
- Templates.
- Overrides.
- Income events.
- Bank movements.

Esto evita que un elemento borrado en un dispositivo reaparezca cuando se mezcla
con un store cloud o local que todavia lo tenia. Los tombstones son parte del
modelo actual y deben preservarse en persistencia y sync.

## Invariantes utiles

- La moneda de gastos e ingresos es `EUR`.
- El store debe pasar por normalizacion antes de usarse si viene de Supabase o
  almacenamiento local antiguo.
- Los comandos deben mantener la forma completa de `ExpenseStore`.
- Los ids de entidades sincronizables no deben reutilizarse.
- Los deletes deben anadir tombstones cuando el dato puede existir en otro
  dispositivo.
