-- ============================================================
-- GlobeTrotterAPP - PostgreSQL + PostGIS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    preferences JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token UUID DEFAULT NULL
);

-- ============================================================
-- SITES
-- ============================================================

CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255) NOT NULL,
    author VARCHAR(100) NOT NULL DEFAULT 'anonyme',
    image_url VARCHAR(500),
    difficulty VARCHAR(20)
        CHECK (difficulty IN ('easy','moderate','difficult')),
    dangerosity VARCHAR(20)
        CHECK (dangerosity IN ('low','moderate','high')),
    category VARCHAR(20) DEFAULT 'other'
        CHECK (
            category IN (
                'nature',
                'culture',
                'adventure',
                'relaxation',
                'mountain',
                'beach',
                'other'
            )
        ),
    price INTEGER,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_sites_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

-- ============================================================
-- RATINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS ratings (
    id SERIAL PRIMARY KEY,
    site_id UUID NOT NULL,
    rating SMALLINT NOT NULL
        CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ratings_site
        FOREIGN KEY (site_id)
        REFERENCES sites(id)
        ON DELETE CASCADE
);

-- ============================================================
-- LIEUX TOURISTIQUES (OpenStreetMap)
-- ============================================================

CREATE TABLE IF NOT EXISTS lieux_touristiques (
    id BIGSERIAL PRIMARY KEY,
    osm_id BIGINT UNIQUE,

    name VARCHAR(255) NOT NULL,

    category VARCHAR(30) NOT NULL
        CHECK (
            category IN (
                'hotel',
                'restaurant',
                'hopital',
                'clinique',
                'pharmacie',
                'site_touristique'
            )
        ),

    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,

    address VARCHAR(255),
    phone VARCHAR(255),

    geom GEOMETRY(Point, 4326),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

CREATE INDEX IF NOT EXISTS idx_sites_category
ON sites(category);

CREATE INDEX IF NOT EXISTS idx_sites_location
ON sites(location);

CREATE INDEX IF NOT EXISTS idx_sites_user_id
ON sites(user_id);

CREATE INDEX IF NOT EXISTS idx_ratings_site_id
ON ratings(site_id);

CREATE INDEX IF NOT EXISTS idx_lieux_category
ON lieux_touristiques(category);

CREATE INDEX IF NOT EXISTS idx_lieux_geom
ON lieux_touristiques
USING GIST (geom);

-- ============================================================
-- TRIGGER : synchronise geom avec latitude / longitude
-- ============================================================

CREATE OR REPLACE FUNCTION update_lieu_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom := ST_SetSRID(
        ST_MakePoint(NEW.longitude, NEW.latitude),
        4326
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_lieu_geom
ON lieux_touristiques;

CREATE TRIGGER trigger_update_lieu_geom
BEFORE INSERT OR UPDATE OF latitude, longitude
ON lieux_touristiques
FOR EACH ROW
EXECUTE FUNCTION update_lieu_geom();

-- Ajoute la colonne manquante osm_type
ALTER TABLE lieux_touristiques
    ADD COLUMN IF NOT EXISTS osm_type VARCHAR(10)
    CHECK (osm_type IN ('node', 'way', 'relation'));

-- Remplace la contrainte UNIQUE(osm_id) par une contrainte composite,
-- cohérente avec le fait que les IDs OSM ne sont uniques que par type
ALTER TABLE lieux_touristiques
    DROP CONSTRAINT IF EXISTS lieux_touristiques_osm_id_key;

ALTER TABLE lieux_touristiques
    ADD CONSTRAINT lieux_touristiques_osm_uniq
    UNIQUE (osm_type, osm_id);




