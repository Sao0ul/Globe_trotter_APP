//Le contrôleur reçoit la requête du client 
//via la route, décide de ce qu'il faut faire,
//et orchestre les opérations




const { lireSites, ecrireSites } = require('../models/sitesModel');
const crypto = require('crypto');

// GET /api/sites — liste tous les sites (avec recherche optionnelle)
function getSites(req, res) {
  let sites = lireSites();
  const { recherche, categorie } = req.query;

  if (recherche) {
    const terme = recherche.toLowerCase();
    sites = sites.filter(s =>
      s.titre.toLowerCase().includes(terme) ||
      s.localisation.toLowerCase().includes(terme)
    );
  }

  if (categorie) {
    sites = sites.filter(s => s.categorie === categorie);
  }

  res.json(sites);
}

// POST /api/sites — un user propose un nouveau site
function creerSite(req, res) {
  const { titre, description, localisation, categorie, auteur } = req.body;

  if (!titre || !localisation) {
    return res.status(400).json({ erreur: 'titre et localisation sont requis' });
  }

  const sites = lireSites();
  const nouveauSite = {
    id: crypto.randomUUID(),
    titre,
    description: description || '',
    localisation,
    categorie: categorie || 'autre',
    auteur: auteur || 'anonyme',
    notes: [],
    moyenne: 0,
    dateAjout: new Date().toISOString()
  };

  sites.push(nouveauSite);
  ecrireSites(sites);
  res.status(201).json(nouveauSite);
}

// POST /api/sites/:id/noter — ajouter une note
function noterSite(req, res) {
  const { id } = req.params;
  const { note } = req.body;

  if (typeof note !== 'number' || note < 1 || note > 5) {
    return res.status(400).json({ erreur: 'note doit être un nombre entre 1 et 5' });
  }

  const sites = lireSites();
  const site = sites.find(s => s.id === id);

  if (!site) {
    return res.status(404).json({ erreur: 'site introuvable' });
  }

  site.notes.push(note);
  site.moyenne = site.notes.reduce((a, b) => a + b, 0) / site.notes.length;

  ecrireSites(sites);
  res.json(site);
}

module.exports = { getSites, creerSite, noterSite };
