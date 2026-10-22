# Instrucciones del proyecto

## Plataformas y datos

- La aplicación tiene un cliente web en `src/`, un cliente móvil en `mobile/` y una API en `server/`.
- La API usa PostgreSQL alojado en Supabase. Los clientes deben consumir los datos mediante la API autenticada existente; no conectarse directamente a PostgreSQL ni duplicar reglas de negocio en el cliente.
- Conserva la configuración de API y base de datos existente. No reemplaces URLs, credenciales ni variables de entorno por valores locales o de ejemplo.

## Paridad de cambios web y móvil

- Cada cambio al código o comportamiento de la web debe implementarse también en el móvil en la misma tarea y entrega, y viceversa; no se debe postergar la versión equivalente para otra tarea.
- Conserva los patrones de interacción propios de cada plataforma y ofrece la capacidad equivalente, sin forzar una interfaz idéntica. Por ejemplo, la web puede editar un movimiento desde una celda del libro y el móvil desde la fila del movimiento; no agregues una cuadrícula al móvil solo para imitar la web.
- Si una capacidad no aplica a la interfaz de una plataforma, adapta la interacción al patrón disponible y deja constancia breve en la entrega.
- Esta regla trata de mantener el código y las funciones de ambas plataformas en paridad; no implica sincronización automática de datos en tiempo de ejecución.

## Libro web

- Todas las celdas de datos con importes del libro deben responder al clic y permitir editar los movimientos que representan.
- Al hacer clic en el nombre de un rubro, permite cambiar su nombre desde la gestión de rubros.
- Las celdas vacías de rubro y día deben permitir registrar un movimiento con ese contexto.
- Los totales y balances son cálculos derivados: al seleccionarlos, permite revisar y editar los movimientos que los componen; no guardes esos importes calculados como movimientos independientes.
- Si una celda representa varios movimientos, presenta una selección clara para abrir el movimiento que se quiere editar.
