let CENSUS_API_KEY = 'abe2dd4b6a1413df8b5f0584d640d2f2c9b4f497';

let CATEGORY_COLORS = {
    'Less than High School': [220, 50, 32],     // Red
    'High School Graduate': [254, 178, 76],    // Orange
    'Some College': [255, 255, 191],           // Yellow
    'Associates Degree': [166, 217, 106],      // Light Green
    'Bachelors Degree': [102, 166, 204],       // Light Blue
    'Advanced Degree': [31, 120, 180]          // Blue
};

let EDUCATION_CATEGORIES = {
    'Less than High School': [
        'B15003_002E', 'B15003_003E', 'B15003_004E', 'B15003_005E',
        'B15003_006E', 'B15003_007E', 'B15003_008E', 'B15003_009E',
        'B15003_010E', 'B15003_011E', 'B15003_012E', 'B15003_013E',
        'B15003_014E', 'B15003_015E', 'B15003_016E'
    ],
    'High School Graduate': ['B15003_017E', 'B15003_018E'],
    'Some College': ['B15003_019E', 'B15003_020E'],
    'Associates Degree': ['B15003_021E'],
    'Bachelors Degree': ['B15003_022E'],
    'Advanced Degree': ['B15003_023E', 'B15003_024E', 'B15003_025E']
};

let LOCAL_CACHE = {};
let tractDataMap = new Map();
let tractDensities = [];
let deckgl;
let currentCategory = document.getElementById('category-select').value;
let currentMode = document.getElementById('mode-switch').checked ? '3d' : 'flat';
let tractData;
let map; // Add this with other global variables at the top

// Replace the WISCONSIN_FIPS constant with:
const STATE_FIPS = {
    'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09',
    'DE': '10', 'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18',
    'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25',
    'MI': '26', 'MN': '27', 'MS': '28', 'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32',
    'NH': '33', 'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39',
    'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45', 'SD': '46', 'TN': '47',
    'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55',
    'WY': '56', 'DC': '11'
};

let currentState = document.getElementById('state-select').value;
console.log('currentState is now:', currentState);
let currentStateFips = STATE_FIPS[currentState];

// Add event listener for state changes
document.getElementById('state-select').addEventListener('change', async (e) => {
    currentState = e.target.value;
    currentStateFips = STATE_FIPS[currentState];
    document.getElementById('loading').style.display = 'block';
    await loadData();
    
    // Calculate bounds for the new state data
    const bounds = getBoundsForState(tractData);
    
    // Calculate center point
    const center = [
        (bounds[0][0] + bounds[1][0]) / 2,
        (bounds[0][1] + bounds[1][1]) / 2
    ];
    
    // Calculate appropriate zoom level
    const latDiff = bounds[1][1] - bounds[0][1];
    const lngDiff = bounds[1][0] - bounds[0][0];
    const maxDiff = Math.max(latDiff, lngDiff);
    let zoom = Math.floor(8 - Math.log2(maxDiff));
    if (currentState === 'AK') {
        zoom = 3;
    }
    
    // Update both deck.gl and maplibre views
    const newViewState = {
        longitude: center[0],
        latitude: center[1],
        zoom: zoom,
        pitch: 0,
        bearing: 0
    };
    
    deckgl.setProps({
        initialViewState: newViewState
    });
    
    console.log('jumping to:', center, zoom);
    // Update the base map
    map.jumpTo({
        center: center,
        zoom: zoom,
        pitch: 0,
        bearing: 0
    });
    
    document.getElementById('loading').style.display = 'none';
    document.getElementById('state-name').textContent = stateNames[currentState];
});

async function fetchCensusData(variables) {
    let year = '2022';
    let baseUrl = `https://api.census.gov/data/${year}/acs/acs5`;
    
    let allVariables = ['B15003_001E', ...variables];
    let url;
    
    if (currentState === 'US') {
        url = `${baseUrl}?get=NAME,${allVariables.join(',')}&for=county:*&in=state:*&key=${CENSUS_API_KEY}`;
    } else {
        url = `${baseUrl}?get=NAME,${allVariables.join(',')}&for=tract:*&in=state:${currentStateFips}&key=${CENSUS_API_KEY}`;
    }

    if (LOCAL_CACHE[url]) {
        return LOCAL_CACHE[url];
    }

    let response = await fetch(url);
    let data = await response.json();
    LOCAL_CACHE[url] = data;

    return data;
}

