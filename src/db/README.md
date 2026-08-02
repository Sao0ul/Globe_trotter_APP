# src/db — contrôle éditorial des données

Voir `architecture.tree` pour la structure des dossiers.

## Règle du jeu

- **`database/sites/<slug>.json`** — 1 fichier par site touristique.
  Champs : `description`, `bonASavoir`, `imageUrl`, **`videoUrl`**.
- **`database/lieux/<categorie>/<slug>.json`** — 1 fichier par lieu
  (hôtels, restaurants, hôpitaux, cliniques, pharmacies).
  Champs : `description`, `bonASavoir`, `imageUrl`.
  **Pas de `videoUrl`** — seuls les sites touristiques ont une vidéo.
- Le nom de fichier est `<nom-slugifié>-<type-osm><id-osm>.json`
  (ex. `centre-de-sante-n7412233.json`). L'ID OSM est ajouté car les
  noms ne sont pas uniques dans les données (des dizaines de lieux
  s'appellent juste "Centre de Santé" ou "Pharmacie").

## Éditer un lieu

Ouvre directement son fichier JSON et remplis les champs à la main.
Aucune commande à lancer pour cette étape.

Pour une image/vidéo **locale**, dépose le fichier dans
`database/assets/images/<categorie>/` (ou `assets/videos/sites/`
pour les vidéos) et mets un chemin relatif dans `imageUrl`/`videoUrl`,
ex. `"assets/images/hotels/hotel-la-falaise-w1234.jpg"`. Une URL
classique (`https://...`) fonctionne aussi bien.

## Ré-extraire depuis un `export.geojson` mis à jour

```bash
docker compose exec api node src/db/scripts/extractCategoriesFromGeojson.js
```

- Régénère `database/raw/*.json` en entier (jetable).
- Pour chaque lieu déjà connu (même `osm_type`+`osm_id`), met à jour
  seulement les champs venant d'OSM (nom, adresse, téléphone,
  coordonnées, catégorie) — **ne touche jamais** à `description`,
  `bonASavoir`, `imageUrl`, `videoUrl` déjà remplis à la main.
- Crée un nouveau fichier pour tout lieu qui n'existait pas encore.
- Un lieu disparu de `export.geojson` n'est **pas supprimé** — le
  fichier reste, à toi de le nettoyer manuellement si besoin.

## Insérer en base (Postgres/Aiven)

```bash
docker compose exec api node src/db/scripts/seedSitesFromDatabase.js
docker compose exec api node src/db/scripts/seedLieuxFromDatabase.js
```

Chacun lit tous les fichiers de son dossier et fait un
`INSERT ... ON CONFLICT (osm_type, osm_id) DO UPDATE`, donc relancer
plusieurs fois est sans danger.

## Notes

- La colonne `video_url` existe aussi sur `lieux_touristiques` (table
  SQL) mais n'est volontairement jamais remplie par
  `seedLieuxFromDatabase.js` — réservée à un usage futur.
- L'ancien dossier `seed/` (manifestes de démo + galerie multi-média
  via `site_media`) a été supprimé : il ne correspondait plus au
  modèle actuel (1 image + 1 vidéo par lieu, pas de galerie).
- Les anciens scripts qui écrivaient directement en base sans étape
  éditoriale (`importGeojson.js`, `seedSitesFromGeojson.js`,
  `fillMissingSiteImages.js` — ce dernier appelait l'API Pexels) ont
  été supprimés. La logique d'extraction réutilisable de
  `importGeojson.js` vit maintenant dans `lib/geojsonHelpers.js`.
