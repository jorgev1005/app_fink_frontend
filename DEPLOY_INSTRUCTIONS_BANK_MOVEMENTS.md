# Guía de Despliegue - Módulo de Movimientos Bancarios

Esta actualización incluye mejoras en la visualización de movimientos bancarios, corrección de cálculo de saldos iniciales y soporte multimoneda en el reporte.

## Archivos Modificados

**Backend:**
- `backend/src/controllers/account.controller.ts`: Lógica de libro mayor (ledger), corrección de saldo inicial y normalización de divisas.

**Frontend:**
- `frontend/src/app/accounts/[id]/page.tsx`: Inclusión de pestañas y vista de movimientos.
- `frontend/src/components/AccountLedger.tsx`: Nuevo componente para la tabla de movimientos.

## Pasos de Despliegue

### 1. Actualizar Repositorio (En el servidor)

```bash
git pull origin main
```

### 2. Actualizar Dependencias y Construir (Frontend y Backend)

Como se agregaron nuevos componentes, es necesario reconstruir ambos.

**Backend:**
```bash
cd backend
# npm install (No se agregaron dependencias nuevas, pero buena práctica)
npm run build
```

**Frontend:**
```bash
cd ../frontend
# npm install
npm run build
```

### 3. Reiniciar Servicios

Reinicia los procesos para que tomen los cambios del código compilado.

```bash
pm2 restart all
# O si usas nombres específicos:
# pm2 restart fink-backend
# pm2 restart fink-frontend
```

## Verificación Post-Despliegue

1. Ir a una Cuenta Bancaria.
2. Verificar que aparezca la pestaña "Movimientos".
3. Verificar que los saldos coincidan con la realidad, especialmente en cuentas con movimientos en monedas mixtas.
