# Lista de Pendientes - Fink App

## 🟢 Prioridad Baja / Mejoras Futuras
- [x] **Backend - Analíticas:** Investigar y corregir error `PrismaClientValidationError: Invalid prisma.analyticsEvent.create() invocation`. 
    - *Solución:* Se agregó `JSON.stringify(props)` antes de guardar en la DB para respetar el tipo `String` del esquema.
    - *Estado:* Corregido el 10/02/2026.
- [x] **Funcionalidad - IDP/OCR Facturas:** Investigar e implementar sistema para lectura automática de facturas (físicas/imágenes) para crear transacciones rápidamente.
    - *Solución:* Se implementó `POST /api/scan/invoice` usando **Tesseract.js** en el backend. 
    - *Frontend:* `QuickTransaction` ahora escanea automáticamente la imagen subida/tomada y rellena Monto, Fecha y NIF.
    - *Estado:* Implementado el 10/02/2026.

## 🟡 Prioridad Media
- [x] **DevOps - Revisión Scripts Despliegue:** Revisar y actualizar `scripts/deploy.ps1`.
    - *Solución:* Se eliminó la sección de despliegue de Frontend (ahora en Vercel) y se marcó `deploy-frontend.ps1` como obsoleto (`.deprecated`).
    - *Estado:* Corregido el 10/02/2026.


## 🔴 Prioridad Alta / Urgente
- [ ] **Permisos:** Revisar y actualizar los permisos de usuarios para cada proyecto.
- [ ] (Espacio para nuevos pendientes)
