export interface GeoJsonFeature {
    geometry: {
        coordinates: [number, number]; // [Longitude, Latitude]
    };
    properties: any;
}

export interface GeoJsonFeatureCollection {
    features: GeoJsonFeature[];
}

export class GeoDataService {
    // Bounding Box approximative du centre de Niort pour normaliser les coordonnées
    static readonly MIN_LON = -0.4900;
    static readonly MAX_LON = -0.4200;
    static readonly MIN_LAT = 46.3000;
    static readonly MAX_LAT = 46.3400;

    /**
     * Charge un fichier GeoJSON et le projette sur une grille 2D (Float32Array)
     */
    static async loadAndProject(url: string, gridSize: number, intensity: number = 1): Promise<Float32Array> {
        const response = await fetch(url);
        const data: GeoJsonFeatureCollection = await response.json();

        const grid = new Float32Array(gridSize * gridSize);

        data.features.forEach(feature => {
            if (!feature.geometry || !feature.geometry.coordinates) return;

            const [lon, lat] = feature.geometry.coordinates;

            // Exclusion des points hors de la Bounding Box de Niort Centre
            if (lon < this.MIN_LON || lon > this.MAX_LON || lat < this.MIN_LAT || lat > this.MAX_LAT) {
                return;
            }

            // Projection (Normalisation 0.0 -> 1.0)
            const normX = (lon - this.MIN_LON) / (this.MAX_LON - this.MIN_LON);
            // Attention: La latitude descend vers le sud, on inverse pour l'affichage écran
            const normY = 1.0 - ((lat - this.MIN_LAT) / (this.MAX_LAT - this.MIN_LAT));

            // Conversion en indices de grille (0 to gridSize-1)
            const x = Math.floor(normX * (gridSize - 1));
            const y = Math.floor(normY * (gridSize - 1));

            const index = y * gridSize + x;
            if (index >= 0 && index < grid.length) {
                grid[index] += intensity; // Empilement si plusieurs points au même endroit
            }
        });

        return grid;
    }

    /**
     * Génère une fausse densité de population hyper-réaliste (Big Data > 500 000 points)
     * Pour stress-tester le modèle O(1)
     */
    static generateFakePopulation(gridSize: number): Float32Array {
        const grid = new Float32Array(gridSize * gridSize);
        const cx = gridSize / 2;
        const cy = gridSize / 2;

        // Multiplicateur pour simuler un demi-million d'habitants
        const densityMultiplier = 8.5;

        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                // Centre principal hyper dense
                const distCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                let pop = Math.max(0, 100 - distCenter * 0.8) * densityMultiplier;

                // Pâtés de maisons / Pôles
                const sub1 = Math.max(0, 50 - Math.sqrt((x - cx + 60) ** 2 + (y - cy - 40) ** 2) * 1.5) * densityMultiplier;
                const sub2 = Math.max(0, 70 - Math.sqrt((x - cx - 50) ** 2 + (y - cy + 80) ** 2) * 1.2) * densityMultiplier;

                // Bruit haute fréquence (Rues, immeubles spécifiques)
                const noise = (Math.random() * 20) * densityMultiplier;

                const totalPop = pop + sub1 + sub2 + noise;

                // Forêts, parcs, zones vides = 0
                grid[y * gridSize + x] = totalPop > (25 * densityMultiplier) ? totalPop : 0;
            }
        }
        return grid;
    }
}
