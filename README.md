# 🏢 Sistema Administrativo Multi-Proyecto FINK

Sistema administrativo moderno e intuitivo para gestión multi-proyecto con soporte multi-moneda, inteligencia artificial y integración con WhatsApp.

## ✨ Características Principales

### 📊 Gestión Multi-Proyecto
- Administración de múltiples unidades de negocio
- Vista consolidada del capital total
- Vista detallada por proyecto
- Transferencias entre proyectos

### 💰 Sistema Multi-Moneda
- Soporte para Bolívares (Bs), USD y EUR
- Integración con API del BCV para tasas actualizadas
- Tasa de cambio personalizada
- Conversión automática en transacciones

### 📈 Contabilidad Completa
- Registro de transacciones con doble entrada
- Libro mayor y balance general
- Flujo de caja por proyecto
- Transferencias entre cuentas
- Reportes financieros detallados

### 🤖 Inteligencia Artificial
- Detección automática de documentos por vencer
- Análisis predictivo de gastos
- Categorización automática de transacciones
- Generación automática de informes
- Recomendaciones financieras

### 💬 Integración WhatsApp
- Envío automático de informes
- Notificaciones de vencimientos
- Lectura y procesamiento de documentos
- Alertas de transacciones importantes

### 🎨 Interfaz Minimalista
- Diseño moderno y limpio
- Navegación intuitiva
- Responsive (móvil, tablet, desktop)
- Tema claro/oscuro
- Dashboards interactivos

## 🛠️ Stack Tecnológico

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS
- **Componentes**: Shadcn/ui
- **Gráficos**: Recharts
- **Autenticación**: NextAuth.js

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Lenguaje**: TypeScript
- **ORM**: Prisma
- **Base de Datos**: PostgreSQL

### Servicios Externos
- **IA**: OpenAI API (GPT-4)
- **WhatsApp**: WhatsApp Business API
- **Tasas de Cambio**: API BCV Venezuela

## 📁 Estructura del Proyecto

```
app_fink/
├── frontend/                 # Aplicación Next.js
│   ├── src/
│   │   ├── app/             # App Router de Next.js
│   │   ├── components/      # Componentes reutilizables
│   │   ├── lib/             # Utilidades y configuraciones
│   │   ├── hooks/           # Custom React Hooks
│   │   ├── types/           # Tipos de TypeScript
│   │   └── styles/          # Estilos globales
│   └── public/              # Archivos estáticos
│
├── backend/                 # API REST
│   ├── src/
│   │   ├── controllers/     # Controladores de rutas
│   │   ├── services/        # Lógica de negocio
│   │   ├── models/          # Modelos de Prisma
│   │   ├── middleware/      # Middlewares
│   │   ├── routes/          # Definición de rutas
│   │   ├── utils/           # Utilidades
│   │   └── config/          # Configuraciones
│   └── prisma/              # Esquema de base de datos
│
├── shared/                  # Código compartido
│   └── types/               # Tipos compartidos
│
└── docs/                    # Documentación
    ├── api/                 # Documentación de API
    ├── database/            # Diagramas de BD
    └── guides/              # Guías de uso
```

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 18+ 
- PostgreSQL 14+
- npm o yarn

### Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd app_fink
```

2. **Configurar Backend**
```bash
cd backend
npm install
cp .env.example .env
# Configurar variables de entorno
npx prisma migrate dev
npx prisma generate
npm run dev
```

3. **Configurar Frontend**
```bash
cd frontend
npm install
cp .env.example .env.local
# Configurar variables de entorno
npm run dev
```

4. **Acceder a la aplicación**
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000

## 📊 Módulos del Sistema

### 1. Dashboard General
- KPIs principales
- Gráficos de flujo de caja
- Resumen de capital por proyecto
- Alertas y notificaciones

### 2. Proyectos / Unidades de Negocio
- CRUD de proyectos
- Configuración de cuentas por proyecto
- Asignación de presupuestos
- Análisis de rentabilidad

### 3. Transacciones
- Registro de ingresos/egresos
- Transacciones multi-moneda
- Transferencias entre cuentas
- Transferencias entre proyectos
- Conciliación bancaria

### 4. Contabilidad
- Plan de cuentas
- Libro diario
- Libro mayor
- Balance general
- Estado de resultados
- Flujo de efectivo

### 5. Documentos
- Gestión de facturas
- Control de pagos
- Documentos por cobrar/pagar
- Alertas de vencimiento
- Archivo digital

### 6. Reportes e Informes
- Reportes financieros personalizados
- Exportación a PDF/Excel
- Programación de envíos automáticos
- Informes de IA predictivos

### 7. Configuración
- Gestión de usuarios
- Permisos y roles
- Tipos de cambio
- Categorías y subcategorías
- Integración con APIs externas

## 🔐 Seguridad

- Autenticación JWT
- Encriptación de datos sensibles
- Control de acceso basado en roles (RBAC)
- Auditoría de transacciones
- Backup automático

## 📱 Características de WhatsApp

- Envío de reportes diarios/semanales/mensuales
- Notificaciones de documentos por vencer
- Alertas de transacciones importantes
- Consultas por comandos de texto
- Compartir y procesar documentos (fotos de facturas)

## 🤖 Capacidades de IA

- **OCR Inteligente**: Extracción de datos de facturas y documentos
- **Categorización Automática**: Clasificación de gastos e ingresos
- **Predicción de Vencimientos**: Alertas proactivas
- **Análisis de Patrones**: Identificación de tendencias de gasto
- **Recomendaciones**: Sugerencias para optimización financiera
- **Generación de Informes**: Resúmenes ejecutivos automáticos

## 📖 Documentación Adicional

- [Guía de Usuario](./docs/guides/user-guide.md)
- [Documentación de API](./docs/api/README.md)
- [Modelo de Base de Datos](./docs/database/schema.md)
- [Guía de Contribución](./docs/guides/contributing.md)

## 📝 Licencia

Este proyecto es privado y confidencial.

## 👥 Soporte

Para soporte y consultas, contactar al equipo de desarrollo.

---

**Versión**: 1.0.0  
**Última Actualización**: Octubre 2025
