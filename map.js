import {Deck} from '@deck.gl/core';
import {ScatterplotLayer} from '@deck.gl/layers';

// Education level table and categories
const TABLE = 'B15003';
const WISCONSIN_FIPS = '55';

// Education categories and their corresponding variables
const EDUCATION_CATEGORIES = {
    'Less than High School': [
        'B15003002', // No Schooling
        'B15003003', // Nursery School
        'B15003004', // Kindergarten
        'B15003005', // 1st Grade
        'B15003006', // 2nd Grade
        'B15003007', // 3rd Grade
        'B15003008', // 4th Grade
        'B15003009', // 5th Grade
        'B15003010', // 6th Grade
        'B15003011', // 7th Grade
        'B15003012', // 8th Grade
        'B15003013', // 9th Grade
        'B15003014', // 10th Grade
        'B15003015', // 11th Grade
        'B15003016'  // 12th Grade, No Diploma
    ],
    'High School Graduate': [
        'B15003017', // Regular High School Diploma
        'B15003018'  // GED or Alternative Credential
    ],
    'Some College': [
        'B15003019', // Some College, Less than 1 Year
        'B15003020'  // Some College, 1 or More Years, No Degree
    ],
    'Associates Degree': [
        'B15003021'  // Associate's Degree
    ],
    'Bachelors Degree': [
        'B15003022'  // Bachelor's Degree
    ],
    'Advanced Degree': [
        'B15003023', // Master's Degree
        'B15003024', // Professional School Degree
        'B15003025'  // Doctorate Degree
    ]
};

// Colors for each education category
const CATEGORY_COLORS = {
    'Less than High School': [239, 59, 44],      // Red
    'High School Graduate': [255, 127, 0],       // Orange
    'Some College': [255, 255, 51],              // Yellow
    'Associates Degree': [51, 160, 44],          // Green
    'Bachelors Degree': [31, 120, 180],         // Blue
    'Advanced Degree': [106, 61, 154]           // Purple
};

// Dot density configuration
const PEOPLE_PER_DOT = 100;

class EducationMap {
    constructor(container) {
        this.container = container;
        this.map = null;
        this.deck = null;
        this.data = [];
        
        this.initialize();
    }

    async initialize() {
        // Initialize MapLibre
        this.map = new maplibregl.Map({
            container: this.container,
            style: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json',
            center: [-89.5, 44.5], // Wisconsin center
            zoom: 7
        });

        // Initialize deck.gl
        this.deck = new Deck({
            canvas: 'deck-canvas',
            width: '100%',
            height: '100%',
            initialViewState: {
                latitude: 44.5,
                longitude: -89.5,
                zoom: 7,
                pitch: 0,
                bearing: 0
            },
            controller: true,
            onViewStateChange: ({viewState}) => {
                this.map.jumpTo({
                    center: [viewState.longitude, viewState.latitude],
                    zoom: viewState.zoom,
                    bearing: viewState.bearing,
                    pitch: viewState.pitch
                });
            }
        });

        await this.loadData();
        this.renderLegend();
    }

    async loadData() {
        // Get Wisconsin tract geometries
        const tracts = await fetchGeoJSON(WISCONSIN_FIPS, Level.Tract);
        
        // Fetch education data for each category
        const educationData = {};
        for (const category in EDUCATION_CATEGORIES) {
            const variables = EDUCATION_CATEGORIES[category];
            for (const variable of variables) {
                const data = await fetchCensusData(WISCONSIN_FIPS, variable, Level.Tract, 2022);
                
                // Aggregate data by tract
                Object.entries(data).forEach(([tractId, count]) => {
                    if (!educationData[tractId]) {
                        educationData[tractId] = {};
                    }
                    if (!educationData[tractId][category]) {
                        educationData[tractId][category] = 0;
                    }
                    educationData[tractId][category] += parseInt(count) || 0;
                });
            }
        }

        // Generate dots
        this.data = this.generateDots(tracts.features, educationData);
        this.updateLayers();
    }

    generateDots(tracts, educationData) {
        const dots = [];
        
        tracts.forEach(tract => {
            const tractId = tract.properties.GEOID;
            const tractData = educationData[tractId];
            
            if (!tractData) return;

            // Generate dots for each education category
            Object.entries(tractData).forEach(([category, population]) => {
                const numDots = Math.round(population / PEOPLE_PER_DOT);
                const bbox = turf.bbox(tract);
                
                for (let i = 0; i < numDots; i++) {
                    const point = turf.randomPosition(bbox);
                    if (turf.booleanPointInPolygon(point, tract)) {
                        dots.push({
                            position: point,
                            category: category,
                            color: CATEGORY_COLORS[category]
                        });
                    }
                }
            });
        });

        return dots;
    }

    updateLayers() {
        const layers = [
            new ScatterplotLayer({
                id: 'dots',
                data: this.data,
                getPosition: d => d.position,
                getFillColor: d => d.color,
                getRadius: 2,
                opacity: 0.8,
                pickable: true,
                radiusMinPixels: 1,
                radiusMaxPixels: 3
            })
        ];

        this.deck.setProps({layers});
    }

    renderLegend() {
        const legend = document.createElement('div');
        legend.className = 'map-legend';
        legend.style.cssText = `
            position: absolute;
            bottom: 20px;
            right: 20px;
            background: white;
            padding: 10px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;

        Object.entries(CATEGORY_COLORS).forEach(([category, color]) => {
            const item = document.createElement('div');
            item.style.cssText = `
                display: flex;
                align-items: center;
                margin: 5px 0;
            `;

            const dot = document.createElement('span');
            dot.style.cssText = `
                width: 10px;
                height: 10px;
                border-radius: 50%;
                margin-right: 8px;
                background: rgb(${color.join(',')});
            `;

            const label = document.createElement('span');
            label.textContent = `${category} (${PEOPLE_PER_DOT} people per dot)`;

            item.appendChild(dot);
            item.appendChild(label);
            legend.appendChild(item);
        });

        this.container.appendChild(legend);
    }
}

export default EducationMap;