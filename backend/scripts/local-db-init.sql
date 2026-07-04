SELECT 'CREATE DATABASE kilimanjaro_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kilimanjaro_db')\gexec

\connect kilimanjaro_db

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS students;
CREATE SCHEMA IF NOT EXISTS academics;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS elearning;

GRANT ALL PRIVILEGES ON DATABASE kilimanjaro_db TO postgres;
GRANT ALL ON SCHEMA public, auth, students, academics, finance, notifications, analytics, elearning TO postgres;
