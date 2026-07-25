-- Crée ou met à jour l'utilisateur pour accepter les connexions externes
CREATE USER IF NOT EXISTS 'GlobeTrotter_user'@'%' IDENTIFIED BY 'GlobeTrotter_Password';

-- Accorde tous les privilèges sur la base de données de votre application
GRANT ALL PRIVILEGES ON GlobeTrotterAPP_DB.* TO 'GlobeTrotter_user'@'%';

-- Applique instantanément les changements
FLUSH PRIVILEGES;

use GlobeTrotterAPP_DB;




CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS sites (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'autre',
  author VARCHAR(100) NOT NULL DEFAULT 'anonyme',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_id CHAR(36) NOT NULL,
  rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Ajoute la gestion de la confirmation de compte à la table users existante
ALTER TABLE users
  ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN verification_token CHAR(36) DEFAULT NULL;