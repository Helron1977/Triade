import React, { useEffect, useRef, useState } from 'react';
import { HypercubeMasterBuffer, HypercubeGrid, AerodynamicsEngine } from 'hypercube-compute';

const MAP_SIZE = 64; // Minimal grid for validation

export const MinimalLBMTest: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stats, setStats] = useState({ fps: 0, computeMs: 0 });
    const masterRef = useRef<HypercubeMasterBuffer | null>(null);
    const gridRef = useRef<HypercubeGrid | null>(null);

    const [gpuMode, setGpuMode] = useState(false);

    useEffect(() => {
        let grid: HypercubeGrid;
        let isActive = true;

        const init = async () => {
            const master = new HypercubeMasterBuffer();
            masterRef.current = master;

            // Auto-detects 22 faces. isPeriodic = false for pure outlet sink.
            grid = await HypercubeGrid.create(
                1, 1, MAP_SIZE, master,
                () => new AerodynamicsEngine(),
                6, false, gpuMode ? 'webgpu' : 'cpu'
            );
            gridRef.current = grid;

            const cube = grid.cubes[0][0]!;
            const obstacles = cube.faces[18];
            obstacles.fill(0);

            // Simple square obstacle in the middle
            for (let y = 28; y < 36; y++) {
                for (let x = 20; x < 28; x++) {
                    obstacles[y * MAP_SIZE + x] = 1;
                }
            }

            let lastTime = performance.now();
            let frames = 0;

            const loop = async () => {
                if (!isActive) return;
                const s = performance.now();

                // Multi-step
                await grid.compute();
                await grid.compute();
                await grid.compute();

                const e = performance.now();

                if (canvasRef.current && cube) {
                    const ctx = canvasRef.current.getContext('2d')!;
                    const imgData = ctx.createImageData(MAP_SIZE, MAP_SIZE);

                    // NOTE: If WebGPU, we would need to map buffers back to see the results here.
                    // For now, this is just a skeleton test.
                    const curl = cube.faces[21];
                    const obs = cube.faces[18];

                    for (let i = 0; i < MAP_SIZE * MAP_SIZE; i++) {
                        const px = i * 4;
                        if (obs[i] > 0) {
                            imgData.data[px] = 255; imgData.data[px + 1] = 255; imgData.data[px + 2] = 255;
                        } else {
                            const val = curl[i] * 2000;
                            imgData.data[px] = val > 0 ? val : 0;
                            imgData.data[px + 1] = 0;
                            imgData.data[px + 2] = val < 0 ? -val : 0;
                        }
                        imgData.data[px + 3] = 255;
                    }
                    ctx.putImageData(imgData, 0, 0);
                }

                frames++;
                if (performance.now() - lastTime >= 1000) {
                    setStats({ fps: frames, computeMs: e - s });
                    frames = 0;
                    lastTime = performance.now();
                }
                requestAnimationFrame(loop);
            };

            loop();
        };

        init();
        return () => { isActive = false; };
    }, [gpuMode]);

    return (
        <div style={{ padding: '20px', backgroundColor: '#111', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <h2>LBM Minimal Grid Test (64x64)</h2>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div>FPS: {stats.fps}</div>
                <div>Compute (3x): {stats.computeMs.toFixed(2)}ms</div>
                <button
                    onClick={() => setGpuMode(!gpuMode)}
                    style={{ padding: '5px 15px', backgroundColor: gpuMode ? '#00ff00' : '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    MOD: {gpuMode ? 'WEBGPU (Skeleton)' : 'CPU'}
                </button>
            </div>
            <canvas ref={canvasRef} width={MAP_SIZE} height={MAP_SIZE} style={{ width: '512px', height: '512px', imageRendering: 'pixelated', border: '2px solid #555', boxShadow: gpuMode ? '0 0 20px rgba(0, 255, 0, 0.2)' : 'none' }} />
            <button onClick={onClose} style={{ padding: '10px 20px' }}>Retour Hub</button>
            <div style={{ fontSize: '12px', color: '#888' }}>Vérification du Bounce-Back et de la Vorticité sur grille unitaire.</div>
        </div>
    );
};


