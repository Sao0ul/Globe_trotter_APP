// Ce script charge la fiche détaillée du site sélectionné, affiche la vidéo et prépare le mini-zoom cartographique.

const videoElement = document.getElementById('siteVideo');
const titleElement = document.getElementById('siteTitle');
const categoryElement = document.getElementById('siteCategory');
const locationElement = document.getElementById('siteLocation');
const descriptionElement = document.getElementById('siteDescription');
const difficultyElement = document.getElementById('siteDifficulty');
const dangerElement = document.getElementById('siteDanger');
const priceElement = document.getElementById('sitePrice');
const factsElement = document.getElementById('siteFacts');
const openItineraryButton = document.getElementById('openItineraryBtn');

const fallbackSite = {
  id: 'sample-site',
  titre: 'Centre touristique de Kribi',
  localisation: 'Kribi, Cameroun',
  categorie: 'nature',
  description: 'Un point de départ idéal pour découvrir les plages, le paysage côtier et les points de repère utiles avant la visite.',
  imageUrl: 'https://images.pexels.com/photos/2166553/pexels-photo-2166553.jpeg?auto=compress&cs=tinysrgb&w=800',
  difficulte: 'facile',
  dangerosite: 'faible',
  prix: 12000,
};

function moneyLabel(value) {
  return `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
}

function setCardContent(site) {
  videoElement.poster = site.imageUrl || fallbackSite.imageUrl;
  titleElement.textContent = site.titre || fallbackSite.titre;
  locationElement.textContent = site.localisation || fallbackSite.localisation;
  categoryElement.textContent = site.categorie || fallbackSite.categorie;
  descriptionElement.textContent = site.description || fallbackSite.description;
  difficultyElement.textContent = site.difficulte || fallbackSite.difficulte;
  dangerElement.textContent = site.dangerosite || fallbackSite.dangerosite;
  priceElement.textContent = moneyLabel(site.prix || fallbackSite.prix);

  const facts = [
    `📍 ${site.localisation || fallbackSite.localisation}`,
    `🧭 Catégorie : ${site.categorie || fallbackSite.categorie}`,
    `⚠️ Difficulté : ${site.difficulte || fallbackSite.difficulte}`,
    `🏥 Services : hôpitaux, restaurants et moyens de transport disponibles à proximité du site.`,
  ];

  factsElement.innerHTML = '';
  facts.forEach((fact) => {
    const item = document.createElement('li');
    item.textContent = fact;
    factsElement.appendChild(item);
  });
}

async function loadSiteDetail() {
  const params = new URLSearchParams(window.location.search);
  const siteId = params.get('id');

  try {
    const response = await fetch('/api/sites?page=1&limit=100');
    if (!response.ok) {
      throw new Error('Unable to load site list');
    }

    const data = await response.json();
    const site = (data.sites || []).find((entry) => String(entry.id) === String(siteId)) || fallbackSite;
    setCardContent(site);
  } catch (error) {
    console.error('Unable to load detailed site page:', error);
    setCardContent(fallbackSite);
  }
}

openItineraryButton.addEventListener('click', () => {
  const params = new URLSearchParams(window.location.search);
  const siteId = params.get('id') || fallbackSite.id;
  window.location.href = `itinerary.html?siteId=${encodeURIComponent(siteId)}`;
});

loadSiteDetail();
