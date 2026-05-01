-- Script de creación de base de datos para FINK
-- Ejecutar este script en PostgreSQL como superusuario

-- Crear la base de datos
CREATE DATABASE fink_db;

-- Crear usuario (opcional, puedes usar tu usuario existente)
-- CREATE USER fink_user WITH ENCRYPTED PASSWORD 'fink_password_2025';

-- Dar permisos
-- GRANT ALL PRIVILEGES ON DATABASE fink_db TO fink_user;

-- Conectar a la base de datos
\c fink_db;

-- Configuraciones adicionales
SET timezone = 'America/Caracas';

-- Mensaje de éxito
SELECT 'Base de datos fink_db creada exitosamente!' as mensaje;
