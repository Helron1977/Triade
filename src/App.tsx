import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { GeoAnalyzer } from './pages/GeoAnalyzer';
import { GOLBenchmark } from './components/GOLBenchmark';
import { WindTunnelBenchmark } from './components/WindTunnelBenchmark';
import { TriadeCubeLab } from './components/TriadeCubeLab';
import { OceanSimulator } from './pages/OceanSimulator';
import './App.css';

function Hub() {
  return (
    <div style={{ backgroundColor: '#000', minHeight: '100vh', color: '#fff', padding: '40px', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '40px', borderBottom: '1px solid #333', paddingBottom: '20px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#f59e0b', margin: 0, letterSpacing: '-1px' }}>Triade Engine Hub</h1>
        <p style={{ color: '#a3a3a3', marginTop: '10px' }}>Sélectionnez un démonstrateur mathématique (Flat Tensor O(1))</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>

        {/* GEO */}
        <Link to="/geo-analyzer" style={cardStyle('#f59e0b', 'rgba(245, 158, 11, 0.1)')}>
          <div style={tagStyle('#f59e0b')}>DATA GEOSPATIALE</div>
          <h2 style={{ fontSize: '20px', margin: '10px 0', color: '#fff' }}>GeoAnalyzer V2</h2>
          <p style={{ color: '#a3a3a3', fontSize: '14px', lineHeight: '1.5' }}>Urbanisme multicritères en temps réel sur carte Leaflet 800x800. Algorithmes de Set d'Attribution Tensorielle (SAT).</p>
        </Link>

        {/* WIND */}
        <Link to="/wind-tunnel" style={cardStyle('#06b6d4', 'rgba(6, 182, 212, 0.1)')}>
          <div style={tagStyle('#06b6d4')}>MÉCANIQUE FLUIDES</div>
          <h2 style={{ fontSize: '20px', margin: '10px 0', color: '#fff' }}>Soufflerie Aérodynamique</h2>
          <p style={{ color: '#a3a3a3', fontSize: '14px', lineHeight: '1.5' }}>Solveur de Navier-Stokes (LBM D2Q9) O(1) pour l'analyse de traînée autour d'un modèle interactif.</p>
        </Link>

        {/* OCEAN LBM */}
        <Link to="/ocean-simulator" style={cardStyle('#3b82f6', 'rgba(59, 130, 246, 0.1)')}>
          <div style={tagStyle('#3b82f6')}>OCEANOGRAPHIE</div>
          <h2 style={{ fontSize: '20px', margin: '10px 0', color: '#fff' }}>Océan Tydras (LBM)</h2>
          <p style={{ color: '#a3a3a3', fontSize: '14px', lineHeight: '1.5' }}>Simulation Navale (Météo et Vagues D2Q9) multi-tuiles pour architecture MMORPG serverless.</p>
        </Link>

        {/* GOL */}
        <Link to="/game-of-life" style={cardStyle('#ef4444', 'rgba(239, 68, 68, 0.1)')}>
          <div style={tagStyle('#ef4444')}>AUTOMATES CELLULAIRES</div>
          <h2 style={{ fontSize: '20px', margin: '10px 0', color: '#fff' }}>Guerre Rouge / Bleu</h2>
          <p style={{ color: '#a3a3a3', fontSize: '14px', lineHeight: '1.5' }}>Générations cellulaires à rythme effréné. Conflit territorial implémenté sans aucune boucle de recherche (If/Else).</p>
        </Link>

        {/* LAB CAHIER DES CHARGES */}
        <Link to="/lab" style={cardStyle('#a855f7', 'rgba(168, 85, 247, 0.1)')}>
          <div style={tagStyle('#a855f7')}>API DEVELOPPEUR</div>
          <h2 style={{ fontSize: '20px', margin: '10px 0', color: '#fff' }}>Standard d'Intégration</h2>
          <p style={{ color: '#a3a3a3', fontSize: '14px', lineHeight: '1.5' }}>Démonstrateur de l'API native (Multi-Cubes Grid, Canvas 2D, et Textures WebGL via pointeur direct).</p>
        </Link>

      </div>
    </div>
  );
}

const cardStyle = (color: string, bgColor: string): React.CSSProperties => ({
  display: 'block',
  padding: '24px',
  backgroundColor: '#111',
  border: `1px solid #333`,
  borderRadius: '12px',
  textDecoration: 'none',
  transition: 'all 0.2s',
  borderBottom: `2px solid ${color}`,
  backgroundImage: `radial-gradient(circle at top right, ${bgColor}, transparent 70%)`
});

const tagStyle = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 'bold',
  color: color,
  border: `1px solid ${color}`,
  padding: '2px 8px',
  borderRadius: '4px',
  marginBottom: '10px'
});

// Wrappers pour fournir `onClose` qui utilise le routeur
function WindWrapper() {
  const nav = useNavigate();
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, right: 0, zIndex: 9999 }}>
      <WindTunnelBenchmark onClose={() => nav('/')} />
    </div>
  );
}

function GOLWrapper() {
  const nav = useNavigate();
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, right: 0, zIndex: 9999 }}>
      <GOLBenchmark onClose={() => nav('/')} />
    </div>
  );
}

function LabWrapper() {
  const nav = useNavigate();
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, right: 0, zIndex: 9999 }}>
      <TriadeCubeLab onClose={() => nav('/')} />
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/geo-analyzer" element={<GeoAnalyzer />} />
      <Route path="/wind-tunnel" element={<WindWrapper />} />
      <Route path="/ocean-simulator" element={<OceanSimulator />} />
      <Route path="/game-of-life" element={<GOLWrapper />} />
      <Route path="/lab" element={<LabWrapper />} />
    </Routes>
  );
}

export default App;
