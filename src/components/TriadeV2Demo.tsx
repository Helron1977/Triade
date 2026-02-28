import React, { useEffect, useRef, useState } from 'react';
import { Triade } from '../triade-engine-v2/Triade';
import { HeatmapEngine } from '../triade-engine-v2/engines/HeatmapEngine';
import { CanvasAdapter } from '../triade-engine-v2/io/CanvasAdapter';

const MAP_SIZE = 400;

export const TriadeV2Demo: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stats, setStats] = useState({ ram: '', time: 0 });

    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;

        // 1. Initialisation SDK V2 
        // Allocation de 50MB de VRAM maitresse.
        const sdk = new Triade(50);

        // 2. Création d'un Cube avec l'Engine Convolution Heatmap (Rayon 30)
        const myCube = sdk.createCube("DemoRender", MAP_SIZE, new HeatmapEngine(30));

        // 3. Dessin de 50 points aléatoires sur la Face 2 (Contexte)
        const face2 = myCube.faces[1];
        for (let i = 0; i < 50; i++) {
            const rx = Math.floor(Math.random() * MAP_SIZE);
            const ry = Math.floor(Math.random() * MAP_SIZE);
            face2[ry * MAP_SIZE + rx] = 1.0;
        }

        // 4. Exécution du Moteur (O1)
        const start = performance.now();
        myCube.compute();
        const end = performance.now();

        // 5. Rendu (I/O Adapter) de la Synthèse (Face 3)
        const face3 = myCube.faces[2];
        CanvasAdapter.renderFaceToCanvas(face3, MAP_SIZE, ctx, { colorScheme: 'heat' });

        setStats({
            ram: (sdk as any).masterBuffer.getUsedMemoryInMB(),
            time: end - start
        });

    }, []);

    return (
        <div className="w-full h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-4">
            <h1 className="text-3xl font-bold text-amber-500 mb-2">Triade.js V2 - SDK Demo</h1>
            <p className="text-neutral-400 mb-6 text-center max-w-2xl">
                Ceci est la première preuve de concept utilisant la nouvelle architecture V2 (Master ArrayBuffer pur, Plugins Engines Injectés, Adaptateurs I/O). Le rendu est statique pour vérifier la signature mémoire.
            </p>

            <div className="flex gap-4 mb-6">
                <div className="px-6 py-3 bg-neutral-800 rounded-xl border border-neutral-700">
                    <span className="text-neutral-400 text-sm">Temps Inférence O(1)</span>
                    <div className="text-2xl font-mono text-cyan-400">{stats.time.toFixed(2)} ms</div>
                </div>
                <div className="px-6 py-3 bg-neutral-800 rounded-xl border border-neutral-700">
                    <span className="text-neutral-400 text-sm">VRAM Allouée</span>
                    <div className="text-2xl font-mono text-pink-500">{stats.ram}</div>
                </div>
            </div>

            <canvas
                ref={canvasRef}
                width={MAP_SIZE}
                height={MAP_SIZE}
                className="rounded-xl border-4 border-neutral-800 shadow-2xl"
                style={{ imageRendering: 'pixelated', width: '50vh', height: '50vh' }}
            />
        </div>
    );
};
