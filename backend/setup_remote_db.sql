CREATE USER grupoal1_finkuser WITH PASSWORD 'H3,z,gsjh7VxdVd_';
CREATE DATABASE grupoal1_finkdb OWNER grupoal1_finkuser;
GRANT ALL PRIVILEGES ON DATABASE grupoal1_finkdb TO grupoal1_finkuser;
ALTER USER grupoal1_finkuser CREATEDB;
