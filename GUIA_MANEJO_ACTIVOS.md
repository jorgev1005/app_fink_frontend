# Guía de Manejo de Activos - Inversiones Lucem C.A.

Esta guía describe el procedimiento para registrar, adquirir y vender activos fijos (vehículos, equipos, mobiliario) siguiendo las mejores prácticas contables dentro de la aplicación.

## 1. Cuentas Configuradas

Se han creado automáticamente las siguientes cuentas en el proyecto **Inversiones Lucem C.A.** (Moneda USD):

*   **Activos (Donde se guarda el valor):**
    *   `1.4.01.001` - Equipos de Computación
    *   `1.4.01.002` - Vehículos
    *   `1.4.01.003` - Maquinaria y Equipos
    *   `1.4.01.004` - Mobiliario de Oficina
*   **Ingresos (Para ganancias al vender):**
    *   `4.2.01.001` - Ganancia en Venta de Activos
*   **Gastos (Para pérdidas al vender):**
    *   `5.4.01` - Pérdida en Venta de Activos

## 2. Incorporación de Activos Existentes (Saldos Iniciales)

Si ya posees los activos y quieres ingresarlos al sistema por primera vez:

1.  Ve a **Nueva Transacción**.
2.  Tipo: **Ajuste**.
3.  Descripción: "Incorporación Inicial de [Nombre del Activo] - [Serial/Placa]".
4.  **Cuenta Débito**: Selecciona la cuenta de activo correspondiente (ej. `Vehículos`).
5.  **Cuenta Crédito**: Selecciona `3.1.01 - Capital Social` (esto indica que es un aporte tuyo a la empresa).
6.  **Monto**: El valor de mercado actual del activo en USD.
7.  **Adjuntos**: Sube una foto o documento de propiedad si lo tienes.

## 3. Compra de Nuevos Activos

Cuando compras un activo con dinero de la empresa:

1.  Ve a **Nueva Transacción**.
2.  Tipo: **Transferencia** (o Gasto, pero Transferencia es más correcto contablemente para mover dinero a activo).
3.  **Cuenta Origen**: Banco o Caja (de donde sale el dinero).
4.  **Cuenta Destino**: La cuenta de activo correspondiente (ej. `Equipos de Computación`).
5.  **Monto**: El precio de compra.

## 4. Venta o Desincorporación de Activos

Al vender un activo, pueden ocurrir dos cosas: que ganes dinero (precio venta > valor libro) o que pierdas (precio venta < valor libro).

**Ejemplo:** Tienes una Laptop registrada por **$1,000**.

### Caso A: Venta con Ganancia (La vendes en $1,200)
1.  **Paso 1 (Recibir el dinero):**
    *   Crea una transacción de **Ingreso**.
    *   Cuenta: Banco (donde entra el dinero).
    *   Categoría/Cuenta Origen: `Equipos de Computación`.
    *   Monto: **$1,200**.
    *   *Resultado:* Tu cuenta de equipos quedará en negativo (-$200) porque sacaste más de lo que valía.
2.  **Paso 2 (Ajustar la ganancia):**
    *   Crea una transacción de **Ajuste**.
    *   Cuenta Débito: `Equipos de Computación` (por $200 para llevarla a 0).
    *   Cuenta Crédito: `Ganancia en Venta de Activos`.
    *   Monto: **$200**.

### Caso B: Venta con Pérdida (La vendes en $800)
1.  **Paso 1 (Recibir el dinero):**
    *   Crea una transacción de **Ingreso**.
    *   Cuenta: Banco.
    *   Categoría/Cuenta Origen: `Equipos de Computación`.
    *   Monto: **$800**.
    *   *Resultado:* Tu cuenta de equipos quedará con saldo positivo ($200) porque aún "tienes" valor contable que ya no existe físico.
2.  **Paso 2 (Reconocer la pérdida):**
    *   Crea una transacción de **Ajuste**.
    *   Cuenta Débito: `Pérdida en Venta de Activos`.
    *   Cuenta Crédito: `Equipos de Computación` (por $200 para llevarla a 0).
    *   Monto: **$200**.

---
**Nota:** Al usar proyectos separados, estos movimientos **no afectan** tus finanzas personales ni otros proyectos, manteniendo la contabilidad de Inversiones Lucem C.A. impecable.
