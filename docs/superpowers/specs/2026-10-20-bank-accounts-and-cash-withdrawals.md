# Cuentas bancarias y retiros a efectivo

**Fecha:** 2026-10-20
**Estado:** Aprobado para implementación por el usuario el 2026-10-20.

## Objetivo

Registrar varias cuentas bancarias con nombre o referencia y saldo inicial. Mostrar cada saldo por separado y sumar los saldos bancarios en el total **Débito**, distinto de **Efectivo**. Registrar retiros de cajero como traslado de una cuenta bancaria a efectivo.

## Comportamiento

- Una cuenta bancaria tiene nombre o referencia (puede ser número), saldo inicial y fecha desde la que aplica. La fecha de cuentas nuevas comienza en hoy para no alterar meses anteriores.
- La cuenta bancaria que ya existe y sus movimientos se conservan como la primera cuenta. La migración no duplica ni borra movimientos.
- Los movimientos de ingreso y gasto eligen efectivo o una cuenta bancaria específica. La lista muestra el nombre de la cuenta elegida.
- La pantalla principal muestra el saldo de efectivo, el saldo de cada banco y **Débito total**, suma de saldos bancarios.
- **Retirar** pide monto, fecha, descripción y cuenta bancaria de origen. Guarda un traslado banco → efectivo: resta del banco, suma a efectivo y no cambia ingresos ni gastos.
- Las transferencias entre bancos restan de la cuenta de origen y suman a la de destino; no cambian el total Débito ni ingresos/gastos.
- La gestión de cuentas y los movimientos funcionan en web y Android, con los mismos datos en la API.
- En configuración, web y Android ofrecen **Cambiar contraseña** para el propietario autenticado. Solicita contraseña actual, nueva contraseña y confirmación; el servidor verifica la actual y guarda la nueva con Argon2id.
- Un cambio correcto revoca todas las sesiones, incluida la actual, y devuelve al inicio de sesión en ambos clientes. La contraseña nueva permite iniciar sesión; la anterior deja de funcionar.
- Una contraseña actual incorrecta o una confirmación distinta no modifica la contraseña ni las sesiones.

## Datos y compatibilidad

- Ampliar el modelo de cuentas para guardar identificador, nombre, saldo inicial y fecha de inicio de cada banco. Efectivo sigue siendo una sola cuenta.
- Cada lado bancario de un movimiento conserva la referencia a la cuenta elegida; los lados en efectivo siguen identificándose como efectivo.
- Mantener compatibilidad durante el despliegue con clientes que todavía envíen la cuenta lógica `bank`. Esas operaciones se asignan a la cuenta bancaria existente.
- Actualizar las respuestas de estado, validación API, web, Android, carga/creación de movimientos, totales y scripts que comparan o migran cuentas.
- Añadir una operación autenticada para cambiar la contraseña y una operación del almacén de autenticación que actualice el hash del propietario y revoque todas sus sesiones.

## Migración y reversión

1. Actualizar el esquema inicial local y añadir una migración PostgreSQL idempotente para bases existentes.
2. Crear la primera cuenta bancaria a partir de la cuenta `bank` actual y enlazar sus movimientos existentes sin cambiar fechas, montos o conteos.
3. Conservar los campos antiguos necesarios para que la versión previa de la app siga leyendo los totales y guardando operaciones durante la actualización.
4. Antes del despliegue de la migración, respaldar Supabase. Tras migrar, comparar cuentas, movimientos y saldos calculados con la copia previa.
5. Revertir el código si falla la app, pero dejar intacta la migración aditiva y los nuevos datos. No borrar columnas ni cuentas automáticamente.

## Verificación

- Probar saldos por cuenta, Débito total y efectivo tras ingresos, gastos y transferencias.
- Verificar que un retiro descuente del banco correcto y aumente efectivo por el mismo monto, sin contarse como gasto o ingreso.
- Confirmar en Android Emulator: crear varias cuentas, registrar y retirar, cerrar/abrir la app y comprobar datos persistentes.
- Confirmar que los cambios se reflejan también en web y que los movimientos, cuentas y saldos históricos anteriores permanecen iguales tras la migración.
- Verificar en web y Android que cambiar la contraseña requiere la actual, rechaza confirmaciones distintas, invalida las sesiones y permite volver a entrar solo con la nueva.

## Fuera de alcance

Conexión automática con bancos, sincronización de transacciones bancarias, recuperación por correo, múltiples usuarios y borrar cuentas con movimientos asociados.