function getHeight(properties) {
    let tractId = properties.GEOID;
    let categoryData = tractDataMap.get(tractId);

    if (!categoryData) {
        return 0;
    }
    let totalPopulation = categoryData['B15003_001E'] || 0;
    let population_density = totalPopulation / properties.ALAND;
    
    // Scale height differently for counties vs tracts
    let heightMultiplier = currentState === 'US' ? 10000000 : 1000000;
    return currentMode === '3d' ? Math.sqrt(population_density) * heightMultiplier : 0;
}

async function loadData() {
    try {
        document.getElementById('loading').textContent = 'Loading census data...';

        let allVariables = Object.values(EDUCATION_CATEGORIES).flat();
        let censusData = await fetchCensusData(allVariables);
        let headers = censusData[0];
        
        // Update the tract/county data URL based on selection
        let geoResponse;
        if (currentState === 'US') {
            geoResponse = await fetch('https://raw.githubusercontent.com/uscensusbureau/citysdk/master/v2/GeoJSON/500k/2022/county.json');
        } else {
            geoResponse = await fetch(`https://raw.githubusercontent.com/uscensusbureau/citysdk/master/v2/GeoJSON/500k/2022/${currentStateFips}/tract.json`);
        }
        tractData = await geoResponse.json();

        // Clear existing data
        tractDataMap.clear();
        tractDensities = [];

        tractData.features.forEach(feature => {
            let geoid = feature.properties.GEOID;
            let geoRow;
            
            if (currentState === 'US') {
                // For counties, match on state+county FIPS
                geoRow = censusData.find(row => 
                    row[headers.indexOf('state')] + row[headers.indexOf('county')] === geoid.slice(-5)
                );
            } else {
                // For tracts, match on tract FIPS
                geoRow = censusData.find(row => 
                    row[headers.indexOf('tract')] === geoid.slice(-6)
                );
            }
            
            if (geoRow) {
                let categoryData = {};
                
                Object.entries(EDUCATION_CATEGORIES).forEach(([category, variables]) => {
                    let population = variables.reduce((sum, variable) => {
                        let value = parseInt(geoRow[headers.indexOf(variable)]) || 0;
                        return sum + value;
                    }, 0);
                    
                    if (population > 0) {
                        categoryData[category] = population;
                    }
                });

                categoryData['B15003_001E'] = parseInt(geoRow[headers.indexOf('B15003_001E')]) || 0;
                tractDataMap.set(geoid, categoryData);

                let totalPopulation = categoryData['B15003_001E'];
                let landArea = feature.properties['ALAND'];
                let density = totalPopulation / landArea;
                tractDensities.push(density);
            }
        });

        tractDensities.sort((a, b) => a - b);
        updateLayers();
        createLegend();

    } catch (error) {
        console.error('Error loading map data:', error);
        document.getElementById('loading').textContent = 'Error loading map data. Please try again later.';
    }
}

