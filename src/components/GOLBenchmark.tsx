import React, { useEffect, useRef, useState } from 'react';
import { Triade } from '../triade-engine-v2/Triade';
import { EcosystemEngineO1 } from '../triade-engine-v2/engines/EcosystemEngineO1';

const MAP_SIZE = 1000; // 1 Million de cellules (1000x1000 Tensor)

interface Props {
    onClose: () => void;
}

export const GOLBenchmark: React.FC<Props> = ({ onClose }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stats, setStats] = useState({ fps: 0, computeMs: 0 });
    const frameId = useRef<number>(0);
    const sdkRef = useRef<Triade | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        if (!sdkRef.current) {
            sdkRef.current = new Triade(100);
        }
        const sdk = sdkRef.current;

        let cube;
        try {
            cube = sdk.createCube('EcosystemO1', MAP_SIZE, new EcosystemEngineO1());
        } catch (e) {
            console.warn("Utilisation du cube existant", e);
            cube = (sdk as any).cubes.get('EcosystemO1') || sdk.createCube('EcosystemO1_2', MAP_SIZE, new EcosystemEngineO1());
        }

        const face1 = cube.faces[1];
        for (let i = 0; i < face1.length; i++) {
            const r = Math.random();
            face1[i] = r < 0.8 ? 0 : (r < 0.9 ? 2 : 3);
        }

        const imgData = ctx.createImageData(MAP_SIZE, MAP_SIZE);
        const data = imgData.data;

        let lastTime = performance.now();
        let frames = 0;
        let avgCompute = 0;

        const loop = () => {
            const startCompute = performance.now();
            cube.compute();
            const computeTime = performance.now() - startCompute;
            avgCompute = avgCompute * 0.9 + computeTime * 0.1;

            const currentFace = cube.faces[1];
            for (let i = 0; i < currentFace.length; i++) {
                const val = currentFace[i];
                const px = i * 4;

                if (val === 0) { // Vide (Noir)
                    data[px] = 10; data[px + 1] = 10; data[px + 2] = 10;
                } else if (val === 1) { // Plante (Vert)
                    data[px] = 74; data[px + 1] = 222; data[px + 2] = 128;
                } else if (val === 2) { // Herbi (Bleu)
                    data[px] = 96; data[px + 1] = 165; data[px + 2] = 250;
                } else if (val === 3) { // Carni (Rouge)
                    data[px] = 248; data[px + 1] = 113; data[px + 2] = 113;
                }
                data[px + 3] = 255;
            }
            ctx.putImageData(imgData, 0, 0);

            frames++;
            const now = performance.now();
            if (now - lastTime >= 1000) {
                setStats({ fps: frames, computeMs: avgCompute });
                frames = 0;
                lastTime = now;
            }

            frameId.current = requestAnimationFrame(loop);
        };

        frameId.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId.current);
    }, []);

    return (
        <div style={{ width: '100vw', height: '100vh', backgroundColor: '#050505', overflow: 'hidden', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <canvas ref={canvasRef} width={MAP_SIZE} height={MAP_SIZE} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', imageRendering: 'pixelated' }} />

            <div style={{ position: 'absolute', top: 20, left: 20, backgroundColor: 'rgba(15, 15, 15, 0.95)', color: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid rgba(102, 252, 241, 0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.9)', backdropFilter: 'blur(16px)', fontFamily: 'system-ui, sans-serif', zIndex: 10 }}>
                <h1 style={{ color: '#66fcf1', margin: '0 0 4px 0', fontSize: '24px', fontWeight: '900', letterSpacing: '-0.5px' }}>Cyclic Benchmark V1</h1>
                <div style={{ fontSize: '13px', color: '#a3a3a3', fontFamily: 'monospace' }}>Flat Tensor O(1) Stress Test</div>

                <div style={{ marginTop: '24px', display: 'flex', gap: '20px' }}>
                    <div style={{ backgroundColor: '#1c1c1c', padding: '12px 20px', borderRadius: '8px', border: '1px solid #333' }}>
                        <div style={{ fontSize: '10px', color: '#737373', letterSpacing: '1px', textTransform: 'uppercase' }}>FPS (Rendering)</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace' }}>{stats.fps} <span style={{ fontSize: '14px', color: '#a3a3a3' }}>Hz</span></div>
                    </div>
                    <div style={{ backgroundColor: '#1c1c1c', padding: '12px 20px', borderRadius: '8px', border: '1px solid #333' }}>
                        <div style={{ fontSize: '10px', color: '#737373', letterSpacing: '1px', textTransform: 'uppercase' }}>Compute Core (js)</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ff3366', fontFamily: 'monospace' }}>{stats.computeMs.toFixed(2)} <span style={{ fontSize: '14px', color: '#a3a3a3' }}>ms</span></div>
                    </div>
                </div>

                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #262626', fontSize: '11px', color: '#a3a3a3', lineHeight: '1.5' }}>
                    Matrice : <b style={{ color: '#fff' }}>1 000 000 de cellules</b> ({MAP_SIZE}x{MAP_SIZE})<br />
                    Moteur de Rock-Paper-Scissors Automata O(1) inarrêtable.
                </div>

                <button onClick={onClose} style={{ marginTop: '24px', width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }}>
                    Retourner au SaaS Paris
                </button>
            </div>
        </div>
    );
};
