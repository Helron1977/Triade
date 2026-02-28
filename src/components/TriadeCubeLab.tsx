import React, { useEffect, useRef, useState } from 'react';
import { Triade } from '../triade-engine-v2/Triade';
import { GameOfLifeEngine } from '../triade-engine-v2/engines/GameOfLifeEngine';
import { CanvasAdapter } from '../triade-engine-v2/io/CanvasAdapter';
import { WebGLAdapter } from '../triade-engine-v2/io/WebGLAdapter';
import { TriadeGrid } from '../triade-engine-v2/core/TriadeGrid';

interface LabProps {
    onClose: () => void;
}

export const TriadeCubeLab: React.FC<LabProps> = ({ onClose }) => {
    const [viewMode, setViewMode] = useState<'SINGLE' | 'GRID' | 'WEBGL'>('WEBGL');
    const [fps, setFps] = useState(0);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasGridRefs = [
        useRef<HTMLCanvasElement>(null),
        useRef<HTMLCanvasElement>(null),
        useRef<HTMLCanvasElement>(null),
        useRef<HTMLCanvasElement>(null),
    ];

    // Engine / SDK
    const sdkRef = useRef<Triade | null>(null);
    const webglAdapterRef = useRef<WebGLAdapter | null>(null);

    useEffect(() => {
        // Initialization
        const sdk = new Triade(10); // 10MB minimal usage
        sdkRef.current = sdk;

        // 1. Initialiser la grille (2 cols x 2 rows = 4 cubes) avec le Game of Life
        const size = 128;
        const grid = new TriadeGrid(2, 2, size, sdk.masterBuffer, () => new GameOfLifeEngine(), 2);

        // 2. Initialisation : dessiner une forme continue au milieu de la grille globale
        // On va allumer un "Gosper Glider Gun" (ou un gros amas aléatoire) au centre absolu.

        // Setup initial aléatoire centralisé
        for (let y = 0; y < 2; y++) {
            for (let x = 0; x < 2; x++) {
                const cube = grid.cubes[y][x]!;
                for (let i = 0; i < size; i++) {
                    for (let j = 0; j < size; j++) {
                        // N'allumer que si on est près du centre (bords des cubes adjacents)
                        const globalX = x * size + j;
                        const globalY = y * size + i;
                        const centerX = size; // Milieu de la grille 2x2
                        const centerY = size;

                        const dist = Math.sqrt((globalX - centerX) ** 2 + (globalY - centerY) ** 2);
                        if (dist < 40 && Math.random() > 0.5) {
                            cube.faces[0][i * size + j] = 1;
                        }
                    }
                }
            }
        }

        let frameCount = 0;
        let lastTime = performance.now();
        let raf: number;

        const loop = () => {
            // 1. Math Step (compute next frame pour tous + Boundary Exchange O(1))
            grid.compute(0); // On synchronise la Face 0 (état du jeu)

            const cubes = [
                grid.cubes[0][0]!, // Haut-Gauche
                grid.cubes[0][1]!, // Haut-Droite
                grid.cubes[1][0]!, // Bas-Gauche
                grid.cubes[1][1]!  // Bas-Droite
            ];

            // 2. Rendering based on Mode
            if (viewMode === 'SINGLE' && canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    // Face 0 = GOL Data 
                    CanvasAdapter.renderFaceToCanvas(cubes[0].faces[0], size, ctx, { colorScheme: 'heat', normalizeMax: 1 });
                }
            }
            else if (viewMode === 'GRID') {
                cubes.forEach((cube, idx) => {
                    const ctx = canvasGridRefs[idx].current?.getContext('2d');
                    if (ctx) {
                        CanvasAdapter.renderFaceToCanvas(cube.faces[0], size, ctx, { colorScheme: 'heat', normalizeMax: 1 });
                    }
                });
            }
            else if (viewMode === 'WEBGL' && canvasRef.current) {
                if (!webglAdapterRef.current) {
                    try {
                        webglAdapterRef.current = new WebGLAdapter(canvasRef.current, size);
                    } catch (e) {
                        console.error("WebGL Error", e);
                    }
                }
                if (webglAdapterRef.current) {
                    // Push Float32Array to GPU
                    webglAdapterRef.current.renderFaceToWebGL(cubes[0].faces[0]);
                }
            }

            // FPS Counter
            frameCount++;
            const now = performance.now();
            if (now - lastTime >= 1000) {
                setFps(frameCount);
                frameCount = 0;
                lastTime = now;
            }

            raf = requestAnimationFrame(loop);
        };

        raf = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(raf);
            // On unmount Webgl contexts and buffers are garbaged by browser
        };
    }, [viewMode]);

    return (
        <div style={{ backgroundColor: '#09090b', width: '100%', height: '100%', color: 'white', display: 'flex', flexDirection: 'column' }}>
            {/* LAB HEADER */}
            <header style={{ padding: '20px', backgroundColor: '#18181b', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button onClick={onClose} style={{ backgroundColor: 'transparent', color: '#a1a1aa', border: '1px solid #3f3f46', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}>← Quitter</button>
                    <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>TriadeCube API & UI Standard</h1>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setViewMode('SINGLE')} style={btnStyle(viewMode === 'SINGLE')}>Single 2D (O1)</button>
                    <button onClick={() => setViewMode('GRID')} style={btnStyle(viewMode === 'GRID')}>Multi-Cubes Grid</button>
                    <button onClick={() => setViewMode('WEBGL')} style={btnStyle(viewMode === 'WEBGL')}>WebGL 2.0 (Shader)</button>
                </div>

                <div style={{ fontFamily: 'monospace', color: '#4ade80', fontSize: '18px', fontWeight: 'bold' }}>
                    {fps} FPS
                </div>
            </header>

            {/* MAIN RENDER AREA */}
            <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', position: 'relative' }}>

                {viewMode === 'SINGLE' && (
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ color: '#5eead4', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '12px' }}>Mode : 2D Native RGBA Map</h3>
                        <canvas ref={canvasRef} width={128} height={128} style={{ width: '400px', height: '400px', imageRendering: 'pixelated', border: '2px solid #5eead4', boxShadow: '0 0 40px rgba(94, 234, 212, 0.2)' }} />
                    </div>
                )}

                {viewMode === 'GRID' && (
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ color: '#fcd34d', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '12px' }}>Mode : 4x CUBES (Multi-processing Simulation)</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                            {canvasGridRefs.map((ref, i) => (
                                <canvas key={i} ref={ref} width={128} height={128} style={{ width: '200px', height: '200px', imageRendering: 'pixelated', border: '1px solid #fcd34d' }} />
                            ))}
                        </div>
                    </div>
                )}

                {viewMode === 'WEBGL' && (
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ color: '#60a5fa', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '12px' }}>Mode : Direct Float32Texture &gt; WebGL Shader</h3>
                        <canvas ref={canvasRef} width={128} height={128} style={{ width: '400px', height: '400px', imageRendering: 'pixelated', border: '2px solid #60a5fa', boxShadow: '0 0 50px rgba(96, 165, 250, 0.3)' }} />
                    </div>
                )}

            </main>

            {/* DOCUMENTATION FOOTER */}
            <footer style={{ padding: '20px', borderTop: '1px solid #27272a', color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
                <strong>Comment utiliser l'API TriadeCube dans vos projets ?</strong><br />
                La philosophie de Triade repose sur le "Flat Memory Model". Que ce soit pour une simple page web, un jeu vidéo ou de la Big Data, l'architecture est la suivante :<br />
                <code style={{ color: '#f472b6' }}>1. const sdk = new Triade(Megabytes);</code><br />
                <code style={{ color: '#f472b6' }}>2. const cube = sdk.createCube(size, new MyPhysicsEngine()); // Vos règles</code><br />
                <code style={{ color: '#f472b6' }}>3. cube.compute(); // A chaque tic</code><br />
                <code style={{ color: '#6ee7b7' }}>4. WebGLAdapter.render( cube.faces[0] ); // Envoi direct O(1) de la RAM au GPU sans stringify ni JSON.</code>
            </footer>
        </div>
    );
};

// Helper CSS
const btnStyle = (active: boolean): React.CSSProperties => ({
    backgroundColor: active ? '#3f3f46' : 'transparent',
    color: active ? '#fff' : '#a1a1aa',
    border: '1px solid #3f3f46',
    borderRadius: '8px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: active ? 'bold' : 'normal',
    transition: '0.2s'
});