// Update the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', async () => {
    let INITIAL_VIEW_STATE = {
        latitude: 39.8283,  // Center of CONUS
        longitude: -98.5795,
        zoom: 3,
        pitch: 0,
        bearing: 0
    };

    map = new maplibregl.Map({  // Remove 'let' here
        container: 'map-container',
        style: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json',
        center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
        zoom: INITIAL_VIEW_STATE.zoom,
        pitch: INITIAL_VIEW_STATE.pitch,
        bearing: INITIAL_VIEW_STATE.bearing,
        interactive: false
    });

    deckgl = new deck.DeckGL({
        container: 'map-container',
        mapStyle: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json',
        initialViewState: INITIAL_VIEW_STATE,
        controller: true,
        onViewStateChange: ({viewState}) => {
            map.jumpTo({
                center: [viewState.longitude, viewState.latitude],
                zoom: viewState.zoom,
                bearing: viewState.bearing,
                pitch: viewState.pitch
            });
        }
    });

    try {
        await loadData();
        setupEventListeners();
        
        // Calculate bounds for the initial state data
        const bounds = getBoundsForState(tractData);
        
        // Calculate center point
        const center = [
            (bounds[0][0] + bounds[1][0]) / 2,
            (bounds[0][1] + bounds[1][1]) / 2
        ];
        
        // Calculate appropriate zoom level
        const latDiff = bounds[1][1] - bounds[0][1];
        const lngDiff = bounds[1][0] - bounds[0][0];
        const maxDiff = Math.max(latDiff, lngDiff);
        let zoom = Math.floor(8 - Math.log2(maxDiff));
        
        if (currentState === 'AK') {
            zoom = 3;
        }
        
        // Update both deck.gl and maplibre views
        const newViewState = {
            longitude: center[0],
            latitude: center[1],
            zoom: zoom,
            pitch: 0,
            bearing: 0
        };
        
        deckgl.setProps({
            initialViewState: newViewState
        });
        
        // Update the base map
        map.jumpTo({
            center: center,
            zoom: zoom,
            pitch: 0,
            bearing: 0
        });
        
        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error('Error in initial load:', error);
        document.getElementById('loading').textContent = 'Error loading map data. Please try again later.';
    }

    window.addEventListener('resize', () => {
        deckgl.setProps({
            width: window.innerWidth,
            height: window.innerHeight
        });
    });
});

function createLegend() {
    // Remove existing legend if it exists
    let existingLegend = document.querySelector('.map-legend');
    if (existingLegend) {
        existingLegend.remove();
    }

    let legend = document.createElement('div');
    legend.className = 'map-legend';
    
    if (currentCategory === 'most-common') {
        Object.entries(CATEGORY_COLORS).forEach(([category, color]) => {
            let item = document.createElement('div');
            item.style.cssText = 'display: flex; align-items: center; margin: 5px 0;';
            
            let colorBox = document.createElement('span');
            colorBox.style.cssText = `
                width: 10px;
                height: 10px;
                margin-right: 8px;
                background: rgb(${color.join(',')});
            `;
            
            let label = document.createElement('span');
            label.textContent = category;
            
            item.appendChild(colorBox);
            item.appendChild(label);
            legend.appendChild(item);
        });
    } else {
        // Create a gradient legend for percentage-based views
        let gradientBox = document.createElement('div');
        gradientBox.style.cssText = `
            width: 20px;
            height: 150px;
            margin-right: 10px;
            background: linear-gradient(to bottom, rgb(0,0,255), rgb(240,240,255));
        `;

        let labels = document.createElement('div');
        labels.style.cssText = `
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 150px;
        `;

        let topLabel = document.createElement('div');
        topLabel.textContent = '100%';
        let bottomLabel = document.createElement('div');
        bottomLabel.textContent = '0%';

        labels.appendChild(topLabel);
        labels.appendChild(bottomLabel);

        let container = document.createElement('div');
        container.style.cssText = 'display: flex; align-items: center;';
        container.appendChild(gradientBox);
        container.appendChild(labels);

        legend.appendChild(container);
    }

    document.body.appendChild(legend);
}

function setupEventListeners() {
    let modeSwitch = document.getElementById('mode-switch');
    let categorySelect = document.getElementById('category-select');

    modeSwitch.addEventListener('change', (e) => {
        currentMode = e.target.checked ? '3d' : 'flat';
        updateLayers();
    });
    
    categorySelect.addEventListener('change', (e) => {
        currentCategory = e.target.value;
        console.log('current is now:', currentCategory);
        updateLayers();
        createLegend();
    });
}

function updateLayers() {
    deckgl.setProps({
        layers: [
            new deck.GeoJsonLayer({
                id: 'tracts',
                data: tractData,
                stroked: true,
                filled: true,
                extruded: currentMode === '3d',
                getElevation: f => getHeight(f.properties),
                wireframe: true,
                getLineColor: [0, 0, 0, 255],
                getLineWidth: 1,
                getFillColor: d => getChoroplethColor(d.properties),
                updateTriggers: {
                    getFillColor: currentCategory
                }
            })
        ]
    });
}

