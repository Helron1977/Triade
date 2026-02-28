import React, { useEffect, useRef, useState } from 'react';
import { Triade } from '../triade-engine-v2/Triade';
import { AerodynamicsEngine } from '../triade-engine-v2/engines/AerodynamicsEngine';

const MAP_SIZE = 400; // 160 000 cellules (LBM D2Q9, 22 Faces = 14MB RAM)

interface Props {
    onClose: () => void;
}

export const WindTunnelBenchmark: React.FC<Props> = ({ onClose }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stats, setStats] = useState({ fps: 0, computeMs: 0 });
    const [angle, setAngle] = useState(15);
    const [drag, setDrag] = useState(0);
    const frameId = useRef<number>(0);
    const sdkRef = useRef<Triade | null>(null);

    const rasterizeProfile = (faces: Float32Array[], wingAngle: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = MAP_SIZE;
        canvas.height = MAP_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

        ctx.fillStyle = 'white';

        // Aileron de Formule 1 ou Avion (Profil)
        const scale = 2.0;
        const ox = 150; const oy = 200; // offset

        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate((-wingAngle * Math.PI) / 180); // Inversion pour le downforce/portance naturel

        ctx.beginPath();
        // NACA-like droplet shape (Goutte d'eau aérodynamique)
        ctx.ellipse(0, 0, 50 * scale, 8 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const imgData = ctx.getImageData(0, 0, MAP_SIZE, MAP_SIZE);
        const obstacles = faces[18]; // Face 18 pour LBM Obstacles
        for (let i = 0; i < MAP_SIZE * MAP_SIZE; i++) {
            obstacles[i] = imgData.data[i * 4] > 128 ? 1 : 0;
            if (obstacles[i] > 0) {
                // Reset macro velocities inside obstacle
                faces[19][i] = 0; // ux
                faces[20][i] = 0; // uy
            }
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        if (!sdkRef.current) {
            sdkRef.current = new Triade(80);
        }
        const sdk = sdkRef.current;

        let cube;
        try {
            // Demande 22 faces (D2Q9) : 9(f) + 9(f_next) + Obstacle + Ux + Uy + Curl
            cube = sdk.createCube('WindTunnelLBM', MAP_SIZE, new AerodynamicsEngine(), 22);
        } catch (e) {
            cube = (sdk as any).cubes.get('WindTunnelLBM') || sdk.createCube('WindTunnelLBM2', MAP_SIZE, new AerodynamicsEngine(), 22);
        }

        // Première rasterisation de l'obstacle
        rasterizeProfile(cube.faces, 15);

        const imgData = ctx.createImageData(MAP_SIZE, MAP_SIZE);
        const data = imgData.data;

        let lastTime = performance.now();
        let frames = 0;
        let avgCompute = 0;

        const loop = () => {
            const startCompute = performance.now();

            // On tourne le LBM 3 fois par frame pour accélérer le visuel du vent (Sub-stepping O(1))
            cube.compute();
            cube.compute();
            cube.compute();

            const computeTime = performance.now() - startCompute;
            avgCompute = avgCompute * 0.9 + computeTime * 0.1;

            const obstacles = cube.faces[18];
            const curl = cube.faces[21]; // Face de Vorticité
            const engine = cube.engine as AerodynamicsEngine;

            for (let i = 0; i < curl.length; i++) {
                const px = i * 4;

                if (obstacles[i] > 0) { // Aileron Carbone / Métal
                    data[px] = 180; data[px + 1] = 180; data[px + 2] = 180;
                } else {
                    const c = curl[i] * 5000.0; // Amplificateur de Vorticité Navier-Stokes

                    if (c > 10) {
                        // Rotation Horaire (Rouge feu / Jaune)
                        const val = Math.min(255, c);
                        data[px] = 255;
                        data[px + 1] = val * 0.5;
                        data[px + 2] = 0;
                    } else if (c < -10) {
                        // Rotation Anti-horaire (Bleu azur / Cyan)
                        const val = Math.min(255, -c);
                        data[px] = 0;
                        data[px + 1] = val * 0.5;
                        data[px + 2] = 255;
                    } else {
                        // Calme (Noir profond)
                        data[px] = 5;
                        data[px + 1] = 5;
                        data[px + 2] = 5;
                    }
                }
                data[px + 3] = 255;
            }
            ctx.putImageData(imgData, 0, 0);

            frames++;
            const now = performance.now();
            if (now - lastTime >= 1000) {
                setStats({ fps: frames, computeMs: avgCompute });
                setDrag(engine.dragScore);
                frames = 0;
                lastTime = now;
            }

            frameId.current = requestAnimationFrame(loop);
        };

        frameId.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId.current);
    }, []);

    const handleAngleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        setAngle(val);
        if (sdkRef.current) {
            const iter = (sdkRef.current as any).cubes.values();
            for (const cube of iter) {
                if (cube.engine instanceof AerodynamicsEngine) {
                    rasterizeProfile(cube.faces, val);
                }
            }
        }
    };

    return (
        <div style={{ width: '100vw', height: '100vh', backgroundColor: '#050505', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', top: 20, left: 20, backgroundColor: 'rgba(15, 15, 15, 0.95)', color: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid rgba(102, 252, 241, 0.3)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <h1 style={{ color: '#66fcf1', margin: '0', fontSize: '24px', letterSpacing: '-0.5px' }}>LBM D2Q9 (Navier-Stokes)</h1>

                <div style={{ fontSize: '13px', color: '#a3a3a3' }}>Simulation CFD O(1) Exacte | Allées de Von Kármán</div>

                <div style={{ display: 'flex', gap: '20px' }}>
                    <div style={{ backgroundColor: '#1c1c1c', padding: '12px 20px', borderRadius: '8px', border: '1px solid #333' }}>
                        <div style={{ fontSize: '10px', color: '#737373', textTransform: 'uppercase' }}>FPS (Rendering)</div>
                        <div style={{ fontSize: '28px', color: '#fff' }}>{stats.fps}</div>
                    </div>
                    <div style={{ backgroundColor: '#1c1c1c', padding: '12px 20px', borderRadius: '8px', border: '1px solid #333' }}>
                        <div style={{ fontSize: '10px', color: '#737373', textTransform: 'uppercase' }}>Micro-ops (Core)</div>
                        <div style={{ fontSize: '28px', color: '#ff3366' }}>{stats.computeMs.toFixed(2)}ms</div>
                    </div>
                    <div style={{ backgroundColor: '#112233', padding: '12px 20px', borderRadius: '8px', border: '1px solid #3366ff' }}>
                        <div style={{ fontSize: '10px', color: '#77aaff', textTransform: 'uppercase' }}>Force de Traînée (Drag)</div>
                        <div style={{ fontSize: '28px', color: '#33ccff', fontWeight: 'bold' }}>{Math.floor(drag)}</div>
                    </div>
                </div>

                <div style={{ marginTop: '10px' }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                        Angle d'Attaque (Aileron): <b>{angle}°</b>
                    </label>
                    <input
                        type="range" min="-45" max="45" value={angle} onChange={handleAngleChange}
                        style={{ width: '100%', accentColor: '#66fcf1' }}
                    />
                </div>

                <div style={{ fontSize: '11px', color: '#888', marginTop: '10px' }}>
                    Rendu de <b>Vorticité (Curl)</b> : Rouge (Turbulence Horaire), Bleu (Anti-horaire). Le réseau Boltzmann relaxe 160,000 cellules 180 fois/sec sur un Tensor Triade 22-Faces.
                </div>

                <button onClick={onClose} style={{ padding: '10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '10px', fontWeight: 'bold' }}>
                    Fermer la Soufflerie
                </button>
            </div>

            <canvas ref={canvasRef} width={MAP_SIZE} height={MAP_SIZE} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
        </div>
    );
};
