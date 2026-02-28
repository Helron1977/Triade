import React from 'react';
import './Cube3D.css';

interface Cube3DProps {
    facesData: {
        primary: Float32Array;
        complementary: Float32Array;
        context: Float32Array;
        integral: Float32Array;
        synthesis: Float32Array;
        flags: Uint8Array;
    };
    width: number;
    height: number;
    rotation: { x: number; y: number; z: number };
}

export const Cube3D: React.FC<Cube3DProps> = ({ facesData, width, height, rotation }) => {
    // Construit la grille 2D colorée d'une face
    const renderFace = (data: Float32Array | Uint8Array, title: string, colorRamp: (val: number) => string) => {
        const cells = [];
        for (let i = 0; i < width * height; i++) {
            const val = data[i];
            cells.push(
                <div
                    key={i}
                    style={{ backgroundColor: colorRamp(val) }}
                    className="cube-cell"
                ></div>
            );
        }
        return (
            <div className="face-content">
                <h4>{title}</h4>
                <div
                    className="grid-container"
                    style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}
                >
                    {cells}
                </div>
            </div>
        );
    };

    // Règles de coloration
    const popColor = (v: number) => `rgba(100, 150, 255, ${v / 100})`; // Max Pop ~ 100
    const compColor = (v: number) => {
        const alpha = Math.min(1, Math.abs(v) / 50);
        return v > 0 ? `rgba(50, 255, 100, ${alpha})` : `rgba(255, 50, 50, ${alpha})`;
    };
    const ctxColor = (v: number) => `rgba(255, 200, 0, ${v > 0 ? 0.8 : 0})`; // POI = 1 or 0
    const intColor = (v: number) => {
        const maxSatEstim = 50;
        return `rgba(200, 100, 255, ${Math.min(1, v / maxSatEstim)})`;
    };
    const synthColor = (v: number) => {
        // Score ~ Pop * POIs_around
        return `rgba(255, 50, 100, ${Math.min(1, v / 500)})`;
    };
    const flagColor = (v: number) => v === 1 ? `rgba(255, 0, 0, 0.9)` : `rgba(0, 0, 0, 0.3)`;

    return (
        <div className="cube-scene">
            <div
                className="cube"
                style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)` }}
            >
                <div className="face face-front">
                    {renderFace(facesData.primary, '1. Primary (Population)', popColor)}
                </div>
                <div className="face face-back">
                    {renderFace(facesData.complementary, '6. Complem. (Anomalies)', compColor)}
                </div>
                <div className="face face-right">
                    {renderFace(facesData.context, '2. Context (POIs)', ctxColor)}
                </div>
                <div className="face face-left">
                    {renderFace(facesData.integral, '5. Integral (Context SAT)', intColor)}
                </div>
                <div className="face face-top">
                    {renderFace(facesData.synthesis, '3. Synthesis (Score)', synthColor)}
                </div>
                <div className="face face-bottom">
                    {renderFace(facesData.flags, '4. Flags (Hotspots)', flagColor)}
                </div>
            </div>
        </div>
    );
};