function getChoroplethColor(properties) {
    let tractId = properties.GEOID;
    let categoryData = tractDataMap.get(tractId);

    if (!categoryData) {
        return [200, 200, 200, 102]; // 0.4 * 255 = 102 for base opacity
    }

    let currentCategory = document.getElementById('category-select').value;
    if (currentCategory === 'most-common') {
        let maxCategory = Object.entries(categoryData).reduce((max, [category, population]) => 
            category !== 'B15003_001E' && population > max.population ? {category, population} : max
        , {category: null, population: -1});

        let color = maxCategory.category ? CATEGORY_COLORS[maxCategory.category] : [200, 200, 200];
        return [...color, 255]; // 100% opacity
    } 
    else if (currentCategory === 'bachelors-plus') {
        let totalPopulation = categoryData['B15003_001E'];
        let bachelorsPlus = (categoryData['Bachelors Degree'] || 0) + (categoryData['Advanced Degree'] || 0);
        let percentage = bachelorsPlus / totalPopulation;
        let color = interpolatePercentageColor(percentage);
        let opacity = Math.round((0.4 + (percentage * 0.6)) * 255); // Now ranges from 0.4 to 1.0
        return [...color, opacity];
    }
    else {
        let totalPopulation = categoryData['B15003_001E'];
        let categoryPopulation = categoryData[currentCategory] || 0;
        let percentage = categoryPopulation / totalPopulation;
        let color = interpolatePercentageColor(percentage);
        let opacity = Math.round((0.4 + (percentage * 0.6)) * 255); // Now ranges from 0.4 to 1.0
        return [...color, opacity];
    }
}

function interpolatePercentageColor(percentage) {
    // Use a blue scale for percentages
    const lowColor = [240, 240, 255];  // Very light blue
    const highColor = [0, 0, 255];     // Deep blue
    
    return lowColor.map((low, i) => {
        const high = highColor[i];
        return Math.round(low + (high - low) * percentage);
    });
}

const stateNames = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
    'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
    'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
    'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
    'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
};
function getBoundsForState(geojsonData) {
    let bounds = [[Infinity, Infinity], [-Infinity, -Infinity]];
    
    geojsonData.features.forEach(feature => {
        // handle Alaska
        if (feature.properties.STATEFP === '02') {
            // pretend it ends just before the antimeridian:-179.9,-130.0,51.2,71.4
            bounds = [[-130.0, 71.4], [-179.9, 51.2]];
            return;
        }
        // Handle both Polygon and MultiPolygon types
        else if (feature.geometry.type === 'MultiPolygon') {
            // MultiPolygon: array of polygon arrays
            feature.geometry.coordinates.forEach(polygon => {
                // Get the outer ring of each polygon
                const coordinates = polygon[0];
                coordinates.forEach(coord => {
                    bounds[0][0] = Math.min(bounds[0][0], coord[0]); // min longitude
                    bounds[0][1] = Math.min(bounds[0][1], coord[1]); // min latitude
                    bounds[1][0] = Math.max(bounds[1][0], coord[0]); // max longitude
                    bounds[1][1] = Math.max(bounds[1][1], coord[1]); // max latitude
                });
            });
        } else if (feature.geometry.type === 'Polygon') {
            // Polygon: just one array of coordinates for the outer ring
            const coordinates = feature.geometry.coordinates[0];
            coordinates.forEach(coord => {
                bounds[0][0] = Math.min(bounds[0][0], coord[0]); // min longitude
                bounds[0][1] = Math.min(bounds[0][1], coord[1]); // min latitude
                bounds[1][0] = Math.max(bounds[1][0], coord[0]); // max longitude
                bounds[1][1] = Math.max(bounds[1][1], coord[1]); // max latitude
            });
        }
    });

    // Add debug logging
    console.log('Calculated bounds:', bounds);
    
    // Validate bounds
    if (bounds.some(pair => pair.some(num => !isFinite(num)))) {
        console.error('Invalid bounds detected:', bounds);
        throw new Error('Failed to calculate valid bounds');
    }

    return bounds;
}

