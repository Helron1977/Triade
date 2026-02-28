import fs from 'fs';
import path from 'path';
import https from 'https';
import AdmZip from 'adm-zip';
import * as shapefile from 'shapefile';

const ZIP_URL = 'https://download.geofabrik.de/europe/france/ile-de-france-latest-free.shp.zip';
const ZIP_PATH = path.join(process.cwd(), 'ile-de-france.zip');
const EXTRACT_DIR = path.join(process.cwd(), 'scripts', 'osm_data');
const OUT_DIR = path.join(process.cwd(), 'public', 'data');

// Paramètres Triade
const MAP_SIZE = 800; // Paris 800x800
const PARIS_BOUNDS = {
    minLat: 48.815, maxLat: 48.902,
    minLon: 2.224, maxLon: 2.469
};

// Fonction de téléchargement (Stream)
async function downloadFile(url, dest) {
    if (fs.existsSync(dest)) {
        console.log(`[Cache] Le fichier ${dest} existe déjà. On saute le téléchargement.`);
        return;
    }
    console.log(`Téléchargement en cours de ${url}... (Cela peut prendre plusieurs minutes, le fichier fait ~400Mo)`);
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                // Gestion Redirections (GeoFabrik a parfois des redirections vers leurs miroirs)
                https.get(response.headers.location, (res) => {
                    res.pipe(file);
                    file.on('finish', () => file.close(resolve));
                }).on('error', reject);
            } else {
                response.pipe(file);
                file.on('finish', () => file.close(resolve));
            }
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

function coordToIndex(lat, lon) {
    if (lat < PARIS_BOUNDS.minLat || lat > PARIS_BOUNDS.maxLat) return -1;
    if (lon < PARIS_BOUNDS.minLon || lon > PARIS_BOUNDS.maxLon) return -1;

    // Normalisation de 0 à 1
    let xPercent = (lon - PARIS_BOUNDS.minLon) / (PARIS_BOUNDS.maxLon - PARIS_BOUNDS.minLon);
    let yPercent = 1.0 - ((lat - PARIS_BOUNDS.minLat) / (PARIS_BOUNDS.maxLat - PARIS_BOUNDS.minLat)); // Inversion Y (Haut = Nord)

    const x = Math.min(MAP_SIZE - 1, Math.floor(xPercent * MAP_SIZE));
    const y = Math.min(MAP_SIZE - 1, Math.floor(yPercent * MAP_SIZE));

    return y * MAP_SIZE + x;
}

async function processShapefile(shpFile, targetClasses, outputName, intensity = 1.0) {
    console.log(`\nRastérisation du Shapefile : ${shpFile}`);
    console.log(`Catégories recherchées :`, targetClasses);

    // Matrice Binaire Plate (Flat Tensor)
    const tensor = new Float32Array(MAP_SIZE * MAP_SIZE);
    let matchCount = 0;

    try {
        const source = await shapefile.open(
            path.join(EXTRACT_DIR, shpFile),
            path.join(EXTRACT_DIR, shpFile.replace('.shp', '.dbf')) // Propriétés DBF requises pour fclass
        );

        while (true) {
            const result = await source.read();
            if (result.done) break;

            const properties = result.value.properties;
            const geom = result.value.geometry;

            if (properties && properties.fclass && targetClasses.includes(properties.fclass)) {

                // Gestion des Points
                if (geom.type === 'Point') {
                    const [lon, lat] = geom.coordinates;
                    const idx = coordToIndex(lat, lon);
                    if (idx !== -1) {
                        tensor[idx] = intensity;
                        matchCount++;
                    }
                }
                // Gestion Simplifiée des Polygones (ex: parcs, buildings) -> On prend juste le premier point du polygone pour le point d'intérêt.
                else if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
                    // Astuce: Prendre le 1er noeud du premier anneau comme barycentre approximatif (c'est amplement suffisant pour une heatmap macro de 800x800).
                    let firstPoint = [];
                    if (geom.type === 'Polygon') firstPoint = geom.coordinates[0][0];
                    if (geom.type === 'MultiPolygon') firstPoint = geom.coordinates[0][0][0];

                    if (firstPoint && firstPoint.length === 2) {
                        const [lon, lat] = firstPoint;
                        const idx = coordToIndex(lat, lon);
                        if (idx !== -1) {
                            tensor[idx] = intensity;
                            matchCount++;
                        }
                    }
                }
            }
        }

    } catch (e) {
        console.error(`Erreur lors de la lecture de ${shpFile}:`, e.message);
    }

    if (!fs.existsSync(OUT_DIR)) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
    }

    const outPath = path.join(OUT_DIR, `${outputName}.bin`);
    // Sauvegarde brut de la RAM (ArrayBuffer entier) sur le disque
    fs.writeFileSync(outPath, Buffer.from(tensor.buffer));

    console.log(`✅ Tensor sauvegardé (${(tensor.byteLength / 1024 / 1024).toFixed(2)} MB) : ${outPath}`);
    console.log(`Résultat : ${matchCount} entités spatiales extraites dans les limites de Paris.`);
}

async function main() {
    console.log('--- Triade V2 - Pipeline de Données de Paris ---');

    // 1. Download
    await downloadFile(ZIP_URL, ZIP_PATH);

    // 2. Extract
    if (!fs.existsSync(EXTRACT_DIR)) {
        console.log(`Extraction du fichier .zip dans ${EXTRACT_DIR}...`);
        const zip = new AdmZip(ZIP_PATH);
        zip.extractAllTo(EXTRACT_DIR, true);
        console.log('Extraction terminée.');
    } else {
        console.log(`[Cache] Le dossier d'extraction ${EXTRACT_DIR} existe déjà.`);
    }

    // 3. Process to Tensors (Rastérisation)

    // a) Les Commerces de proximité (Supermarchés, Boulangeries, etc) -> Couche de "Concurrence"
    await processShapefile(
        'gis_osm_pois_free_1.shp',
        ['supermarket', 'convenience', 'bakery', 'clothes', 'mall', 'restaurant', 'cafe', 'fast_food'],
        'commerces'
    );

    // b) La Végétation / Parcs -> Couche d'attractivité 
    await processShapefile(
        'gis_osm_landuse_a_free_1.shp',
        ['forest', 'park', 'nature_reserve', 'recreation_ground', 'meadow'],
        'vegetation'
    );

    // c) Le Parking ou les Gares -> Couche d'accès
    // Geofabrik met souvent les parkings dans les POIs ou dans le landuse, cherchons dans POIs et Transports
    await processShapefile(
        'gis_osm_transport_a_free_1.shp', // Areas transport
        ['parking'],
        'parking_areas'
    );
    // Au cas où ce soit un point de transport :
    await processShapefile(
        'gis_osm_transport_free_1.shp', // Points transport
        ['parking', 'station', 'tram_stop', 'subway'],
        'transports'
    );

    console.log('\nPipeline Terrminé ! Les Float32Array bruts sont dans le dossier /public/data/.');
    console.log('🚀 Lance NPM RUN DEV pour voir la V2.');
}

main().catch(console.error);
