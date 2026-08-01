require('dotenv').config({
    path: require('path').join(__dirname, '../../.env')
});

const pool = require('./pool');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { exec } = require('child_process');

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

if (!PEXELS_API_KEY) {
    console.error('PEXELS_API_KEY manquant dans .env');
    process.exit(1);
}

function attendre(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function chercherImagePexels(query) {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;

    const response = await fetch(url, {
        headers: {
            Authorization: PEXELS_API_KEY
        }
    });

    if (!response.ok) {
        throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = await response.json();
    const photo = data.photos?.[0];

    if (!photo) return null;

    return {
        imageUrl: photo.src.landscape || photo.src.large,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        pexelsUrl: photo.url
    };
}

async function telechargerImage(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Impossible de télécharger l'image.");
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    const extension = path.extname(new URL(url).pathname) || ".jpg";
    const fichier = path.join(os.tmpdir(), `preview_${Date.now()}${extension}`);

    fs.writeFileSync(fichier, buffer);

    return fichier;
}

function ouvrirImage(fichier) {
    return new Promise((resolve) => {

        let cmd;

        if (process.platform === "win32") {
            cmd = `start "" "${fichier}"`;
        } else if (process.platform === "darwin") {
            cmd = `open "${fichier}"`;
        } else {
            cmd = `xdg-open "${fichier}"`;
        }

        exec(cmd, () => resolve());
    });
}

function demander(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(question, reponse => {
            rl.close();
            resolve(reponse.trim());
        });
    });
}

async function choisirImage(imageAuto) {

    console.log("\nTéléchargement de l'image proposée...");

    const preview = await telechargerImage(imageAuto);

    await ouvrirImage(preview);

    console.log("\nImage proposée ouverte.");
    console.log("Appuyez simplement sur Entrée pour la conserver.");
    console.log("Ou indiquez un chemin local ou une URL.");

    const choix = await demander("\nImage : ");

    if (!choix) {
        return imageAuto;
    }

    if (/^https?:\/\//i.test(choix)) {
        return choix;
    }

    const chemin = path.resolve(choix);

    if (!fs.existsSync(chemin)) {
        console.log("Le fichier n'existe pas. Utilisation de l'image automatique.");
        return imageAuto;
    }

    return chemin;
}

async function fillMissingSiteImages() {

    const { rows: sites } = await pool.query(`
        SELECT id, title, location
        FROM sites
        WHERE image_url IS NULL
        ORDER BY created_at ASC
    `);

    console.log(`${sites.length} sites sans image.\n`);

    const counters = {
        updated: 0,
        notFound: 0,
        errors: 0
    };

    for (const site of sites) {

        try {

            const query = `${site.title} ${site.location}`;

            console.log("====================================");
            console.log(`Site : ${site.title}`);
            console.log(`Recherche : ${query}`);

            const resultat = await chercherImagePexels(query);

            if (!resultat) {

                console.log("Aucune image trouvée.");

                counters.notFound++;

            } else {

                console.log(`Photographe : ${resultat.photographer}`);

                const imageChoisie = await choisirImage(resultat.imageUrl);

                await pool.query(
                    `UPDATE sites
                     SET image_url = $1
                     WHERE id = $2`,
                    [imageChoisie, site.id]
                );

                console.log("Image enregistrée.");
                counters.updated++;
            }

        } catch (err) {

            console.error(err.message);
            counters.errors++;

        }

        await attendre(500);
    }

    return counters;
}

async function main() {

    try {

        const counters = await fillMissingSiteImages();

        console.log("\n========== Résumé ==========");
        console.log(`Images ajoutées : ${counters.updated}`);
        console.log(`Non trouvées    : ${counters.notFound}`);
        console.log(`Erreurs         : ${counters.errors}`);

    } finally {

        await pool.end();

    }

}

main().catch(err => {

    console.error(err);

    process.exit(1);

});