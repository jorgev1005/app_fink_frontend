#!/bin/bash

# Usage: ./server-restore.sh <path_to_backup_tar_gz>
# Example: ./server-restore.sh /home/fink/backups/fink_backup_2025-02-11_10-00-00.tar.gz

BACKUP_FILE=$1
APP_DIR="/home/fink/backend"
DB_NAME="grupoal1_finkdb"
DB_USER="grupoal1_finkuser"
TEMP_DIR="/home/fink/backups/temp_restore"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./server-restore.sh <path_to_backup_tar_gz>"
    echo "List available backups: ls -lh /home/fink/backups/"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: File $BACKUP_FILE does not exist."
    exit 1
fi

echo -e "${RED}⚠️  DANGER ZONE ⚠️${NC}"
echo -e "${RED}This will PERMANENTLY DELETE current data and replace it with the backup.${NC}"
echo "Backup to restore: $BACKUP_FILE"

# Check for non-interactive mode (passed as second argument "yes")
if [ "$2" == "yes" ]; then
    echo "Auto-confirming restore..."
else
    read -p "Are you absolutely sure? (Type 'yes' to confirm): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled."
        exit 1
    fi
fi

echo "🛑 Stopping backend service..."
pm2 stop fink-backend

echo "🧹 Cleaning temp directory..."
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR

echo "📦 Extracting backup archive..."
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# The archive contains a date-folder at root, e.g. "2025-02-11_..."
EXTRACTED_FOLDER=$(ls "$TEMP_DIR" | head -n 1)
RESTORE_SOURCE="$TEMP_DIR/$EXTRACTED_FOLDER"

if [ ! -f "$RESTORE_SOURCE/database.dump" ]; then
    echo "❌ Error: Invalid backup format. database.dump not found in $RESTORE_SOURCE"
    pm2 start fink-backend
    exit 1
fi

echo "♻️  Restoring Database..."
# --clean drops db objects. We need to be careful if DB connection is active. PM2 stop helps.
pg_restore -h localhost -U $DB_USER -d $DB_NAME --clean --if-exists --no-owner --role=$DB_USER -v "$RESTORE_SOURCE/database.dump"

echo "📂 Restoring Uploads..."
if [ -f "$RESTORE_SOURCE/uploads.tar.gz" ]; then
    # Backup current uploads just in case (optional, maybe overkill but safe)
    # mv "$APP_DIR/uploads" "$APP_DIR/uploads_pre_restore_$(date +%s)"
    
    echo "Removing current uploads..."
    rm -rf "$APP_DIR/uploads"
    
    echo "Extracting new uploads..."
    tar -xzf "$RESTORE_SOURCE/uploads.tar.gz" -C "$APP_DIR"
else
    echo "⚠️  No uploads backup found in archive."
fi

echo "🧹 Cleaning up temp files..."
rm -rf "$TEMP_DIR"

echo "🚀 Restarting backend service..."
pm2 start fink-backend

echo -e "${GREEN}✅ Restore Process Completed Successfully.${NC}"
