# 🌌 Triadé Project & Tydras Universe

![Triadé Banner](https://img.shields.io/badge/Triad%C3%A9-Engine%20V2-blueviolet?style=for-the-badge) ![Performance](https://img.shields.io/badge/Performance-O(1)-success?style=for-the-badge) ![Status](https://img.shields.io/badge/Status-Active%20R%26D-informational?style=for-the-badge)

Bienvenue sur le dépôt central du **Projet Triadé**. Ce projet dépasse de l'implémentation d'une simple interface web ; il concentre un **moteur de calcul tensoriel massif O(1) (Triade Engine V2)**, des simulateurs physiques de pointe s'exécutant dans le navigateur via *Typed Arrays*, et l'élaboration de la mythologie et des environnements techniques de **l'univers de Tydras**. 

---

## 🚀 Le Cœur de la Technologie : Triade Engine V2

Le moteur **Triadé** est un framework de calcul en grille 3D opérant entièrement de manière continue et avec une **complexité O(1)** pour l'accès aux données. Il s'affranchit des limitations de la gestion mémoire standard des langages de haut niveau pour des performances brutes en JavaScript/TypeScript, sans recourir à WebGL (ou en synergie optionnelle).

- **TriadeMasterBuffer** : Gestion partagée et alignée de la mémoire via des tableaux non typés (SAB, `Int32Array`, `Float32Array`).
- **TriadeCubeV2 / TriadeGrid** : Logique matricielle tridimensionnelle pour opérer des milliards de requêtes simulées.

### Moteurs et Benchmarks Intégrés
Grâce à cette architecture, ce dépôt concentre des algorithmes extrêmement diversifiés :

1. **AerodynamicsEngine (LBM D2Q9) 🌬️**
   Implémentation d'un tunnel de soufflerie virtuel *(Wind Tunnel Benchmark)* et dynamique des fluides calculée selon la méthode Lattice-Boltzmann (D2Q9). Il simule et restitue les vortex (Vorticity) de l'air sur un profil aérodynamique. 
2. **GameOfLifeEngine & EcosystemEngine 🌱**
   Automates cellulaires ultra-optimisés utilisant des décalages binaires (Bitwise) pour une résolution asynchrone instantanée de centaines de milliers de cases simultanément.
3. **Optimiseurs Mathématiques (Prime Sniper) 🔢**
   Implémentations avancées pour les benchmarks Plummer's Primes, incluant la stratégie **GodMode V8** (*Mask Sieve, Loop Unrolling*) poussée sur un clustering de threads (Node.js/Workers) pour fracasser les records de temps d'exécution.

---

## 🌊 Océans de Tydras & Environnement Physique

**Tydras** est un monde vivant, marqué par des événements de marée majeurs et catastrophiques récurrents tous les 8 ans : **Les Marées Royales**.

- **OceanSimulator / Tydras Demo** : L'environnement 3D (actuellement en POC web multi-canvas spatialisée) propose :
  - Un calcul de houle physique et interactif et de normales ondulatoires tridimensionnelles (3D Wave Normals).
  - Un suivi de bateaux avec une flotte marchande ou exploratrice, incluant une gestion native des agencements de clavier internationaux pour les contrôles de navigation (**ZQSD** pour les claviers AZERTY et **WASD** pour les QWERTY).
  - Un système interactif simulant les abysses de Tydras autour d'une Île Centrale, avec maintien et échanges asynchrones des frontières territoriales océaniques continues.

---

## 📐 Éditeur de Terrain & Animation

Nous concevons des outils internes directement connectés au Triade Engine pour la conception du lore de Tydras :
- **Terrain Tools ⛰️** : Rendu des shaders d'eau (Houle de Tydras) interagissant avec la topologie, intégration de tracés de "Routes" texturés, et outils de placement de géométries massives (Plateaux, Bâtiments).
- **Animation de Personnages 🦴** : Simulation de squelettes avec textures (*Skeleton-Aware Texture Skinning*) et animations procédurales d'ondes sinusoïdales (marche dynamique) pour contourner les limites d'un ragdoll physique non contrôlé.

---

## 🤖 MonOs : Copilote Cognitif Intégré

L'écosystème comprend les fondations de **MonOs**, un assistant cognitif intelligent s'exécutant de pair avec notre infrastructure :
- L'architecture de base repose sur des routines Python (`agent.py`, `indexer.py`).
- Moteur d'Indexation RAG basé sur **Ollama** avec le modèle de plongement local `nomic-embed-text` et stockage vectoriel. 

---

## 🔧 Stack Technologique Front-End

Le dépôt, bien qu'architecturé comme une Web App pour le rendu, est un outil en soi :
- **React 18 & Vite** : Utilisation des pipelines de développement ultra-rapide (HMR).
- **TypeScript Strict** : Typage ultra-robuste assurant la validité des manipulations de buffers bas niveau et des grilles.
- **Rendu Hybride** : Optimisation entre DOM React natif, Canvas Context 2D pixel par pixel, et WebGL pour la visualisation de la physique.

## 🏁 Commencer

1. Clonez le dépôt et installez les dépendances :
   ```bash
   npm install
   ```
2. Lancez le serveur de développement / laboratoires (Simulateurs de Tydras, Game of Life, Triade Lab) :
   ```bash
   npm run dev
   ```

*(Pensez à lancer en arrière-plan votre instance Ollama locale avec le modèle approprié pour interagir avec le module MonOs :)*
`ollama pull nomic-embed-text` | `python indexer.py`
