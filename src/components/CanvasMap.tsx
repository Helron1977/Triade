import React, { useRef, useEffect } from 'react';
import './CanvasMap.css';

interface CanvasMapProps {
    data: Float32Array | Uint8Array; // Les données à afficher (Face 1, 2, 3 ou 4)
    width: number;
    height: number;
    colorRamp: (value: number) => { r: number, g: number, b: number, a: number };
    title: string;
    showMap?: boolean; // Option pour afficher la vraie carte en dessous
}

export const CanvasMap: React.FC<CanvasMapProps> = ({ data, width, height, colorRamp, title, showMap = false }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Création d'un buffer d'image natif pour des perfs massives (60 FPS)
        const imgData = ctx.createImageData(width, height);
        const pixels = imgData.data;

        // Remplissage des 160 000 ou 1 000 000 de pixels en JavaScript pur
        for (let i = 0; i < data.length; i++) {
            const val = data[i];
            const color = colorRamp(val);

            const pIdx = i * 4; // RGBA
            pixels[pIdx] = color.r;     // Red
            pixels[pIdx + 1] = color.g; // Green
            pixels[pIdx + 2] = color.b; // Blue
            pixels[pIdx + 3] = color.a; // Alpha
        }

        // Peindre le buffer sur le canvas d'un coup
        ctx.putImageData(imgData, 0, 0);
    }, [data, width, height, colorRamp]);

    return (
        <div className="canvas-container">
            <h3 className="canvas-title">{title}</h3>
            <div style={{ position: 'relative', width, height }}>
                {showMap && (
                    <iframe
                        title="OSM Background"
                        width={width}
                        height={height}
                        style={{ position: 'absolute', top: 0, left: 0, border: 0, opacity: 0.6, pointerEvents: 'none' }}
                        src="https://www.openstreetmap.org/export/embed.html?bbox=-0.4900,46.3000,-0.4200,46.3400&layer=mapnik"
                    />
                )}
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    className="performance-canvas"
                    style={{ position: 'absolute', top: 0, left: 0 }}
                />
            </div>
        </div>
    );
};
