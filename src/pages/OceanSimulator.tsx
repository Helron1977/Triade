import { useEffect, useRef, useState } from 'react';
import { Triade } from '../triade-engine-v2/Triade';
import { OceanWorld } from '../triade-engine-v2/addons/ocean-simulation/OceanWorld';
import { OceanWebGLRenderer } from '../triade-engine-v2/addons/ocean-simulation/OceanWebGLRenderer';
import { Link } from 'react-router-dom';

export const OceanSimulator = () => {
    const [fps, setFps] = useState(0);
    const [vortexStrength, setVortexStrength] = useState(0.00); // Vent nul au départ
    const [vortexRadius, setVortexRadius] = useState(30);

    const canvasGridRefs = Array.from({ length: 16 }, () => useRef<HTMLCanvasElement>(null));
    const webglCanvasRef = useRef<HTMLCanvasElement>(null);
    const boatOverlayRef = useRef<HTMLCanvasElement>(null);

    const sdkRef = useRef<Triade | null>(null);

    // Structure unique "OceanWorld" qui gère la Grille et les Bateaux Toriques
    const worldRef = useRef<OceanWorld | null>(null);
    const rendererRef = useRef<OceanWebGLRenderer | null>(null);

    useEffect(() => {
        // Initialization (Larger Map: 4x4 chunks)
        const sdk = new Triade(160); // Upgrade RAM for 16 chunks
        sdkRef.current = sdk;

        const size = 64;
        const cols = 4;
        const rows = 4;

        const world = new OceanWorld(sdk.masterBuffer, cols, rows, size);
        worldRef.current = world;

        if (webglCanvasRef.current) {
            rendererRef.current = new OceanWebGLRenderer(webglCanvasRef.current, cols, rows, size);
        }

        world.setVortexParams(vortexStrength, vortexRadius);

        // Placer 1 bateau pour focus sur sa physique
        const globalW = cols * size;
        const globalH = rows * size;
        world.addBoat(10, 10, 10);

        let frameCount = 0;
        let lastTime = performance.now();
        let raf: number;

        const loop = () => {
            // Un seul step global pour toute la Grille + Bateaux Torique
            world.step();

            // RENDER CUBES
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const ctx = canvasGridRefs[y * cols + x].current?.getContext('2d');
                    if (ctx) {
                        const imgData = ctx.createImageData(size, size);
                        world.renderChunk(x, y, ctx, imgData);
                    }
                }
            }

            // RENDER UNIFIED WEBGL
            if (rendererRef.current) {
                rendererRef.current.render(world.grid);
            }

            // RENDER UNIFIED BOATS (2D Overlay)
            const bCtx = boatOverlayRef.current?.getContext('2d');
            if (bCtx && worldRef.current) {
                bCtx.clearRect(0, 0, globalW, globalH);
                for (const boat of worldRef.current.boats) {

                    // -- 3D PROJECTION MATCHING WEBGL SHADER --
                    const nx = (boat.x / 256.0) * 2.0 - 1.0;
                    const ny = -(boat.y / 256.0) * 2.0 + 1.0;

                    const angleX = -1.1; // Extrait du shader
                    const cosX = Math.cos(angleX);
                    const sinX = Math.sin(angleX);

                    const yRot = ny * cosX; // h = 0 for boat base
                    const zRot = ny * sinX - 2.2;

                    const fov = 1.7;
                    const clipX = nx * fov;
                    const clipY = (yRot - 0.2) * fov;
                    const w = -zRot;

                    const ndcX = clipX / w;
                    const ndcY = clipY / w;

                    const projX = (ndcX * 0.5 + 0.5) * 256;
                    const projY = (-ndcY * 0.5 + 0.5) * 256;
                    const scale3D = 2.5 / w; // Ajustement d'échelle 

                    bCtx.save();
                    bCtx.translate(projX, projY);
                    bCtx.scale(scale3D, scale3D);
                    bCtx.rotate(boat.angle); // Flat rotation in screen space is ok for subtle tilted camera

                    // Sillage (Wake)
                    bCtx.beginPath();
                    bCtx.moveTo(-boat.length / 2, 0);
                    bCtx.lineTo(-boat.length * 1.5, -boat.length * 0.8);
                    bCtx.lineTo(-boat.length * 1.5, boat.length * 0.8);
                    bCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                    bCtx.fill();

                    // Bateau stylisé
                    bCtx.beginPath();
                    bCtx.moveTo(boat.length / 2, 0); // Proue
                    bCtx.lineTo(-boat.length / 2, 4);  // Tribord
                    bCtx.lineTo(-boat.length / 2, -4); // Bâbord
                    bCtx.fillStyle = '#facc15'; // Yellow Hull
                    bCtx.fill();

                    // Voile blanche
                    bCtx.beginPath();
                    bCtx.moveTo(boat.length / 4, 0);
                    bCtx.lineTo(-boat.length / 3, 0);
                    bCtx.lineTo(-boat.length / 4, 8); // Voile gonflée
                    bCtx.fillStyle = '#ffffff';
                    bCtx.fill();

                    bCtx.restore();
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

        // Keyboard controls (Z/W, S, Q/A, D)
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!worldRef.current) return;
            const key = e.key.toLowerCase();
            if (key === 'z' || key === 'w' || key === 'arrowup') worldRef.current.keys.up = true;
            if (key === 's' || key === 'arrowdown') worldRef.current.keys.down = true;
            if (key === 'q' || key === 'a' || key === 'arrowleft') worldRef.current.keys.left = true;
            if (key === 'd' || key === 'arrowright') worldRef.current.keys.right = true;
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (!worldRef.current) return;
            const key = e.key.toLowerCase();
            if (key === 'z' || key === 'w' || key === 'arrowup') worldRef.current.keys.up = false;
            if (key === 's' || key === 'arrowdown') worldRef.current.keys.down = false;
            if (key === 'q' || key === 'a' || key === 'arrowleft') worldRef.current.keys.left = false;
            if (key === 'd' || key === 'arrowright') worldRef.current.keys.right = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    return (
        <div style={{ backgroundColor: '#09090b', width: '100%', height: '100%', color: 'white', display: 'flex', flexDirection: 'column' }}>
            {/* LAB HEADER */}
            <header style={{ padding: '20px', backgroundColor: '#18181b', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <Link to="/" style={{ textDecoration: 'none', backgroundColor: 'transparent', color: '#a1a1aa', border: '1px solid #3f3f46', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}>← Quitter</Link>
                    <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>Marées Royales - Tydras (Mode Multi-Tuiles)</h1>
                </div>

                <div style={{ fontFamily: 'monospace', color: '#4ade80', fontSize: '18px', fontWeight: 'bold' }}>
                    {fps} FPS
                </div>
            </header>

            {/* MAIN RENDER AREA */}
            <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', position: 'relative', gap: '50px' }}>

                {/* 4 Chunks Raw (Grid) */}
                <div style={{ textAlign: 'center' }}>
                    <h3 style={{ color: '#fcd34d', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '12px' }}>Océan LBM Multi-Process (Monde Torique)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px' }}>
                        {canvasGridRefs.map((ref, i) => (
                            <canvas
                                key={i}
                                ref={ref as any}
                                width={64}
                                height={64}
                                style={{ width: '128px', height: '128px', imageRendering: 'pixelated', border: '1px solid #333' }}
                                onMouseMove={(e) => {
                                    if (e.buttons === 1 && worldRef.current) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const gx = (e.clientX - rect.left) / 4.0; // scale inversée
                                        const gy = (e.clientY - rect.top) / 4.0;

                                        // C'est un peu un hack simple: offsetX = chunkX * size
                                        const cx = i % 4;
                                        const cy = Math.floor(i / 4);
                                        const globalX = cx * 64 + gx;
                                        const globalY = cy * 64 + gy;

                                        worldRef.current.setInteraction(globalX, globalY, true);
                                    }
                                }}
                                onMouseUp={() => {
                                    if (worldRef.current) worldRef.current.setInteraction(0, 0, false);
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* WebGL Unified Fusion Map */}
                <div style={{ textAlign: 'center', position: 'relative' }}>
                    <h3 style={{ color: '#60a5fa', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '12px' }}>Fusion WebGL 2.0 (Monde Unifié Torique)</h3>
                    <div style={{ position: 'relative', width: '512px', height: '512px' }}>

                        {/* Shader Renderer */}
                        <canvas
                            ref={webglCanvasRef}
                            width={256} // cols(4) * size(64)
                            height={256}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', imageRendering: 'pixelated', border: '1px solid #60a5fa', boxShadow: '0 0 40px rgba(96, 165, 250, 0.15)' }}
                        />

                        {/* Boats Overlay (2D) */}
                        <canvas
                            ref={boatOverlayRef}
                            width={256}
                            height={256}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                        />

                        {/* Interaction Layer (Overlay invisible to capture mouse accurately over WebGL map) */}
                        <div
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'crosshair', zIndex: 10 }}
                            onMouseMove={(e) => {
                                if (e.buttons === 1 && worldRef.current) {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    // Map 512px HTML coord to 256px Game Canvas
                                    const scale = 256 / 512.0;
                                    const cx = (e.clientX - rect.left) * scale;
                                    const cy = (e.clientY - rect.top) * scale;

                                    // -- RAYCAST UNPROJECTION (Inverse Matrix Math) --
                                    const ndcX = (cx / 256.0) * 2.0 - 1.0;
                                    const ndcY = -(cy / 256.0) * 2.0 + 1.0;

                                    const angleX = -1.1;
                                    const cosX = Math.cos(angleX);
                                    const sinX = Math.sin(angleX);
                                    const fov = 1.7;

                                    const A = ndcY / fov;
                                    const ny = (2.2 * A + 0.2) / (cosX + A * sinX);
                                    const w = -ny * sinX + 2.2;
                                    const nx = (ndcX * w) / fov;

                                    // Retrouver les coordonnées globales exactes pour la Physique LBM
                                    const globalX = (nx + 1.0) * 0.5 * 256;
                                    const globalY = (1.0 - ny) * 0.5 * 256;

                                    worldRef.current.setInteraction(globalX, globalY, true);
                                }
                            }}
                            onMouseUp={() => {
                                if (worldRef.current) worldRef.current.setInteraction(0, 0, false);
                            }}
                            onMouseLeave={() => {
                                if (worldRef.current) worldRef.current.setInteraction(0, 0, false);
                            }}
                        />
                    </div>
                </div>

                {/* CONTROLS UI */}
                <div style={{ padding: '20px', backgroundColor: '#18181b', borderRadius: '8px', border: '1px solid #27272a', width: '300px' }}>

                    {/* ZQSD Controls Box */}
                    <div style={{ marginBottom: '25px', paddingBottom: '15px', borderBottom: '1px solid #3f3f46' }}>
                        <h3 style={{ color: '#facc15', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '12px' }}>Mode Pilote (Voilier)</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 30px)', gap: '5px', justifyContent: 'center', margin: '10px 0' }}>
                            <div></div>
                            <div style={{ backgroundColor: '#27272a', border: '1px solid #52525b', borderRadius: '4px', textAlign: 'center', padding: '5px', fontSize: '12px', color: '#fff' }}>Z/W</div>
                            <div></div>
                            <div style={{ backgroundColor: '#27272a', border: '1px solid #52525b', borderRadius: '4px', textAlign: 'center', padding: '5px', fontSize: '12px', color: '#fff' }}>Q/A</div>
                            <div style={{ backgroundColor: '#27272a', border: '1px solid #52525b', borderRadius: '4px', textAlign: 'center', padding: '5px', fontSize: '12px', color: '#fff' }}>S</div>
                            <div style={{ backgroundColor: '#27272a', border: '1px solid #52525b', borderRadius: '4px', textAlign: 'center', padding: '5px', fontSize: '12px', color: '#fff' }}>D</div>
                        </div>
                        <p style={{ fontSize: '11px', color: '#a1a1aa', textAlign: 'center', margin: 0 }}>Naviguez et affrontez le vent !</p>
                    </div>

                    <h3 style={{ color: '#ef4444', margin: '0 0 15px 0', textTransform: 'uppercase', fontSize: '12px' }}>Mode Dieu (La Tempête)</h3>

                    {/* Presets */}
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '20px' }}>
                        <button
                            onClick={() => { setVortexStrength(0.00); if (worldRef.current) worldRef.current.setVortexParams(0.00, vortexRadius); }}
                            style={{ flex: 1, padding: '6px', fontSize: '11px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Calme</button>
                        <button
                            onClick={() => { setVortexStrength(0.04); if (worldRef.current) worldRef.current.setVortexParams(0.04, vortexRadius); }}
                            style={{ flex: 1, padding: '6px', fontSize: '11px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Brise</button>
                        <button
                            onClick={() => { setVortexStrength(0.10); if (worldRef.current) worldRef.current.setVortexParams(0.10, vortexRadius); }}
                            style={{ flex: 1, padding: '6px', fontSize: '11px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Typhon</button>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <label style={{ fontSize: '13px', color: '#a1a1aa' }}>Force du Vent LBM</label>
                            <span style={{ fontSize: '12px', color: '#4ade80' }}>{vortexStrength.toFixed(3)}</span>
                        </div>
                        <input
                            type="range"
                            min="0.00" max="0.1" step="0.01"
                            value={vortexStrength}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setVortexStrength(val);
                                if (worldRef.current) worldRef.current.setVortexParams(val, vortexRadius);
                            }}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <label style={{ fontSize: '13px', color: '#a1a1aa' }}>Rayon du Typhon</label>
                            <span style={{ fontSize: '12px', color: '#4ade80' }}>{Math.floor(vortexRadius)}px</span>
                        </div>
                        <input
                            type="range"
                            min="5" max="64" step="1"
                            value={vortexRadius}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setVortexRadius(val);
                                if (worldRef.current) worldRef.current.setVortexParams(vortexStrength, val);
                            }}
                        />
                    </div>

                    <button
                        onClick={() => {
                            if (worldRef.current) {
                                worldRef.current.reset();
                                setVortexStrength(0.00);
                                worldRef.current.setVortexParams(0.0, vortexRadius);
                            }
                        }}
                        style={{ width: '100%', padding: '10px', marginTop: '15px', backgroundColor: '#27272a', color: '#ff4444', border: '1px solid #ff4444', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        ⟳ RELANCER LA SIMULATION
                    </button>
                </div>

            </main>

            {/* DOCUMENTATION FOOTER */}
            <footer style={{ padding: '20px', borderTop: '1px solid #27272a', color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
                <p>Simulation Météo-Océanographique D2Q9 (Lattice Boltzmann Method) avec "Boundary Exchange" (Ghost Cells).</p>
                <p>Monde Torique : Les fluides (vagues) et les bateaux naviguent librement d'un Chunk à l'autre et transpercent les limites de la carte unifiée. (Click & Drag pour forcer un vortex).</p>
            </footer>
        </div>
    );
};
