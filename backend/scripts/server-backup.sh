#!/bin/bash

# --- CONFIGURACIÓN ---
BACKUP_ROOT="/home/fink/backups"
APP_DIR="/home/fink/backend"
DB_NAME="grupoal1_finkdb"
DB_USER="grupoal1_finkuser"
# Nota: La contraseña se toma del archivo .pgpass o variable de entorno al ejecutar
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_PATH="$BACKUP_ROOT/$DATE"
FINAL_ARCHIVE="$BACKUP_ROOT/fink_backup_$DATE.tar.gz"

# Colores para output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Backup Process: $DATE${NC}"

# 1. Crear directorios
mkdir -p "$BACKUP_PATH"

# 2. Respaldo de Base de Datos (Formato Custom - más compacto y flexible)
echo "📦 Exporting Database..."
# Usamos localhost y las credenciales desde el entorno o .pgpass
# -F c : Formato Custom (comprimido y permite selectividad al restaurar)
pg_dump -h localhost -U $DB_USER -F c -b -v -f "$BACKUP_PATH/database.dump" $DB_NAME

# 3. Respaldo de Archivos (Uploads)
echo "📂 Compressing Uploads..."
if [ -d "$APP_DIR/uploads" ]; then
    tar -czf "$BACKUP_PATH/uploads.tar.gz" -C "$APP_DIR" uploads
else
    echo "Warning: Uploads directory not found."
fi

# 4. Copiar variables de entorno (Opcional, útil para recuperar configs)
cp "$APP_DIR/.env" "$BACKUP_PATH/.env.backup"

# 5. Empaquetar todo en un solo archivo
echo "🗜️ Creating final archive..."
tar -czf "$FINAL_ARCHIVE" -C "$BACKUP_ROOT" "$DATE"

# 6. Limpieza de temporales
rm -rf "$BACKUP_PATH"

# 7. Limpieza de respaldos antiguos (mantener últimos 30 días)
echo "🧹 Cleaning old backups..."
find "$BACKUP_ROOT" -name "fink_backup_*.tar.gz" -type f -mtime +30 -delete

echo -e "${GREEN}✅ Backup Completed: $FINAL_ARCHIVE${NC}"
ls -lh "$FINAL_ARCHIVE"
