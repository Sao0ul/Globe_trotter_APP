CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  preferences JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token UUID DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255) NOT NULL,
  author VARCHAR(100) NOT NULL DEFAULT 'anonyme',
  image_url VARCHAR(500) DEFAULT NULL,
  difficulty VARCHAR(16) CHECK (difficulty IN ('easy', 'moderate', 'difficult')) DEFAULT NULL,
  dangerosity VARCHAR(16) CHECK (dangerosity IN ('low', 'moderate', 'high')) DEFAULT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'other' CHECK (category IN ('nature', 'culture', 'adventure', 'relaxation', 'mountain', 'beach', 'other')),
  price INTEGER DEFAULT NULL,
  user_id UUID DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_sites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ratings (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_ratings_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sites_category ON sites(category);
CREATE INDEX IF NOT EXISTS idx_sites_location ON sites(location);
CREATE INDEX IF NOT EXISTS idx_ratings_site_id ON ratings(site_id);
