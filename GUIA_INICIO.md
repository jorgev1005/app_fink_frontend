# 🚀 Guía de Inicio Rápido - FINK Sistema Administrativo

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Instalación](#instalación)
3. [Configuración](#configuración)
4. [Ejecución](#ejecución)
5. [Estructura del Proyecto](#estructura-del-proyecto)
6. [Módulos Principales](#módulos-principales)

---

## ✅ Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** 18 o superior
- **PostgreSQL** 14 o superior
- **Git**
- **npm** o **yarn**

---

## 📦 Instalación

### 1. Clonar el Repositorio

```powershell
cd d:\Documentos\espacio_vc\app_fink
```

### 2. Instalar Dependencias

#### Instalar todas las dependencias (recomendado)

```powershell
npm run install:all
```

O manualmente:

```powershell
# Instalar dependencias del root
npm install

# Instalar dependencias del backend
cd backend
npm install

# Instalar dependencias del frontend
cd ../frontend
npm install
```

---

## ⚙️ Configuración

### 1. Configurar PostgreSQL

Crear la base de datos:

```sql
CREATE DATABASE fink_db;
CREATE USER fink_user WITH ENCRYPTED PASSWORD 'tu_password';
GRANT ALL PRIVILEGES ON DATABASE fink_db TO fink_user;
```

### 2. Configurar Backend

Copiar y editar el archivo de variables de entorno:

```powershell
cd backend
copy .env.example .env
```

Editar `backend/.env` con tus configuraciones:

```env
DATABASE_URL="postgresql://fink_user:tu_password@localhost:5432/fink_db?schema=public"
PORT=4000
JWT_SECRET=tu_clave_secreta_muy_segura
OPENAI_API_KEY=sk-tu_api_key_de_openai
```

### 3. Configurar Frontend

```powershell
cd ../frontend
copy .env.example .env.local
```

Editar `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXTAUTH_SECRET=tu_clave_secreta
```

### 4. Inicializar Base de Datos

```powershell
cd ../backend
npx prisma generate
npx prisma migrate dev --name init
```

Esto creará todas las tablas necesarias en PostgreSQL.

---

## 🚀 Ejecución

### Opción 1: Ejecutar Todo (Recomendado)

Desde la raíz del proyecto:

```powershell
npm run dev
```

Esto ejecutará tanto el backend como el frontend simultáneamente.

### Opción 2: Ejecutar por Separado

#### Terminal 1 - Backend:

```powershell
cd backend
npm run dev
```

El backend estará en: http://localhost:4000

#### Terminal 2 - Frontend:

```powershell
cd frontend
npm run dev
```

El frontend estará en: http://localhost:3000

---

## 🏗️ Estructura del Proyecto

```
app_fink/
├── backend/                    # API REST - Node.js + Express + TypeScript
│   ├── prisma/
│   │   └── schema.prisma      # Esquema de base de datos
│   ├── src/
│   │   ├── controllers/       # Controladores de rutas
│   │   ├── services/          # Lógica de negocio
│   │   │   ├── exchangeRate.service.ts  # Tasas de cambio BCV
│   │   │   ├── ai.service.ts           # Integración con OpenAI
│   │   │   ├── whatsapp.service.ts     # WhatsApp Business
│   │   │   ├── cron.service.ts         # Tareas programadas
│   │   │   └── document.service.ts     # Gestión de documentos
│   │   ├── routes/           # Definición de rutas
│   │   ├── middleware/       # Middlewares (auth, validación)
│   │   ├── config/           # Configuraciones
│   │   └── index.ts          # Punto de entrada
│   ├── .env                  # Variables de entorno (crear desde .env.example)
│   └── package.json
│
├── frontend/                  # Aplicación Next.js + React
│   ├── src/
│   │   ├── app/              # App Router de Next.js
│   │   │   ├── dashboard/    # Dashboard principal
│   │   │   ├── projects/     # Gestión de proyectos
│   │   │   ├── transactions/ # Transacciones
│   │   │   └── documents/    # Documentos
│   │   ├── components/       # Componentes reutilizables
│   │   ├── lib/             # Utilidades
│   │   │   └── api.ts       # Cliente API
│   │   └── hooks/           # Custom React Hooks
│   ├── public/              # Archivos estáticos
│   ├── .env.local           # Variables de entorno (crear desde .env.example)
│   └── package.json
│
├── docs/                     # Documentación
├── README.md                 # Este archivo
└── package.json             # Scripts root
```

---

## 📊 Módulos Principales

### 1. 🏢 **Gestión de Proyectos**

- Crear y administrar múltiples proyectos/unidades de negocio
- Vista consolidada de capital
- Transferencias entre proyectos

**Endpoints:**
- `GET /api/projects` - Listar proyectos
- `POST /api/projects` - Crear proyecto
- `GET /api/projects/:id/summary` - Resumen financiero

### 2. 💰 **Sistema Multi-Moneda**

- Soporte para Bs, USD y EUR
- Actualización automática desde BCV
- Tasas personalizadas

**Endpoints:**
- `GET /api/exchange-rates/latest` - Última tasa
- `GET /api/exchange-rates/history` - Historial

### 3. 📈 **Transacciones Contables**

- Registro de ingresos/egresos
- Transferencias entre cuentas
- Conversión automática de monedas
- Categorización con IA

### 4. 📄 **Gestión de Documentos**

- Facturas, recibos, contratos
- Alertas de vencimiento automáticas
- OCR con IA para extracción de datos

### 5. 🤖 **Inteligencia Artificial**

- Análisis predictivo de gastos
- Categorización automática
- Generación de informes ejecutivos
- Alertas proactivas

**Endpoints:**
- `GET /api/ai/insights` - Insights de IA
- `POST /api/ai/analyze-document` - Analizar documento
- `POST /api/ai/generate-report` - Generar informe

### 6. 💬 **Integración WhatsApp**

- Envío de notificaciones
- Alertas de vencimientos
- Informes automáticos

### 7. 📊 **Dashboards**

- Dashboard general consolidado
- Dashboard por proyecto
- KPIs en tiempo real
- Gráficos interactivos

**Endpoints:**
- `GET /api/dashboard` - Dashboard general
- `GET /api/dashboard/project/:id` - Dashboard del proyecto

---

## 🔐 Autenticación

### Registrar Usuario

```bash
POST http://localhost:4000/api/auth/register
Content-Type: application/json

{
  "email": "admin@fink.com",
  "password": "Password123!",
  "firstName": "Admin",
  "lastName": "Sistema",
  "role": "ADMIN"
}
```

### Login

```bash
POST http://localhost:4000/api/auth/login
Content-Type: application/json

{
  "email": "admin@fink.com",
  "password": "Password123!"
}
```

Respuesta:
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

Usar el token en todas las peticiones:
```
Authorization: Bearer <token>
```

---

## 🔄 Tareas Programadas (Cron Jobs)

El sistema ejecuta automáticamente:

- **9:00 AM** - Actualización de tasas de cambio del BCV
- **8:00 AM** - Verificación de documentos por vencer
- **Lunes 7:00 AM** - Generación de insights de IA

---

## 🛠️ Comandos Útiles

### Backend

```powershell
# Desarrollo
npm run dev

# Compilar
npm run build

# Producción
npm start

# Prisma Studio (GUI para la BD)
npx prisma studio

# Crear migración
npx prisma migrate dev --name nombre_migracion

# Regenerar cliente Prisma
npx prisma generate
```

### Frontend

```powershell
# Desarrollo
npm run dev

# Compilar
npm run build

# Producción
npm start

# Linter
npm run lint
```

---

## 🐛 Solución de Problemas

### Error: "Cannot connect to database"

1. Verifica que PostgreSQL esté corriendo
2. Confirma las credenciales en `.env`
3. Verifica que la base de datos existe

```powershell
# Ver servicios de PostgreSQL
Get-Service postgresql*

# Iniciar PostgreSQL
Start-Service postgresql-x64-14
```

### Error: "Port already in use"

Cambia el puerto en `.env` (backend) o detén el proceso:

```powershell
# Ver qué proceso usa el puerto 4000
netstat -ano | findstr :4000

# Terminar proceso (reemplaza PID)
taskkill /PID <pid> /F
```

### Error de dependencias

```powershell
# Limpiar y reinstalar
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
```

---

## 📚 Recursos Adicionales

- [Documentación de Prisma](https://www.prisma.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Express.js](https://expressjs.com/)
- [OpenAI API](https://platform.openai.com/docs)

---

## 🤝 Soporte

Para dudas o problemas:
1. Revisa la documentación en `/docs`
2. Verifica los logs del servidor
3. Consulta el equipo de desarrollo

---

## 📝 Notas Importantes

- ⚠️ Cambia las claves secretas en producción
- ⚠️ Configura copias de seguridad automáticas de la BD
- ⚠️ Usa HTTPS en producción
- ⚠️ Configura variables de entorno de producción adecuadamente

---

**¡Listo! 🎉 Tu sistema administrativo FINK está configurado y funcionando.**
