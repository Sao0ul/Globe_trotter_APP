Guide de démarrage et flux applicatifs — GlobeTrotter App

But: ce fichier explique en français les différents flux et comment lancer tout (localement avec Docker ou en développement sans Docker).

Important: la base de données et l'application sont séparées. Le démarrage de l'application n'applique PAS automatiquement le schéma. Utiliser les commandes ci-dessous pour initialiser ou réinitialiser la base.

1) Vue d'ensemble des composants

- api (Express) : code source dans src/. Fournit les endpoints REST :
  - /api/auth  : authentification et gestion des utilisateurs
  - /api/sites : gestion des "sites" touristiques (création, recherche, notation)
  - /api/users : opérations liées aux utilisateurs

- db : scripts et utilitaires pour la base de données PostgreSQL :
  - src/db/schema.sql  : ancien schéma. Le bootstrap Node.js utilise désormais src/db/script.sql.
  - src/db/script.sql  : schéma autoritaire utilisé par bootstrap et par Docker.
  - src/db/bootstrap.js : utilitaire Node.js qui applique script.sql sur la DB connectée
  - src/db/scripts    : scripts pour extraire des fichiers JSON éditables à partir du GeoJSON et seeder les tables depuis ces fichiers.
  - src/db/seed       : scripts pour insérer des données d'exemple (seed-sites.js)

- tests : tests unitaires et d'intégration avec Jest

2) Commandes pour initialiser / réinitialiser la base (séparées de l'app)

- Initialiser la base (applique script.sql) sur la DB configurée via .env :
  npm run db:bootstrap

- Extraire le GeoJSON vers des fichiers JSON éditables :
  npm run db:extract

- Seed (données d'exemple) :
  npm run db:seed-sites

- Seed sites et lieux depuis les fichiers JSON enrichis :
  npm run db:seed-sites-db
  npm run db:seed-lieux-db

- Tout en une (bootstrap + seed) :
  npm run db:seed

Ces commandes attendent que PostgreSQL soit accessible selon les variables d'environnement (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).

3) Démarrage local (recommandé via Docker Compose)

- Prérequis : Docker et docker-compose installés.
- Fichiers d'environnement : .env (ou .env.local) à la racine — contient DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, PORT, etc.

Commandes :

- Démarrer les services (API + DB) :
  docker compose up --build

  Remarques :
  - À la première exécution, Docker initialise PostgreSQL et exécute le script d'initialisation monté depuis ./src/db/script.sql (via /docker-entrypoint-initdb.d).
  - Si le volume PostgreSQL (db_data) existe déjà, les scripts d'initialisation montés ne seront pas réexécutés. Dans ce cas, exécuter manuellement la commande d'initialisation depuis le host ou depuis le conteneur DB (voir section 4).

- Lancer uniquement l'API (si la DB est déjà prête) :
  npm run dev
  (ou docker compose up --build api si vous préférez démarrer seulement le service api)

- Arrêter et supprimer les volumes (si vous voulez forcer la réinitialisation de la DB) :
  docker compose down -v
  puis relancer : docker compose up --build

4) Commandes d'initialisation manuelles côté Docker

- Appliquer le schéma depuis l'hôte en ciblant le conteneur DB :
  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -f /docker-entrypoint-initdb.d/init.sql

- Ou copier/run directement le script fourni :
  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -f ./src/db/script.sql

5) Flux d'initialisation de la base et seed

- Sur une DB fraîche (volume vide), Docker exécute ./src/db/script.sql automatiquement via le mécanisme /docker-entrypoint-initdb.d.
- Sur une DB existante, exécuter npm run db:bootstrap pour appliquer les CREATE TABLE IF NOT EXISTS; puis npm run db:seed-sites pour insérer des données d'exemple.

6) Dépannage courant

- Erreur "relation \"site_media\" does not exist" -> le schéma n'a pas été appliqué sur la base.
  Solutions :
  - Utiliser Docker : docker compose down -v && docker compose up --build (réinitialise la DB et exécute script.sql)
  - Depuis le host : npm run db:bootstrap
  - Depuis le conteneur DB : docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -f ./src/db/script.sql

- Si npm run db:bootstrap échoue : vérifier les variables d'environnement dans .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME). Le script connecte la DB via src/db/pool.js.

7) Tests

- Lancer les tests : npm test
- Si les tests échouent à cause de la BD : s'assurer qu'une base de test est disponible et que les variables d'environnement de test pointent vers celle-ci.

8) Notes de maintenance et bonnes pratiques

- Le schéma utilise CREATE TABLE IF NOT EXISTS pour être idempotent — bootstrap peut être exécuté plusieurs fois.
- Pour les migrations plus avancées, envisager d'ajouter un outil de migration (ex: node-pg-migrate, Flyway, Liquibase) si le schéma évolue fréquemment.

---
Fichier généré automatiquement par l'assistant. Si vous voulez un guide plus détaillé (diagrammes d'architectures, séquences d'authentification, scripts de seed automatisés), demander explicitement et je l'ajouterai.