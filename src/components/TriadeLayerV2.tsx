import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { CanvasAdapter } from '../triade-engine-v2/io/CanvasAdapter';

interface TriadeLayerV2Props {
    faceData: Float32Array | null;
    mapSize: number;
    bounds: [[number, number], [number, number]];
    colorScheme: 'heat' | 'grayscale';
    opacity?: number;
}

export const TriadeLayerV2: React.FC<TriadeLayerV2Props> = ({ faceData, mapSize, bounds, colorScheme, opacity = 0.8 }) => {
    const map = useMap();
    const canvasLayerRef = useRef<L.ImageOverlay | null>(null);
    const canvasEl = useRef<HTMLCanvasElement>(document.createElement('canvas'));

    useEffect(() => {
        // 1. Initialise le Canvas interne à la bonne taille
        canvasEl.current.width = mapSize;
        canvasEl.current.height = mapSize;
        const ctx = canvasEl.current.getContext('2d');

        if (!ctx || !faceData) return;

        // 2. Peindre l'Onde Mathématique (Face 3 ou 4) via notre Adapteur Agnostique
        CanvasAdapter.renderFaceToCanvas(faceData, mapSize, ctx, { colorScheme });

        // 3. Convertir le Canvas en DataURL (Image dynamique très lègère) pour Leaflet
        const dataUrl = canvasEl.current.toDataURL('image/png');

        // Mettre à jour la carte Leaflet
        if (canvasLayerRef.current) {
            map.removeLayer(canvasLayerRef.current);
        }
        canvasLayerRef.current = L.imageOverlay(dataUrl, bounds, { opacity, interactive: false });
        map.addLayer(canvasLayerRef.current);

        return () => {
            if (canvasLayerRef.current) {
                map.removeLayer(canvasLayerRef.current);
                canvasLayerRef.current = null;
            }
        };
    }, [faceData, mapSize, bounds, map, colorScheme, opacity]);

    return null;
};
