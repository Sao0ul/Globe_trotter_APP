const CATEGORY_FILE_MAP = {
  site_touristique: 'sites',
  hotel: 'hotels',
  restaurant: 'restaurants',
  hopital: 'hopitaux',
  clinique: 'cliniques',
  pharmacie: 'pharmacies',
};

function determineCategory(tags) {
  if (
    tags.tourism === 'hotel' ||
    tags.tourism === 'guest_house' ||
    tags.tourism === 'hostel' ||
    tags.tourism === 'motel'
  ) {
    return 'hotel';
  }

  if (
    tags.amenity === 'restaurant' ||
    tags.amenity === 'cafe' ||
    tags.amenity === 'fast_food'
  ) {
    return 'restaurant';
  }

  if (tags.amenity === 'hospital') {
    return 'hopital';
  }

  if (
    tags.amenity === 'clinic' ||
    tags.amenity === 'doctors' ||
    tags.amenity === 'dentist'
  ) {
    return 'clinique';
  }

  if (tags.amenity === 'pharmacy') {
    return 'pharmacie';
  }

  if (
    tags.tourism === 'attraction' ||
    tags.tourism === 'museum' ||
    tags.tourism === 'gallery' ||
    tags.tourism === 'zoo' ||
    tags.tourism === 'theme_park' ||
    tags.historic
  ) {
    return 'site_touristique';
  }

  return null;
}

function mapTagsToSiteCategory(tags) {
  if (tags.historic) {
    return 'culture';
  }

  if (tags.tourism === 'museum' || tags.tourism === 'gallery') {
    return 'culture';
  }

  if (tags.tourism === 'zoo' || tags.tourism === 'theme_park') {
    return 'adventure';
  }

  if (tags.natural === 'peak') {
    return 'mountain';
  }

  if (tags.natural === 'beach') {
    return 'beach';
  }

  if (
    tags.natural ||
    tags.leisure === 'park' ||
    tags.leisure === 'nature_reserve'
  ) {
    return 'nature';
  }

  return 'other';
}

function getCategoryFileName(category) {
  return CATEGORY_FILE_MAP[category] || null;
}

module.exports = {
  determineCategory,
  mapTagsToSiteCategory,
  getCategoryFileName,
};