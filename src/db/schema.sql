CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  preferences JSONB DEFAULT '[]'::jsonb,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token UUID DEFAULT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  bon_a_savoir TEXT,
  location VARCHAR(255) NOT NULL,
  author VARCHAR(100) NOT NULL DEFAULT 'anonyme',
  image_url VARCHAR(500) DEFAULT NULL,
  difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'moderate', 'difficult')) DEFAULT NULL,
  dangerosity VARCHAR(20) CHECK (dangerosity IN ('low', 'moderate', 'high')) DEFAULT NULL,
  category VARCHAR(20) CHECK (category IN ('nature', 'culture', 'adventure', 'relaxation', 'mountain', 'beach', 'other')) NOT NULL DEFAULT 'other',
  price INT DEFAULT NULL,
  user_id UUID DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_sites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  site_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_ratings_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS site_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL,
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video')),
  url TEXT NOT NULL,
  label VARCHAR(255) DEFAULT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_site_media_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);
