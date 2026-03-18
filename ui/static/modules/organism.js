/**
 * ============================================================
 *  AutoResearch — Project Organism Module
 * ============================================================
 *
 *  Connectable evolution visualizer for the dashboard sidebar.
 *  The "organism" is an SVG-based entity that grows and evolves
 *  based on project experiment metrics.
 *
 *  HOW TO CUSTOMIZE:
 *  1. Edit the STAGES config below to change thresholds/names/colors
 *  2. Edit generateNodes() to change the visual layout algorithm
 *  3. Edit generateLinks() to change connection patterns
 *  4. Add your own creature types in CREATURES
 *  5. Set window.ORGANISM_CONFIG in index.html before loading this module
 *
 *  USAGE:
 *    <script src="/modules/organism.js"></script>
 *    <!-- In Alpine.js template, replace inline organism with: -->
 *    <div x-html="renderOrganism()"></div>
 *
 *  CONFIG OVERRIDE (in index.html, before this script):
 *    <script>
 *      window.ORGANISM_CONFIG = {
 *        creature: 'crystal',    // 'neural' | 'crystal' | 'tree' | custom
 *        size: 140,              // SVG viewBox size
 *      };
 *    </script>
 * ============================================================
 */

;(function () {
    'use strict';

    const CFG = Object.assign({
        creature: 'neural',
        size: 120,
        nodeCountFactor: 7,       // experiments per node (lower = more dense)
        maxNodes: 30,
    }, window.ORGANISM_CONFIG || {});

    // ================================================================
    //  EVOLUTION STAGES — edit thresholds, names, colors here
    // ================================================================
    const STAGES = [
        { minExp: 0,   name: 'DORMANT',     colorClass: 'text-[#3a4a6a]' },
        { minExp: 1,   name: 'SINGLE CELL',  colorClass: 'text-[#b44aff]' },
        { minExp: 5,   name: 'MULTICELL',    colorClass: 'text-[#b44aff]' },
        { minExp: 20,  name: 'ORGANISM',     colorClass: 'text-[#00e5ff]' },
        { minExp: 50,  name: 'NEURAL NET',   colorClass: 'text-[#39ff14] glow-green' },
        { minExp: 100, name: 'SENTIENT',     colorClass: 'text-[#b44aff] glow-purple' },
        { minExp: 150, name: 'TRANSCENDENT', colorClass: 'text-[#00e5ff] glow-cyan' },
    ];

    // ================================================================
    //  TYPE COLORS — maps experiment types to node/link colors
    // ================================================================
    const TYPE_COLORS = {
        'Bug Fix':      '#ff3355',
        'Security':     '#ffaa00',
        'Feature':      '#00f0ff',
        'Refactoring':  '#b44aff',
        'Improvement':  '#00ff9d',
        'Docs':         '#ff00e5',
        'Other':        '#4a5a7a',
    };

    // ================================================================
    //  CREATURES — different visual algorithms
    // ================================================================
    const CREATURES = {
        /**
         * Default: neural network style — nodes on radial orbits with connections
         */
        neural: {
            generateNodes(count, score, typeDist) {
                const nodes = [];
                const typeKeys = Object.keys(typeDist);
                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * Math.PI * 2 + _seed(i * 3.7) * 0.5;
                    const r = 18 + _seed(i * 7.3) * 30;
                    nodes.push({
                        x: 50 + Math.cos(angle) * r,
                        y: 50 + Math.sin(angle) * r,
                        r: 1.2 + _seed(i * 11.1) * 2.2,
                        color: TYPE_COLORS[typeKeys[i % typeKeys.length]] || '#4a5a7a',
                        opacity: 0.35 + score * 0.65,
                    });
                }
                return nodes;
            },
            generateLinks(nodes) {
                const links = [];
                for (let i = 0; i < nodes.length - 1; i++) {
                    if (i % 2 === 0) links.push(_link(nodes[i], nodes[i + 1]));
                    if (nodes.length > 15 && i % 3 === 0 && i + 5 < nodes.length)
                        links.push({ ..._link(nodes[i], nodes[i + 5]), color: '#00f0ff' });
                }
                return links;
            },
        },

        /**
         * Crystal: angular geometric shapes — octahedrons and facets
         */
        crystal: {
            generateNodes(count, score, typeDist) {
                const nodes = [];
                const rings = Math.ceil(count / 6);
                for (let ring = 0; ring < rings; ring++) {
                    const perRing = Math.min(6, count - ring * 6);
                    const r = 12 + ring * 10;
                    for (let i = 0; i < perRing; i++) {
                        const angle = (i / perRing) * Math.PI * 2 + ring * 0.5;
                        const typeKeys = Object.keys(typeDist);
                        nodes.push({
                            x: 50 + Math.cos(angle) * r,
                            y: 50 + Math.sin(angle) * r,
                            r: 1 + ring * 0.5,
                            color: TYPE_COLORS[typeKeys[(ring + i) % typeKeys.length]] || '#4a5a7a',
                            opacity: 0.4 + score * 0.6,
                        });
                    }
                }
                return nodes;
            },
            generateLinks(nodes) {
                const links = [];
                for (let i = 0; i < nodes.length; i++) {
                    const next = (i + 1) % nodes.length;
                    links.push(_link(nodes[i], nodes[next]));
                    if (i + 6 < nodes.length) links.push(_link(nodes[i], nodes[i + 6]));
                }
                return links;
            },
        },

        /**
         * Tree: branching dendritic structure
         */
        tree: {
            generateNodes(count, score, typeDist) {
                const nodes = [];
                const typeKeys = Object.keys(typeDist);
                // Trunk + branches
                nodes.push({ x: 50, y: 85, r: 2, color: '#00ff9d', opacity: 0.8 }); // root
                nodes.push({ x: 50, y: 70, r: 2, color: '#00ff9d', opacity: 0.7 }); // trunk
                const branchCount = count - 2;
                for (let i = 0; i < branchCount; i++) {
                    const side = i % 2 === 0 ? -1 : 1;
                    const depth = Math.floor(i / 2);
                    const spread = 8 + depth * 5;
                    nodes.push({
                        x: 50 + side * spread + _seed(i * 5) * 6,
                        y: 70 - (depth + 1) * 8 - _seed(i * 3) * 3,
                        r: 1 + _seed(i * 7) * 1.5,
                        color: TYPE_COLORS[typeKeys[i % typeKeys.length]] || '#4a5a7a',
                        opacity: 0.3 + score * 0.7,
                    });
                }
                return nodes;
            },
            generateLinks(nodes) {
                const links = [];
                if (nodes.length < 2) return links;
                links.push(_link(nodes[0], nodes[1])); // root to trunk
                for (let i = 2; i < nodes.length; i++) {
                    const parent = i % 2 === 0 ? 1 : (i > 3 ? Math.floor(i / 2) : 1);
                    if (parent < nodes.length) links.push(_link(nodes[parent], nodes[i]));
                }
                return links;
            },
        },
    };

    // ================================================================
    //  HELPERS
    // ================================================================
    function _seed(s) {
        let x = Math.sin(s + 1) * 10000;
        return x - Math.floor(x);
    }

    function _link(a, b) {
        return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: a.color };
    }

    function _scoreColor(score) {
        if (score >= 0.9) return '#00f0ff';
        if (score >= 0.8) return '#b44aff';
        if (score >= 0.7) return '#00ff9d';
        if (score >= 0.5) return '#ffaa00';
        return '#ff3355';
    }

    // ================================================================
    //  PUBLIC API — attach to window for Alpine.js integration
    // ================================================================
    window.OrganismModule = {

        /**
         * Get the current evolution stage name
         */
        getStage(totalExp) {
            for (let i = STAGES.length - 1; i >= 0; i--) {
                if (totalExp >= STAGES[i].minExp) return STAGES[i];
            }
            return STAGES[0];
        },


        /**
         * Generate all node positions for SVG rendering
         */
        getNodes(totalExp, avgScore, typeDist) {
            const creature = CREATURES[CFG.creature] || CREATURES.neural;
            const count = Math.min(Math.ceil(totalExp / CFG.nodeCountFactor), CFG.maxNodes);
            return creature.generateNodes(count, avgScore, typeDist);
        },

        /**
         * Generate all links between nodes
         */
        getLinks(totalExp, avgScore, typeDist) {
            const nodes = this.getNodes(totalExp, avgScore, typeDist);
            const creature = CREATURES[CFG.creature] || CREATURES.neural;
            return creature.generateLinks(nodes);
        },

        /**
         * Render the full organism SVG as HTML string.
         * For use with Alpine.js x-html directive.
         */
        renderSVG(totalExp, avgScore, typeDist, isRunning) {
            const stage = this.getStage(totalExp);
            const coreColor = _scoreColor(avgScore);
            const nodes = this.getNodes(totalExp, avgScore, typeDist);
            const links = this.getLinks(totalExp, avgScore, typeDist);
            const s = CFG.size;

            return `
            <svg viewBox="0 0 ${s} ${s}" class="w-full h-full">
                <!-- Orbit rings -->
                <circle cx="50%" cy="50%" r="${s * 0.46}" fill="none" stroke="rgba(0,240,255,0.06)" stroke-width="0.8"
                        ${isRunning ? 'class="animate-rotate-slow"' : ''}/>
                <circle cx="50%" cy="50%" r="${s * 0.38}" fill="none" stroke="rgba(180,74,255,0.06)" stroke-width="0.8"
                        stroke-dasharray="2 6" ${isRunning ? 'class="animate-rotate-slow" style="animation-direction:reverse;animation-duration:30s"' : ''}/>

                <!-- Links -->
                ${links.map(l => `
                    <line x1="${l.x}%" y1="${l.y}%" x2="${l.x2}%" y2="${l.y2}%"
                          stroke="${l.color}" stroke-width="0.5" opacity="0.25"
                          stroke-dasharray="3 3" style="animation: data-flow 2s linear infinite;"/>`).join('')}

                <!-- Nodes -->
                ${nodes.map(n => `
                    <circle cx="${n.x}%" cy="${n.y}%" r="${n.r}" fill="${n.color}" opacity="${n.opacity}">
                        <animate attributeName="r" values="${n.r};${n.r + 0.8};${n.r}" dur="${2 + _seed(n.x) * 3}s" repeatCount="indefinite"/>
                    </circle>`).join('')}

                <!-- Core glow -->
                <circle cx="50%" cy="50%" r="${s * 0.1}" fill="${coreColor}" opacity="0.12"/>
                <circle cx="50%" cy="50%" r="${s * 0.065}" fill="${coreColor}" opacity="0.25"/>
                <circle cx="50%" cy="50%" r="${s * 0.035}" fill="${coreColor}" class="animate-breathe"/>
            </svg>`;
        },
    };

    // [Organism Module] Loaded — creature: ' + CFG.creature
})();
