# 🚀 FINK - Sistema Administrativo Multi-Proyecto

## ✅ Estado Actual del Sistema

### Servicios Corriendo:

1. **Backend API** ✅
   - URL: http://localhost:4000
   - Health Check: http://localhost:4000/health
   - Corriendo en: PowerShell Job #3

2. **Frontend Next.js** ✅
   - URL: http://localhost:3000
   - Corriendo en terminal separada

3. **PostgreSQL (Docker)** ✅
   - Contenedor: fink-postgres
   - Puerto: 5432
   - Base de datos: fink_db

---

## 🔐 Credenciales de Acceso

### Usuario Administrador
- **Email:** admin@fink.com
- **Password:** Admin123!
- **Role:** ADMIN

---

## 📱 Cómo Usar el Sistema

### 1. Acceder a la Aplicación

Abre tu navegador en: http://localhost:3000

La aplicación te redirigirá automáticamente a la página de login.

### 2. Iniciar Sesión

1. En la página de login, las credenciales ya están pre-rellenadas
2. Haz clic en "Iniciar Sesión"
3. Serás redirigido al Dashboard

### 3. Dashboard Principal

El dashboard muestra:
- **Estadísticas Generales**: Proyectos, Balance Total, Documentos, Notificaciones
- **Acciones Rápidas**: Botones para crear proyectos, transacciones y documentos
- **Estado del Sistema**: Información de conectividad

---

## 🛠️ Comandos Útiles

### Backend

```powershell
# Ver estado del Job del backend
Get-Job -Id 3

# Ver logs del backend
Receive-Job -Id 3 -Keep

# Detener el backend
Stop-Job -Id 3

# Reiniciar el backend
cd D:\Documentos\espacio_vc\app_fink\backend
& .\start-server.ps1
```

### Frontend

```powershell
# El frontend está corriendo en una terminal separada
# Para reiniciarlo, ve a la terminal y presiona Ctrl+C, luego:
cd D:\Documentos\espacio_vc\app_fink\frontend
npm run dev
```

### PostgreSQL (Docker)

```powershell
# Ver estado del contenedor
docker ps --filter "name=fink-postgres"

# Ver logs
docker logs fink-postgres

# Detener
docker stop fink-postgres

# Iniciar
docker start fink-postgres

# Reiniciar
docker restart fink-postgres

# Conectar a la base de datos
docker exec -it fink-postgres psql -U postgres -d fink_db
```

### Prisma

```powershell
cd D:\Documentos\espacio_vc\app_fink\backend

# Ver la base de datos visualmente
npx prisma studio
# Se abrirá en http://localhost:5555

# Generar cliente Prisma
npx prisma generate

# Crear una nueva migración
npx prisma migrate dev --name nombre_migracion

# Ver el estado de las migraciones
npx prisma migrate status
```

---

## 🔧 Desarrollo

### Crear un Nuevo Proyecto (via API)

```powershell
# Primero, obtén tu token de autenticación
$loginBody = @{
    email = "admin@fink.com"
    password = "Admin123!"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri http://localhost:4000/api/auth/login -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginResponse.data.token

# Crear un proyecto
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$projectBody = @{
    name = "Mi Primer Proyecto"
    description = "Proyecto de prueba"
    currency = "VES"
    budget = 100000
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:4000/api/projects -Method Post -Headers $headers -Body $projectBody
```

### Ver Proyectos

```powershell
# Listar todos los proyectos
Invoke-RestMethod -Uri http://localhost:4000/api/projects -Method Get -Headers $headers
```

### Ver Tipos de Cambio Actuales

```powershell
# Ver la tasa de cambio más reciente
Invoke-RestMethod -Uri http://localhost:4000/api/exchange-rates/latest -Method Get
```

---

## 📊 Endpoints Disponibles

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/profile` - Ver perfil (requiere auth)
- `PATCH /api/auth/profile` - Actualizar perfil (requiere auth)

### Proyectos
- `GET /api/projects` - Listar proyectos
- `POST /api/projects` - Crear proyecto
- `GET /api/projects/:id` - Ver proyecto
- `GET /api/projects/:id/summary` - Ver resumen del proyecto
- `PATCH /api/projects/:id` - Actualizar proyecto
- `DELETE /api/projects/:id` - Eliminar proyecto

### Dashboard
- `GET /api/dashboard` - Resumen general
- `GET /api/dashboard/project/:id` - Dashboard de un proyecto

### Tipos de Cambio
- `GET /api/exchange-rates/latest` - Tasa más reciente
- `GET /api/exchange-rates/history?days=30` - Historial
- `POST /api/exchange-rates/custom` - Crear tasa personalizada
- `POST /api/exchange-rates/update` - Actualizar desde BCV

### IA
- `GET /api/ai/insights` - Ver insights generales
- `GET /api/ai/insights?projectId=xxx` - Insights de un proyecto
- `POST /api/ai/analyze-document` - Analizar documento
- `POST /api/ai/generate-report` - Generar reporte

### Notificaciones
- `GET /api/notifications` - Listar todas
- `GET /api/notifications?unreadOnly=true` - Solo no leídas
- `PUT /api/notifications/:id/read` - Marcar como leída

---

## 🐛 Troubleshooting

### El backend no responde

```powershell
# Verificar si el Job está corriendo
Get-Job -Id 3

# Ver los logs
Receive-Job -Id 3 -Keep

# Si no está corriendo, reiniciar
cd D:\Documentos\espacio_vc\app_fink\backend
& .\start-server.ps1
```

### El frontend muestra error de conexión

1. Verificar que el backend esté corriendo en http://localhost:4000
2. Verificar el archivo `.env.local` en el frontend:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:4000/api
   ```

### Error de base de datos

```powershell
# Verificar que PostgreSQL esté corriendo
docker ps --filter "name=fink-postgres"

# Si no está corriendo, iniciar
docker start fink-postgres

# Ver logs de PostgreSQL
docker logs fink-postgres
```

### Reiniciar todo el sistema

```powershell
# 1. Detener backend
Stop-Job -Id 3

# 2. Detener PostgreSQL
docker stop fink-postgres

# 3. Iniciar PostgreSQL
docker start fink-postgres

# 4. Esperar 5 segundos
Start-Sleep -Seconds 5

# 5. Iniciar backend
cd D:\Documentos\espacio_vc\app_fink\backend
& .\start-server.ps1

# 6. El frontend debería seguir corriendo
# Si no, ir a la terminal y ejecutar:
# cd D:\Documentos\espacio_vc\app_fink\frontend
# npm run dev
```

---

## 📝 Próximos Pasos de Desarrollo

1. **Módulo de Transacciones** - Registrar ingresos/egresos multi-moneda
2. **Módulo de Cuentas** - Gestión de cuentas bancarias y cajas
3. **Reportes Avanzados** - Gráficos y análisis detallados
4. **Integración WhatsApp** - Notificaciones y reportes por WhatsApp
5. **IA Avanzada** - Análisis de documentos con OCR y extracción de datos
6. **Gestión de Usuarios** - Roles y permisos avanzados

---

## 📞 Recursos Adicionales

- **Documentación de Prisma**: https://www.prisma.io/docs
- **Documentación de Next.js**: https://nextjs.org/docs
- **Documentación de Express**: https://expressjs.com/
- **PostgreSQL Docker**: https://hub.docker.com/_/postgres

---

**¡El sistema está listo para usar!** 🎉

Puedes empezar a crear proyectos, registrar transacciones y explorar todas las funcionalidades del sistema.
