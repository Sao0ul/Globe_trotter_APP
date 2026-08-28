// ================================================================
// directions-search.js
// ----------------------------------------------------------------
// Ce fichier NE FONCTIONNE PAS SEUL : il réutilise les variables et
// fonctions déjà déclarées dans itinerary.js (departInput, arriveeInput,
// modeDriveBtn, modeWalkBtn, modeBikeBtn, placeOriginMarker,
// placeDestinationMarker, calculerItineraire, setRouteSummary, map,
// originPoint, destinationPoint, ITINERAIRE_API_BASE, routeLayer,
// poiLayer, creerIconeCarte, formaterNomCategorie, COULEUR_TRAJET...).
// Ces variables sont accessibles ici car deux balises <script> classiques
// (pas type="module") sur la même page partagent le même scope global.
//
// IMPORTANT — ordre des balises dans le HTML, itinerary.js doit être
// chargé EN PREMIER :
//
//   <script src="js/itinerary.js" defer></script>
//   <script src="js/directions-search.js" defer></script>
//
// ================================================================

(function () {
    'use strict';

    // ==============================================================
    // 1. RECHERCHE D'ADRESSE (autocomplete départ / arrivée)
    // ==============================================================

    // API de géocodage public (OpenStreetMap Nominatim). Si tu as / crées
    // un endpoint côté backend (ex: /api/geocode?q=...), remplace juste
    // GEOCODE_API et adapte rechercherAdresses() en conséquence — le
    // reste du fichier n'a pas besoin de changer.
    const GEOCODE_API = 'https://nominatim.openstreetmap.org/search';
    const GEOCODE_DELAY = 350; // ms avant de lancer la recherche après la frappe
    const GEOCODE_MIN_LENGTH = 3;

    function debounce(fn, delay) {
        let timerId = null;
        return (...args) => {
            clearTimeout(timerId);
            timerId = setTimeout(() => fn(...args), delay);
        };
    }

    // Annule la requête précédente si l'utilisateur retape avant la réponse.
    let controleurRecherche = null;

    async function rechercherAdresses(query) {
        if (controleurRecherche) {
            controleurRecherche.abort();
        }
        controleurRecherche = new AbortController();

        const url =
            `${GEOCODE_API}?format=jsonv2&addressdetails=0&limit=5` +
            `&accept-language=fr&q=${encodeURIComponent(query)}`;

        try {
            const response = await fetch(url, { signal: controleurRecherche.signal });
            if (!response.ok) return [];

            const data = await response.json();

            return data.map((item) => ({
                label: item.display_name,
                lat: Number(item.lat),
                lon: Number(item.lon),
            }));
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Erreur de géocodage :', error);
            }
            return [];
        }
    }

    // Construit / réutilise le conteneur de suggestions juste sous un input.
    function creerListeSuggestions(input) {
        let liste = input.nextElementSibling;

        if (!liste || !liste.classList.contains('address-suggestions')) {
            liste = document.createElement('ul');
            liste.className = 'address-suggestions';
            liste.hidden = true;
            input.insertAdjacentElement('afterend', liste);

            // Positionnement minimal en cas d'absence de CSS dédié.
            // Ajoute .address-suggestions dans ton CSS pour un style propre ;
            // ceci garantit juste que ça reste utilisable sans rien ajouter.
            liste.style.position = 'absolute';
            liste.style.zIndex = '1000';
            liste.style.listStyle = 'none';
            liste.style.margin = '2px 0 0';
            liste.style.padding = '4px 0';
            liste.style.background = '#fff';
            liste.style.borderRadius = '10px';
            liste.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18)';
            liste.style.maxHeight = '220px';
            liste.style.overflowY = 'auto';
            liste.style.width = `${input.offsetWidth}px`;
        }

        return liste;
    }

    function viderSuggestions(liste) {
        liste.innerHTML = '';
        liste.hidden = true;
    }

    function afficherSuggestions(liste, resultats, onSelect) {
        liste.innerHTML = '';

        if (resultats.length === 0) {
            liste.hidden = true;
            return;
        }

        resultats.forEach((lieu) => {
            const item = document.createElement('li');
            item.textContent = lieu.label;
            item.style.padding = '8px 12px';
            item.style.cursor = 'pointer';
            item.style.fontSize = '13px';

            item.addEventListener('mouseenter', () => {
                item.style.background = '#f0f4f2';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'transparent';
            });

            // mousedown (pas click) pour sélectionner AVANT que le blur de
            // l'input ne referme la liste.
            item.addEventListener('mousedown', (event) => {
                event.preventDefault();
                onSelect(lieu);
                liste.hidden = true;
            });

            liste.appendChild(item);
        });

        liste.hidden = false;
    }

    // Branche la recherche + sélection sur un input donné.
    function attacherRecherche(input, onSelect) {
        if (!input) return;

        const liste = creerListeSuggestions(input);

        const lancerRecherche = debounce(async (valeur) => {
            if (valeur.trim().length < GEOCODE_MIN_LENGTH) {
                viderSuggestions(liste);
                return;
            }

            const resultats = await rechercherAdresses(valeur.trim());
            afficherSuggestions(liste, resultats, (lieu) => {
                onSelect(lieu);
            });
        }, GEOCODE_DELAY);

        input.addEventListener('input', () => lancerRecherche(input.value));

        input.addEventListener('blur', () => {
            // Petit délai pour laisser le mousedown de la suggestion s'exécuter.
            setTimeout(() => viderSuggestions(liste), 100);
        });

        input.addEventListener('focus', () => {
            if (liste.childElementCount > 0) {
                liste.hidden = false;
            }
        });
    }

    // Départ choisi via la recherche : on déverrouille le focus si besoin
    // (sinon placeOriginMarker sert juste à repositionner le marqueur).
    attacherRecherche(departInput, (lieu) => {
        placeOriginMarker(lieu.lat, lieu.lon);
        departInput.value = lieu.label; // remplace le libellé "lat, lng" par défaut
        calculerItineraire();
    });

    // Arrivée choisie via la recherche.
    attacherRecherche(arriveeInput, (lieu) => {
        placeDestinationMarker(lieu.lat, lieu.lon, lieu.label);
        map.setView([lieu.lat, lieu.lon], 14);
        calculerItineraire();
    });

    // ==============================================================
    // 2. SÉLECTEUR DE TYPE DE TRANSPORT (voiture / marche / vélo)
    // ==============================================================
    // itinerary.js affichait juste un message "coming soon" pour marche et
    // vélo, et n'avait AUCUN écouteur sur modeDriveBtn. On remplace tout
    // ça par une vraie sélection qui relance le calcul d'itinéraire avec
    // le bon profil.
    //
    // ⚠️ Le calcul réel dépend de ton backend /api/itineraire : il doit
    // accepter un paramètre `profil` (driving / walking / cycling) et le
    // transmettre à OSRM. Le routeur public utilisé jusqu'ici
    // (router.project-osrm.org) ne sert QUE le profil voiture — si ton
    // backend ne relaie pas encore le profil, marche/vélo renverront le
    // même trajet que voiture tant que ce n'est pas branché côté serveur.

    const PROFILS = {
        driving: modeDriveBtn,
        walking: modeWalkBtn,
        cycling: modeBikeBtn,
    };

    let modeActif = 'driving';

    // On clone chaque bouton pour retirer proprement l'ancien écouteur
    // "coming soon" posé par itinerary.js, sans toucher à itinerary.js.
    Object.keys(PROFILS).forEach((profil) => {
        const ancien = PROFILS[profil];
        if (!ancien) return;

        const nouveau = ancien.cloneNode(true);
        ancien.replaceWith(nouveau);
        PROFILS[profil] = nouveau;
    });

    function mettreAJourEtatBoutonsMode() {
        Object.entries(PROFILS).forEach(([profil, bouton]) => {
            bouton?.classList.toggle('is-active', profil === modeActif);
        });
    }

    function selectionnerMode(profil) {
        if (modeActif === profil) return;

        modeActif = profil;
        mettreAJourEtatBoutonsMode();

        if (originPoint && destinationPoint) {
            calculerItineraire();
        } else {
            setRouteSummary(
                `Mode : ${profil}. Choisissez un départ et une arrivée pour calculer le trajet.`
            );
        }
    }

    PROFILS.driving?.addEventListener('click', () => selectionnerMode('driving'));
    PROFILS.walking?.addEventListener('click', () => selectionnerMode('walking'));
    PROFILS.cycling?.addEventListener('click', () => selectionnerMode('cycling'));

    mettreAJourEtatBoutonsMode();

    // ==============================================================
    // 3. SURCHARGE DE calculerItineraire POUR TENIR COMPTE DU MODE
    // ==============================================================
    // calculerItineraire est une simple "function" déclarée dans
    // itinerary.js (pas const), donc réassignable ici. Tous les appels
    // existants (clic carte, swapDirectionsBtn, drag du marqueur départ,
    // verrouillage du focus...) utiliseront automatiquement cette version,
    // car ils appellent `calculerItineraire()` par son nom à chaque clic,
    // et JS résout ce nom dans le scope partagé au moment de l'appel.

    calculerItineraire = async function calculerItineraireAvecProfil() {
        if (!originPoint || !destinationPoint) {
            setRouteSummary(
                'Place a point to start(your starting point) or click on the map.'
            );
            return;
        }

        setRouteSummary('Calculating...');

        const depart = `${originPoint.lat},${originPoint.lng}`;
        const arrivee = `${destinationPoint.lat},${destinationPoint.lng}`;

        try {
            const response = await fetch(
                `${ITINERAIRE_API_BASE}?depart=${encodeURIComponent(depart)}` +
                `&arrivee=${encodeURIComponent(arrivee)}&rayon=1500&profil=${modeActif}`
            );

            const data = await response.json();

            if (!response.ok) {
                setRouteSummary(data.error || 'Impossible to calculate itinerary.');
                return;
            }

            if (routeLayer) {
                map.removeLayer(routeLayer);
            }

            routeLayer = L.geoJSON(data.trajet, {
                style: { color: COULEUR_TRAJET, weight: 5, opacity: 0.85 },
            }).addTo(map);

            map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });

            poiLayer.clearLayers();

            (data.lieux || []).forEach((lieu) => {
                const marker = L.marker(
                    [lieu.latitude, lieu.longitude],
                    {
                        icon: creerIconeCarte(lieu.category),
                        poiCategory: lieu.category,
                    }
                );
                marker
                    .bindPopup(`
        <span class="popup-category">
          ${formaterNomCategorie(lieu.category)}
        </span>
        <span class="popup-title">${lieu.name}</span>
        ${lieu.address ? `<div>${lieu.address}</div>` : ''}
      `)
                    .addTo(poiLayer);
            });

            const nomsProfils = {
                driving: 'voiture',
                walking: 'marche',
                cycling: 'vélo',
            };

            setRouteSummary(
                `Trajet (${nomsProfils[modeActif] || modeActif}) vers ${destinationLabel} — ` +
                `${data.distanceKm} km, environ ${data.dureeMin} min. ` +
                `${(data.lieux || []).length} lieu(x) trouvé(s) à proximité.`
            );
        } catch (error) {
            console.error('Error during calculating itinerary :', error);
            setRouteSummary('The itinerary service is not available.');
        }
    };
})();