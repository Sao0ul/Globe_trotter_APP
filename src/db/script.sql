-- ============================================================
-- GlobeTrotterAPP — Schéma PostgreSQL + PostGIS
-- Fichier UNIQUE et AUTORITAIRE : remplace schema.sql et script.sql,
-- qui divergeaient et dont script.sql était corrompu (deux migrations
-- collées sans nettoyage). C'est ce fichier que bootstrap.js applique.
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
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token UUID DEFAULT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SITES — destinations à explorer, consultées via /api/sites.
-- Alimentées soit manuellement (author = pseudo utilisateur),
-- soit automatiquement depuis OSM (author = 'OpenStreetMap',
-- osm_type/osm_id renseignés pour éviter les doublons de ré-import).
-- ============================================================

CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    bon_a_savoir TEXT,
    location VARCHAR(255) NOT NULL,
    author VARCHAR(100) NOT NULL DEFAULT 'anonyme',
    image_url VARCHAR(500),
    video_url VARCHAR(500) DEFAULT NULL,
    video_par VARCHAR(100),
    difficulty VARCHAR(20)
        CHECK (difficulty IN ('easy', 'moderate', 'difficult')),
    dangerosity VARCHAR(20)
        CHECK (dangerosity IN ('low', 'moderate', 'high')),
    category VARCHAR(20) NOT NULL DEFAULT 'other'
        CHECK (category IN (
            'nature', 'culture', 'adventure',
            'relaxation', 'mountain', 'beach', 'other'
        )),
    price INTEGER DEFAULT 0 CHECK (price >= 0),
    user_id UUID,

    -- Coordonnées : indispensables pour calculer un itinéraire entre
    -- deux sites (voir importSitesFromGeojson.js, qui doit les remplir).
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),

    -- Référence OSM : NULL pour les sites créés manuellement.
    -- Postgres autorise plusieurs NULL sur une contrainte UNIQUE,
    -- donc ça ne bloque pas les sites non issus d'OSM.
    osm_type VARCHAR(10) CHECK (osm_type IN ('node', 'way', 'relation')),
    osm_id BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_sites_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT sites_osm_uniq UNIQUE (osm_type, osm_id)
);

ALTER TABLE IF EXISTS sites
    ADD COLUMN IF NOT EXISTS bon_a_savoir TEXT,
    ADD COLUMN IF NOT EXISTS image_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS video_url VARCHAR(500);

-- ============================================================
-- SITE_MEDIA — galerie associée à un site (plusieurs images/vidéos,
-- avec légende et ordre d'affichage). C'est ICI que doit vivre le
-- "bon à savoir + image + vidéo" par site, pas dans une seule
-- colonne image_url/video_url sur sites (qui ne garde qu'un seul média).
-- ============================================================

CREATE TABLE IF NOT EXISTS site_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video')),
    url TEXT NOT NULL,
    label VARCHAR(255),
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_site_media_site
        FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- ============================================================
-- RATINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS ratings (
    id SERIAL PRIMARY KEY,
    site_id UUID NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ratings_site
        FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- ============================================================
-- LIEUX_TOURISTIQUES — hôtels, restaurants, santé, pharmacies.
-- Utilisés UNIQUEMENT pour l'API itinéraire (afficher ce qui se
-- trouve entre deux sites), jamais exposés via /api/sites.
-- ============================================================

CREATE TABLE IF NOT EXISTS lieux_touristiques (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(30) NOT NULL
        CHECK (category IN (
            'hotel', 'restaurant', 'hopital',
            'clinique', 'pharmacie', 'site_touristique'
        )),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address VARCHAR(255),
    phone VARCHAR(255),
    description TEXT,
    bon_a_savoir TEXT,
    image_url VARCHAR(500),
    video_url VARCHAR(500),
    geom GEOMETRY(Point, 4326),

    -- Référence OSM composite : les ID OSM ne sont uniques que
    -- PAR type (un node/123 et un way/123 sont deux lieux différents).
    osm_type VARCHAR(10) NOT NULL CHECK (osm_type IN ('node', 'way', 'relation')),
    osm_id BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT lieux_touristiques_osm_uniq UNIQUE (osm_type, osm_id)
);

ALTER TABLE IF EXISTS lieux_touristiques
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS bon_a_savoir TEXT,
    ADD COLUMN IF NOT EXISTS image_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS video_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS geom GEOMETRY(Point, 4326);

-- ============================================================
-- INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sites_category ON sites(category);
CREATE INDEX IF NOT EXISTS idx_sites_location ON sites(location);
CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_site_media_site_id ON site_media(site_id);
CREATE INDEX IF NOT EXISTS idx_ratings_site_id ON ratings(site_id);
CREATE INDEX IF NOT EXISTS idx_lieux_category ON lieux_touristiques(category);
CREATE INDEX IF NOT EXISTS idx_lieux_geom ON lieux_touristiques USING GIST (geom);

-- ============================================================
-- TRIGGER : synchronise geom avec latitude/longitude à chaque
-- insertion ou modification (lieux_touristiques uniquement —
-- sites n'a volontairement pas de colonne geom, latitude/longitude
-- suffisent pour l'usage actuel ; à revoir si un jour on veut
-- des requêtes géospatiales complexes directement sur sites).
-- ============================================================

CREATE OR REPLACE FUNCTION update_lieu_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_lieu_geom ON lieux_touristiques;

CREATE TRIGGER trigger_update_lieu_geom
BEFORE INSERT OR UPDATE OF latitude, longitude
ON lieux_touristiques
FOR EACH ROW
EXECUTE FUNCTION update_lieu_geom();