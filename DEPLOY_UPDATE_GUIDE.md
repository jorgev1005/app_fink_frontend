# Guía de Actualización - Funcionalidad de Respaldos

Sigue estos pasos para desplegar los cambios recientes (Sistema de Respaldos Automáticos) en el servidor de producción.

## 1. Actualizar Código (En el Servidor)

Conéctate vía SSH al servidor y navega a la carpeta del proyecto.

```bash
cd /home/fink/app_fink   # (Ajusta la ruta según tu instalación real)
git pull origin main
```

## 2. Configurar Script de Respaldo

El script de respaldo necesita permisos de ejecución.

```bash
cd backend/scripts
chmod +x server-backup.sh
```

**Verificación:**
Asegúrate de que el script funciona manualmente antes de activarlo en la app.
(Esto puede generar un primer backup de prueba).

```bash
./server-backup.sh
```
*Si ves errores de permisos de DB, revisa tu archivo `~/.pgpass` o las credenciales en el script.*

## 3. Reconstruir Backend

Actualiza las dependencias y recompila el backend para incluir el nuevo servicio `BackupService`.

```bash
cd ../  # Regresar a carpeta /backend
npm install
npm run build
```

## 4. Reconstruir Frontend

Recompila la interfaz para incluir la nueva página de configuración.

```bash
cd ../frontend
npm install
npm run build
```

## 5. Reiniciar Servicios

Reinicia la aplicación con PM2 para que tome los cambios (especialmente el nuevo Cron Job del backend).

```bash
pm2 restart all
```

---

## 6. Verificación Final

1. Entra a la App Fink.
2. En el Dashboard, busca el nuevo ícono **"Respaldos"** en Accesos Rápidos (color rojo suave).
3. Entra y activa la automatización.
4. Prueba el botón "Ejecutar Respaldo Ahora".
