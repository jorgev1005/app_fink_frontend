# 🚀 Guía de Inicio Rápido - FINK

## Opción 1: Script Automático (Recomendado)

Simplemente haz **doble clic** en:
```
start-dev.cmd
```

Esto iniciará automáticamente:
- ✅ Docker Desktop (si no está corriendo)
- ✅ PostgreSQL
- ✅ Backend (puerto 4000)
- ✅ Frontend (puerto 3000)

## Opción 2: Manual con PowerShell

Abre PowerShell en este directorio y ejecuta:

```powershell
.\start-dev.ps1
```

## Opción 3: Manual Paso a Paso

### 1. Iniciar Docker y PostgreSQL
```powershell
docker start fink-postgres
```

### 2. Iniciar Backend (Terminal 1)
```powershell
cd backend
npm run dev
```

### 3. Iniciar Frontend (Terminal 2)
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force
cd frontend
npm run dev
```

## 📱 Acceder a la Aplicación

- **URL**: http://localhost:3000
- **Email**: admin@fink.com
- **Contraseña**: Admin123!

## 🔍 Verificar Estado

### Backend
```powershell
curl http://localhost:4000/health
```

### Frontend
Abrir en navegador: http://localhost:3000

### PostgreSQL
```powershell
docker ps --filter "name=fink-postgres"
```

## ⚠️ Solución de Problemas

### Error: "UnauthorizedAccess" al ejecutar npm
**Solución**: Ejecuta esto en tu terminal:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force
```

### Error: "Can't reach database server"
**Solución**: Verifica que PostgreSQL esté corriendo:
```powershell
docker start fink-postgres
```

### Error: "ChunkLoadError" en el navegador
**Solución**: Limpia el cache de Next.js:
```powershell
cd frontend
Remove-Item -Recurse -Force .next
npm run dev
```

### Puerto 3000 o 4000 ya en uso
**Solución**: Encuentra y mata el proceso:
```powershell
# Ver qué proceso usa el puerto
netstat -ano | findstr :3000
# Matar el proceso (reemplaza PID con el ID del proceso)
Stop-Process -Id PID -Force
```

## 🛑 Detener Servidores

Presiona **Ctrl+C** en cada terminal donde estén corriendo los servidores.

## 📚 Estructura del Proyecto

```
app_fink/
├── backend/           # API Node.js + Express + Prisma
├── frontend/          # Next.js + React + TypeScript
├── start-dev.ps1      # Script de inicio PowerShell
├── start-dev.cmd      # Launcher para Windows
└── README-INICIO.md   # Esta guía
```

## 🔗 Enlaces Útiles

- Dashboard: http://localhost:3000/dashboard
- Cuentas: http://localhost:3000/accounts
- Nueva Transacción: http://localhost:3000/transactions/new
- API Health: http://localhost:4000/health

---
**Última actualización**: Octubre 2025
