# Guía de Despliegue a Producción - Fink App

Esta guía detalla los pasos para desplegar la aplicación Fink en un servidor de producción (Ubuntu/Linux recomendado) bajo el dominio `www.grupoaludra.com`.

## 1. Requisitos Previos del Servidor

Asegúrate de tener instalado lo siguiente en tu servidor:

*   **Node.js** (v18 o superior)
*   **PostgreSQL** (v14 o superior)
*   **Nginx** (Servidor Web / Proxy Inverso)
*   **PM2** (Gestor de procesos para Node.js)
*   **Git**

### Instalación rápida (Ubuntu):
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js (v18)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Instalar Nginx
sudo apt install -y nginx

# Instalar PM2 y TypeScript globalmente
sudo npm install -g pm2 typescript ts-node
```

## 2. Configuración de la Base de Datos

1.  Accede a PostgreSQL:
    ```bash
    sudo -u postgres psql
    ```

2.  Crea la base de datos y el usuario:
    ```sql
    CREATE DATABASE fink_db;
    CREATE USER fink_user WITH ENCRYPTED PASSWORD 'tu_password_seguro';
    GRANT ALL PRIVILEGES ON DATABASE fink_db TO fink_user;
    \q
    ```

## 3. Preparación del Proyecto

1.  Clona tu repositorio en el servidor (ej. en `/var/www/fink`):
    ```bash
    git clone <tu-repo-url> /var/www/fink
    cd /var/www/fink
    ```

2.  **Backend Setup:**
    ```bash
    cd backend
    npm install
    
    # Crear archivo .env
    cp .env.example .env
    nano .env
    ```
    
    **Configuración crítica en `.env` del Backend:**
    ```env
    PORT=4002
    DATABASE_URL="postgresql://fink_user:tu_password_seguro@localhost:5432/fink_db?schema=public"
    JWT_SECRET="tu_secreto_super_largo_y_seguro"
    # ... otras variables necesarias
    ```

    **Build y Migración:**
    ```bash
    # Generar cliente Prisma
    npx prisma generate
    
    # Ejecutar migraciones a la BD de producción
    npx prisma migrate deploy
    
    # (Opcional) Sembrar datos iniciales si es necesario
    # npx prisma db seed
    
    # Compilar TypeScript a JavaScript
    npm run build
    ```

3.  **Frontend Setup:**
    ```bash
    cd ../frontend
    npm install
    
    # Crear archivo .env.local
    nano .env.local
    ```

    **Configuración crítica en `.env.local` del Frontend:**
    ```env
    NEXT_PUBLIC_API_URL=https://www.grupoaludra.com/api
    # Asegúrate de que apunte a tu dominio con /api
    ```

    **Build:**
    ```bash
    npm run build
    ```

## 4. Ejecución con PM2

Desde la raíz del proyecto (`/var/www/fink`), ejecuta:

```bash
# Iniciar los procesos definidos en ecosystem.config.js
pm2 start ecosystem.config.js

# Guardar la lista de procesos para que inicien al reiniciar el servidor
pm2 save
pm2 startup
```

## 5. Configuración de Nginx (Reverse Proxy)

Crea un archivo de configuración para tu sitio:

```bash
sudo nano /etc/nginx/sites-available/grupoaludra.com
```

Pega el siguiente contenido (ajustando el dominio si es necesario):

```nginx
server {
    server_name www.grupoaludra.com grupoaludra.com;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend (API)
    location /api {
        proxy_pass http://localhost:4002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activa el sitio y reinicia Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/grupoaludra.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 6. Certificado SSL (HTTPS)

Para asegurar tu sitio con HTTPS gratis usando Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d www.grupoaludra.com -d grupoaludra.com
```

Sigue las instrucciones en pantalla. Certbot modificará automáticamente tu configuración de Nginx para usar HTTPS.

## 7. Verificación

1.  Entra a `https://www.grupoaludra.com`.
2.  Deberías ver la aplicación cargando.
3.  Intenta hacer login para verificar que la conexión con la API (`/api/...`) funciona correctamente.

---

### Comandos Útiles de Mantenimiento

*   **Ver logs:** `pm2 logs`
*   **Reiniciar todo:** `pm2 restart all`
*   **Actualizar cambios:**
    1.  `git pull`
    2.  `cd backend && npm run build`
    3.  `cd ../frontend && npm run build`
    4.  `pm2 restart all`
