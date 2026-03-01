import React, { useEffect, useRef, useState } from 'react';
import { HypercubeMasterBuffer, HypercubeGrid, FlowFieldEngine } from 'hypercube-compute';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    speed: number;
}

const CHUNK_SIZE = 512;
const COLS = 2;
const ROWS = 2;
const TOTAL_SIZE = CHUNK_SIZE * COLS;
const PARTICLE_COUNT = 15000;

export const SwarmBenchmark: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const debugCanvasRef = useRef<HTMLCanvasElement>(null);
    const [stats, setStats] = useState({ fps: 0, computeMs: 0 });

    const masterRef = useRef<HypercubeMasterBuffer | null>(null);
    const gridRef = useRef<HypercubeGrid | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const targetRef = useRef({ x: TOTAL_SIZE / 2, y: TOTAL_SIZE / 2 });

    useEffect(() => {
        const master = new HypercubeMasterBuffer();
        masterRef.current = master;

        // CRITICAL: isPeriodic = false (the 7th parameter) to stop the grid from syncing boundaries.
        // 2x2 grid of 512x512 chunks = 1024x1024
        const grid = new HypercubeGrid(COLS, ROWS, CHUNK_SIZE, master, () => new FlowFieldEngine(30), 6, false);
        gridRef.current = grid;

        const initialParticles: Particle[] = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            initialParticles.push({
                x: Math.random() * TOTAL_SIZE,
                y: Math.random() * TOTAL_SIZE,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                speed: 1.0 + Math.random() * 0.5
            });
        }
        particlesRef.current = initialParticles;

        let raf: number;
        let lastTime = performance.now();
        let frameCount = 0;

        const loop = async () => {
            const s = performance.now();
            if (!grid) return;

            // Update target globally for all chunks
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    const engine = grid.cubes[y][x]?.engine as any;
                    if (engine) {
                        engine.targetX = targetRef.current.x;
                        engine.targetY = targetRef.current.y;
                    }
                }
            }

            // Engine Compute
            // Note: NO boundary sync ([3, 4]) because FlowFieldEngine is pure analytical Euclidean space
            await grid.compute();
            const computeEnd = performance.now();

            // Physics (Bilinear Sampling)
            for (const p of particlesRef.current) {
                // Bilinear lookup on the correct chunk
                const cx = Math.floor(p.x / CHUNK_SIZE);
                const cy = Math.floor(p.y / CHUNK_SIZE);

                if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) {
                    // Wrap if needed but here we clamp
                    p.x = Math.max(0, Math.min(TOTAL_SIZE - 1, p.x));
                    p.y = Math.max(0, Math.min(TOTAL_SIZE - 1, p.y));
                    continue;
                }

                const cube = grid.cubes[cy][cx]!;
                const f4 = cube.faces[3];
                const f5 = cube.faces[4];

                const lx = p.x % CHUNK_SIZE;
                const ly = p.y % CHUNK_SIZE;

                const x1 = Math.floor(lx);
                const y1 = Math.floor(ly);
                const x2 = x1 >= CHUNK_SIZE - 1 ? x1 : x1 + 1;
                const y2 = y1 >= CHUNK_SIZE - 1 ? y1 : y1 + 1;
                const weightX = lx - x1;
                const weightY = ly - y1;

                const getVec = (ix: number, iy: number) => {
                    const bIdx = iy * CHUNK_SIZE + ix;
                    return { x: f4[bIdx] || 0, y: f5[bIdx] || 0 };
                };

                const v11 = getVec(x1, y1);
                const v21 = getVec(x2, y1);
                const v12 = getVec(x1, y2);
                const v22 = getVec(x2, y2);

                const fx = (v11.x * (1 - weightX) + v21.x * weightX) * (1 - weightY) + (v12.x * (1 - weightX) + v22.x * weightX) * weightY;
                const fy = (v11.y * (1 - weightX) + v21.y * weightX) * (1 - weightY) + (v12.y * (1 - weightX) + v22.y * weightX) * weightY;

                if (!isNaN(fx) && !isNaN(fy)) {
                    p.vx += fx * 0.45;
                    p.vy += fy * 0.45;
                }

                p.x += p.vx * p.speed;
                p.y += p.vy * p.speed;
                p.vx *= 0.85;
                p.vy *= 0.85;

                // Clamping to global boundaries
                if (p.x < 0) { p.x = 0; p.vx *= -0.5; }
                if (p.x >= TOTAL_SIZE) { p.x = TOTAL_SIZE - 1; p.vx *= -0.5; }
                if (p.y < 0) { p.y = 0; p.vy *= -0.5; }
                if (p.y >= TOTAL_SIZE) { p.y = TOTAL_SIZE - 1; p.vy *= -0.5; }
            }

            // Rendering
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d')!;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                ctx.fillStyle = '#60a5fa';
                const scale = canvasRef.current.width / TOTAL_SIZE;
                for (const p of particlesRef.current) {
                    ctx.fillRect(p.x * scale, p.y * scale, 1.5, 1.5);
                }
            }

            if (debugCanvasRef.current) {
                const ctx = debugCanvasRef.current.getContext('2d')!;
                const imgData = ctx.createImageData(TOTAL_SIZE, TOTAL_SIZE);

                for (let cy = 0; cy < ROWS; cy++) {
                    for (let cx = 0; cx < COLS; cx++) {
                        const f3 = grid.cubes[cy][cx]!.faces[2];
                        const startX = cx * CHUNK_SIZE;
                        const startY = cy * CHUNK_SIZE;

                        for (let y = 0; y < CHUNK_SIZE; y++) {
                            const globalY = startY + y;
                            for (let x = 0; x < CHUNK_SIZE; x++) {
                                const globalX = startX + x;
                                const val = f3[y * CHUNK_SIZE + x];
                                const v = (val * 0.5) % 255; // Reduced scale to remove banding

                                const i = (globalY * TOTAL_SIZE + globalX) * 4;
                                imgData.data[i + 0] = v;
                                imgData.data[i + 1] = 255 - v;
                                imgData.data[i + 2] = 100;
                                imgData.data[i + 3] = 255;
                            }
                        }
                    }
                }
                ctx.putImageData(imgData, 0, 0);
            }

            frameCount++;
            const now = performance.now();
            if (now - lastTime >= 1000) {
                setStats({ fps: frameCount, computeMs: computeEnd - s });
                frameCount = 0;
                lastTime = now;
            }
            raf = requestAnimationFrame(loop);
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, []);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * TOTAL_SIZE;
        const y = ((e.clientY - rect.top) / rect.height) * TOTAL_SIZE;
        targetRef.current = { x, y };
    };

    return (
        <div style={{ width: '100%', height: '100%', backgroundColor: '#000', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'monospace' }}>
            <header style={{ padding: '20px', backgroundColor: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <button onClick={onClose} style={{ border: '1px solid #444', background: 'none', color: '#888', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer', marginRight: '20px' }}>← Hub</button>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#60a5fa' }}>TRAMPOLINE <span style={{ color: '#fff' }}>PURE EDITION V3</span></span>
                </div>
                <div style={{ display: 'flex', gap: '30px', fontSize: '14px' }}>
                    <div>Compute: <span style={{ color: '#38bdf8' }}>{stats.computeMs.toFixed(2)} ms</span></div>
                    <div>FPS: <span style={{ color: '#facc15' }}>{stats.fps}</span></div>
                </div>
            </header>

            <main style={{ flex: 1, display: 'flex', gap: '40px', padding: '40px', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: '15px', color: '#aaa', fontSize: '12px' }}>UNIFIED SIMULATION (1024x1024)</div>
                    <canvas
                        ref={canvasRef}
                        width={TOTAL_SIZE}
                        height={TOTAL_SIZE}
                        onMouseMove={handleMouseMove}
                        style={{ width: '60vh', height: '60vh', backgroundColor: '#050505', borderRadius: '12px', cursor: 'crosshair', border: '1px solid #222', boxShadow: '0 0 40px rgba(96, 165, 250, 0.15)' }}
                    />
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: '15px', color: '#aaa', fontSize: '12px' }}>GRAVITY WELL (ALL CHUNKS)</div>
                    <canvas
                        ref={debugCanvasRef}
                        width={TOTAL_SIZE}
                        height={TOTAL_SIZE}
                        style={{ width: '40vh', height: '40vh', backgroundColor: '#000', borderRadius: '12px', border: '1px solid #f87171' }}
                    />
                </div>
            </main>
        </div>
    );
};


