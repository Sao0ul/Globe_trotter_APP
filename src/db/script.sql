DROP DATABASE IF EXISTS GlobeTrotterAPP_DB;
CREATE DATABASE GlobeTrotterAPP_DB;


use GlobeTrotterAPP_DB;




CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  preferences JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS sites (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255) NOT NULL,
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

ALTER TABLE sites
  ADD COLUMN image_url VARCHAR(500) DEFAULT NULL,
  ADD COLUMN difficulty ENUM('easy','moderate','difficult') DEFAULT NULL,
  ADD COLUMN dangerosity ENUM('low','moderate','high') DEFAULT NULL,
  ADD COLUMN category ENUM('nature','culture','adventure','relaxation','mountain','beach','other') DEFAULT 'other',
  ADD COLUMN price INT DEFAULT NULL;

ALTER TABLE sites
  ADD COLUMN user_id CHAR(36) DEFAULT NULL,
  ADD CONSTRAINT fk_sites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;






