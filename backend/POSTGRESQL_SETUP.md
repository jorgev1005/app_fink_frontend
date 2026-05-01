# 🗄️ Configuración de PostgreSQL - Guía Rápida

## Opción 1: Usando pgAdmin (Recomendado para principiantes)

1. Abre **pgAdmin** (deberías tenerlo instalado con PostgreSQL)
2. Conecta a tu servidor PostgreSQL
3. Click derecho en "Databases" → "Create" → "Database"
4. Nombre: `fink_db`
5. Owner: tu usuario actual de PostgreSQL
6. Click "Save"

---

## Opción 2: Usando línea de comandos

### Paso 1: Abrir PowerShell como Administrador

Click derecho en PowerShell → "Ejecutar como administrador"

### Paso 2: Iniciar PostgreSQL

```powershell
Start-Service PostgreSQL_For_Odoo
```

### Paso 3: Crear la base de datos

```powershell
# Ruta típica de psql (ajusta según tu instalación)
cd "C:\Program Files\PostgreSQL\12\bin"

# Crear base de datos (reemplaza 'postgres' con tu usuario si es diferente)
.\psql -U postgres -c "CREATE DATABASE fink_db;"
```

### Verificar que se creó:

```powershell
.\psql -U postgres -c "\l" | Select-String "fink_db"
```

---

## Opción 3: Ejecutar el script SQL incluido

```powershell
cd "C:\Program Files\PostgreSQL\12\bin"
.\psql -U postgres -f "D:\Documentos\espacio_vc\app_fink\backend\create_database.sql"
```

---

## 🔑 Configurar credenciales en .env

Después de crear la base de datos, verifica que el archivo `backend/.env` tenga la URL correcta:

```env
DATABASE_URL="postgresql://TU_USUARIO:TU_PASSWORD@localhost:5432/fink_db?schema=public"
```

**Ejemplo común:**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fink_db?schema=public"
```

---

## ✅ Verificar conexión

Una vez configurado, ejecuta desde la carpeta `backend`:

```powershell
cd D:\Documentos\espacio_vc\app_fink\backend
npx prisma db push
```

Si conecta correctamente, verás: ✅ "Database synchronized"

---

## 🆘 Problemas comunes

### Error: "Connection refused"
- PostgreSQL no está corriendo
- Solución: Inicia el servicio (ver Opción 2, Paso 2)

### Error: "Authentication failed"
- Usuario/contraseña incorrectos
- Solución: Verifica tus credenciales en `.env`

### Error: "Database does not exist"
- La base de datos no fue creada
- Solución: Sigue los pasos de creación arriba

---

## 📞 ¿Necesitas ayuda?

Si tienes problemas, dime:
1. ¿Qué error exacto ves?
2. ¿Puedes abrir pgAdmin?
3. ¿Cuál es tu usuario de PostgreSQL?
