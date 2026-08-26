// ==========================================================
// Génère un nom de fichier lisible et STABLE pour un lieu
// individuel, à partir de son nom + sa référence OSM.
//
// Pourquoi ajouter la référence OSM au slug : les noms ne
// sont pas uniques dans les données (ex. des dizaines de
// lieux nommés juste "Centre de Santé" ou "Pharmacie" dans
// export.geojson). Utiliser le nom seul provoquerait des
// collisions de fichiers silencieuses.
// ==========================================================

const OSM_TYPE_LETTER = {
  node: 'n',
  way: 'w',
  relation: 'r',
};

function slugify(value) {
  return (
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // retire les accents
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'lieu'
  );
}

function buildFileSlug({ name, osm_type: osmType, osm_id: osmId }) {
  const typeLetter = OSM_TYPE_LETTER[osmType] || 'x';
  return `${slugify(name)}-${typeLetter}${osmId}`;
}

module.exports = { slugify, buildFileSlug };
