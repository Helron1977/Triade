import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { HypercubeMasterBuffer, HypercubeChunk, HypercubeGrid, HeatmapEngine } from 'hypercube-compute';
import { HypercubeLayer } from '../components/HypercubeLayer';
import '../App.css';

const MAP_SIZE = 800; // Doit matcher process-geofabrik
const PARIS_BOUNDS: [[number, number], [number, number]] = [
  [48.815, 2.224],
  [48.902, 2.469]
];
const PARIS_CENTER: [number, number] = [48.8566, 2.3522];

interface LayerState {
  enabled: boolean;
  weight: number;
  radius: number;
  cube?: HypercubeChunk;
}

export function GeoAnalyzer() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ vram: '0', computeMs: 0 });
  const masterRef = useRef<HypercubeMasterBuffer | null>(null);

  // Notre State d'Urbanisme Multi-Critères
  const [layers, setLayers] = useState<Record<string, LayerState>>({
    vegetation: { enabled: true, weight: 8, radius: 25 },
    transports: { enabled: true, weight: 5, radius: 10 },
    commerces: { enabled: true, weight: -10, radius: 15 } // Poids négatif : On cherche les "déserts" commerciaux !
  });

  // Le buffer final après fusion mathématique (Face de Synthèse Globale)
  const [finalHotspotMap, setFinalHotspotMap] = useState<Float32Array | null>(null);

  useEffect(() => {
    async function boot() {
      if (masterRef.current) return;
      // 1. Initialisation Master Buffer V2 (150 MB pour multiples Grilles)
      masterRef.current = new HypercubeMasterBuffer();

      // 2. Fetch Hyper-Rapide des Tenseurs Binaires (Data Pipeline Geofabrik)
      const loadTensor = async (filename: string, radius: number): Promise<HypercubeChunk> => {
        try {
          const res = await fetch(`/data/${filename}.bin`);
          const arrayBuffer = await res.arrayBuffer();
          const floatData = new Float32Array(arrayBuffer);

          // Création de l'Entité Grid 1x1 et mappage mémoire
          const grid = new HypercubeGrid(1, 1, MAP_SIZE, masterRef.current!, () => new HeatmapEngine(radius));
          const cube = grid.cubes[0][0]!;
          // Injection de la donnée Terrain dans la Face 2 (Contexte)
          cube.faces[1].set(floatData);
          return cube;
        } catch (e) {
          console.error("Failed to load tensor", filename, e);
          const fallbackGrid = new HypercubeGrid(1, 1, MAP_SIZE, masterRef.current!, () => new HeatmapEngine(radius));
          return fallbackGrid.cubes[0][0]!;
        }
      };

      const [vegCube, transCube, shopCube] = await Promise.all([
        loadTensor('vegetation', layers.vegetation.radius),
        loadTensor('transports', layers.transports.radius),
        loadTensor('commerces', layers.commerces.radius)
      ]);

      setLayers(prev => ({
        vegetation: { ...prev.vegetation, cube: vegCube },
        transports: { ...prev.transports, cube: transCube },
        commerces: { ...prev.commerces, cube: shopCube }
      }));

      setLoading(false);
    }
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- LE MOTEUR DE RESOLUTION (Exécuté à chaque interaction UI) ---
  const requestSynthesis = useRef<number | null>(null);

  useEffect(() => {
    if (loading || !masterRef.current) return;

    if (requestSynthesis.current) clearTimeout(requestSynthesis.current);

    // Micro-Debounce pour que les Sliders UI restent fluides à 60FPS
    requestSynthesis.current = window.setTimeout(() => {
      const s = performance.now();

      // Pour chaque couche activée, on met à jour son Rayon et on calcule sa SAT O(1)
      Object.values(layers).forEach((layer: any) => {
        if (layer.enabled && layer.cube) {
          (layer.cube as any).engine.radius = layer.radius;
          layer.cube.compute(); // Calcul Interne Face 3 
        }
      });

      // L'Addition de l'Orchestrateur (Mathématique Tensorielle Pure)
      // On mixe les Faces 3 de chaque cube dans un nouveau Tenseur final
      const mergedFaces = new Float32Array(MAP_SIZE * MAP_SIZE);
      let maxIntens = 0;

      for (let i = 0; i < mergedFaces.length; i++) {
        let val = 0;

        if (layers.vegetation.enabled) val += layers.vegetation.cube!.faces[2][i] * layers.vegetation.weight;
        if (layers.transports.enabled) val += layers.transports.cube!.faces[2][i] * layers.transports.weight;
        if (layers.commerces.enabled) val += layers.commerces.cube!.faces[2][i] * layers.commerces.weight;

        // Élimination des valeurs négatives (zones "interdites" ou ultra-desservies)
        if (val < 0) val = 0;

        mergedFaces[i] = val;
        if (val > maxIntens) maxIntens = val;
      }

      // Optionnel: On peut normaliser immédiatement le buffer merged
      if (maxIntens > 0) {
        for (let i = 0; i < mergedFaces.length; i++) mergedFaces[i] /= maxIntens;
      }

      setFinalHotspotMap(mergedFaces);
      setStats({
        vram: masterRef.current!.getUsedMemoryInMB(),
        computeMs: performance.now() - s
      });

    }, 10);

  }, [layers, loading]);

  const handleChange = (key: string, field: string, val: number | boolean) => {
    setLayers(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: val }
    }));
  };

  if (loading) return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontSize: '20px' }}>
      Chargement du Flat Tensor Ile-de-France...
    </div>
  );

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', backgroundColor: '#171717', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
      <MapContainer
        center={PARIS_CENTER}
        zoom={13}
        style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, zIndex: 1 }}
        zoomControl={false}
      >
        <TileLayer // Carto DB Dark Matter
          attribution='&copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <HypercubeLayer
          faceData={finalHotspotMap}
          mapSize={MAP_SIZE}
          bounds={PARIS_BOUNDS}
          colorScheme="heat"
          opacity={0.8}
        />
      </MapContainer>

      {/* PANNEAU DE CONTRÔLE SaaS */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 9999, width: '420px', backgroundColor: 'rgba(15, 15, 15, 0.95)', color: 'white', padding: '24px', borderRadius: '16px', border: '1px solid rgba(245, 158, 11, 0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.9)', backdropFilter: 'blur(16px)', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        <div style={{ marginBottom: '-10px' }}>
          <Link to="/" style={{ color: '#a3a3a3', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>←</span> Retour au Hub
          </Link>
        </div>

        {/* HEADER & BADGES MARKETING */}
        <header style={{ borderBottom: '1px solid #262626', paddingBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: '900', color: '#f59e0b', margin: 0, letterSpacing: '-0.5px' }}>GeoAnalyzer V2</h1>
              <p style={{ fontSize: '11px', color: '#a3a3a3', fontFamily: 'monospace', marginTop: '4px', marginBottom: 0 }}>Île-de-France Data Pipeline (Geofabrik OSM)</p>
            </div>
            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              LIVE BROWSER DEMO
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px', fontSize: '11px', fontWeight: 'bold' }}>
            <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', padding: '4px 8px', borderRadius: '4px', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' }}>🌐 100% Client-Side</div>
            <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', padding: '4px 8px', borderRadius: '4px', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>🚀 Flat Tensor O(1)</div>
            <div style={{ backgroundColor: 'rgba(244, 63, 94, 0.15)', padding: '4px 8px', borderRadius: '4px', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.3)' }}>⚡ 0 Latence Réseau</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '20px' }}>
            <div style={{ flex: 1, backgroundColor: '#1c1c1c', padding: '12px', borderRadius: '8px', border: '1px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Compute CPU (React)</span>
              <span style={{ fontSize: '18px', color: '#22d3ee', fontWeight: '900', fontFamily: 'monospace' }}>{stats.computeMs.toFixed(1)} <span style={{ fontSize: '12px' }}>ms</span></span>
            </div>
            <div style={{ flex: 1, backgroundColor: '#1c1c1c', padding: '12px', borderRadius: '8px', border: '1px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>ArrayBuffer Alloué</span>
              <span style={{ fontSize: '18px', color: '#ec4899', fontWeight: '900', fontFamily: 'monospace' }}>{stats.vram}</span>
            </div>
          </div>
        </header>



        {/* CUBES Section */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Pondération en Temps Réel</h3>

          {/* VEGETATION */}
          <div style={{ backgroundColor: 'rgba(38, 38, 38, 0.5)', padding: '14px', borderRadius: '12px', border: '1px solid #262626' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: '#4ade80', margin: 0, cursor: 'pointer' }}>
                <input type="checkbox" checked={layers.vegetation.enabled} onChange={e => handleChange('vegetation', 'enabled', e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#4ade80', margin: 0 }} />
                Aura Espaces Verts
              </label>
            </div>
            {layers.vegetation.enabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a3a3a3', marginBottom: '6px' }}><span>Rayon d'influence</span><span>{layers.vegetation.radius} px</span></div>
                  <input type="range" min="1" max="100" value={layers.vegetation.radius} onChange={e => handleChange('vegetation', 'radius', Number(e.target.value))} style={{ width: '100%', accentColor: '#4ade80', margin: 0 }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a3a3a3', marginBottom: '6px' }}><span>Priorité Globale</span><span>x{layers.vegetation.weight}</span></div>
                  <input type="range" min="1" max="20" value={layers.vegetation.weight} onChange={e => handleChange('vegetation', 'weight', Number(e.target.value))} style={{ width: '100%', accentColor: '#4ade80', margin: 0 }} />
                </div>
              </div>
            )}
          </div>

          {/* COMMERCES (Concurrence Négative) */}
          <div style={{ backgroundColor: 'rgba(38, 38, 38, 0.5)', padding: '14px', borderRadius: '12px', border: '1px solid #262626' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: '#f87171', margin: 0, cursor: 'pointer' }}>
                <input type="checkbox" checked={layers.commerces.enabled} onChange={e => handleChange('commerces', 'enabled', e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#f87171', margin: 0 }} />
                Concurrence (Commerces)
              </label>
            </div>
            {layers.commerces.enabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a3a3a3', marginBottom: '6px' }}><span>Rayon de rivalité</span><span>{layers.commerces.radius} px</span></div>
                  <input type="range" min="1" max="100" value={layers.commerces.radius} onChange={e => handleChange('commerces', 'radius', Number(e.target.value))} style={{ width: '100%', accentColor: '#f87171', margin: 0 }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a3a3a3', marginBottom: '6px' }}><span>Facteur Répulsif (Négatif)</span><span style={{ color: '#f87171', fontWeight: 'bold' }}>x{layers.commerces.weight}</span></div>
                  <input type="range" min="-30" max="0" value={layers.commerces.weight} onChange={e => handleChange('commerces', 'weight', Number(e.target.value))} style={{ width: '100%', accentColor: '#f87171', margin: 0 }} />
                </div>
              </div>
            )}
          </div>

          {/* TRANSPORTS */}
          <div style={{ backgroundColor: 'rgba(38, 38, 38, 0.5)', padding: '14px', borderRadius: '12px', border: '1px solid #262626' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: '#60a5fa', margin: 0, cursor: 'pointer' }}>
                <input type="checkbox" checked={layers.transports.enabled} onChange={e => handleChange('transports', 'enabled', e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#60a5fa', margin: 0 }} />
                Gares & Métros
              </label>
            </div>
            {layers.transports.enabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a3a3a3', marginBottom: '6px' }}><span>Accessibilité piétonne</span><span>{layers.transports.radius} px</span></div>
                  <input type="range" min="1" max="100" value={layers.transports.radius} onChange={e => handleChange('transports', 'radius', Number(e.target.value))} style={{ width: '100%', accentColor: '#60a5fa', margin: 0 }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a3a3a3', marginBottom: '6px' }}><span>Priorité Globale</span><span>x{layers.transports.weight}</span></div>
                  <input type="range" min="1" max="20" value={layers.transports.weight} onChange={e => handleChange('transports', 'weight', Number(e.target.value))} style={{ width: '100%', accentColor: '#60a5fa', margin: 0 }} />
                </div>
              </div>
            )}
          </div>
        </section>

        <footer style={{ marginTop: 'auto', padding: '16px', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '12px', border: '1px solid rgba(163, 163, 163, 0.1)', fontSize: '11px', color: '#a3a3a3', lineHeight: '1.6' }}>
          <strong style={{ color: '#fff', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Exécution Silicium Navigatrice</strong>
          Ce rendu mathématique s'exécute <b style={{ color: '#4ade80' }}>entièrement depuis votre appareil</b> en JavaScript.<br /><br />
          À chaque mouvement de curseur, le moteur Flat Tensor ré-évalue <b style={{ color: '#38bdf8' }}>{Object.values(layers).filter((l: any) => l.enabled).length * 64}0 000 points d'intersection géospatiaux</b> en simultané grâce aux accès mémoire continus `(i * width + j)` avec une complexité spatiale O(1).
        </footer>
      </div>
    </div>
  );
}


