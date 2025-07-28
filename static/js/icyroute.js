// IcyRoute - Smart Winter Route Planning JavaScript
// Google Maps Platform Awards Submission

let map;
let directionsService;
let routeDisplays = [];
let currentRoutes = [];
let markers = [];
let weatherMarkers = [];
let routeMarkers = [];
let isSatelliteView = false;

// Enhanced risk level colors with gradients
const RISK_COLORS = {
    'minimal': '#2ecc71',
    'low': '#f39c12',
    'medium': '#e67e22',
    'high': '#e74c3c'
};

// Initialize Google Maps with winter styling
function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 6,
        center: { lat: 44.9778, lng: -93.2650 },
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
            {
                featureType: 'all',
                elementType: 'geometry.fill',
                stylers: [{ color: '#f0f8ff' }]
            },
            {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ color: '#b3d9ff' }]
            },
            {
                featureType: 'landscape',
                elementType: 'geometry',
                stylers: [{ color: '#ffffff' }]
            },
            {
                featureType: 'road.highway',
                elementType: 'geometry',
                stylers: [{ color: '#e6f3ff' }]
            }
        ]
    });

    directionsService = new google.maps.DirectionsService();
    loadDemo('Minneapolis, MN', 'Duluth, MN');
}

function loadDemo(origin, destination) {
    document.getElementById('origin').value = origin;
    document.getElementById('destination').value = destination;
    document.getElementById('experience').value = 'intermediate';
    document.getElementById('avoid_icy').checked = true;
    
    document.getElementById('routeForm').dispatchEvent(new Event('submit'));
}

// Form submission handler
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('routeForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            origin: document.getElementById('origin').value,
            destination: document.getElementById('destination').value,
            driver_experience: document.getElementById('experience').value,
            avoid_icy: document.getElementById('avoid_icy').checked
        };

        clearAllRoutes();
        document.getElementById('loading').style.display = 'block';
        document.getElementById('results').style.display = 'none';
        document.getElementById('legend').style.display = 'none';

        try {
            const response = await fetch('/api/routes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            displayResults(data);
            displayRoutesOnMap(data.routes, formData.origin, formData.destination);
        } catch (error) {
            console.error('Error:', error);
            displayError(error.message);
        } finally {
            document.getElementById('loading').style.display = 'none';
        }
    });
});

function displayResults(data) {
    const resultsDiv = document.getElementById('results');
    const routesList = document.getElementById('routesList');
    const legend = document.getElementById('legend');
    
    routesList.innerHTML = '';
    currentRoutes = data.routes;

    if (data.routes.length === 0) {
        routesList.innerHTML = '<div class="warning"><span class="warning-icon">❌</span><strong>No safe routes found</strong> for your experience level. Consider adjusting your settings or choosing expert mode.</div>';
    } else {
        data.routes.forEach((route, index) => {
            const routeCard = createEnhancedRouteCard(route, index);
            routesList.appendChild(routeCard);
        });
    }

    resultsDiv.style.display = 'block';
    legend.style.display = 'block';
}

function createEnhancedRouteCard(route, index) {
    const card = document.createElement('div');
    card.className = 'route-card';
    card.dataset.routeIndex = index;
    card.style.setProperty('--risk-color', RISK_COLORS[route.risk_level]);
    
    const riskClass = `risk-${route.risk_level}`;
    const riskIcon = getRiskIcon(route.risk_level);
    
    // Sample weather from the route
    const sampleWeather = route.weather_points[Math.floor(route.weather_points.length / 2)];
    
    card.innerHTML = `
        <div class="route-header">
            <div class="route-title">Route ${index + 1}: ${route.summary}</div>
            <div class="risk-badge ${riskClass}">${riskIcon} ${route.risk_level.toUpperCase()}</div>
        </div>
        
        <div class="route-details">
            <div class="detail-item">
                <div class="detail-label">Distance</div>
                <div class="detail-value">${route.distance}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Duration</div>
                <div class="detail-value">${route.duration}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Average Risk</div>
                <div class="detail-value">${Math.round(route.avg_ice_risk * 100)}%</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Peak Risk</div>
                <div class="detail-value">${Math.round(route.max_ice_risk * 100)}%</div>
            </div>
        </div>
        
        <div class="risk-details">
            <h4>⚠️ Risk Analysis</h4>
            <div class="risk-stats">
                <div class="risk-stat">
                    <div class="risk-stat-value">${route.high_risk_segments || 0}</div>
                    <div class="risk-stat-label">High Risk Segments</div>
                </div>
                <div class="risk-stat">
                    <div class="risk-stat-value">${Math.round((route.risk_variance || 0) * 100)}</div>
                    <div class="risk-stat-label">Risk Variation</div>
                </div>
                <div class="risk-stat">
                    <div class="risk-stat-value">${route.weather_points.length}</div>
                    <div class="risk-stat-label">Weather Points</div>
                </div>
            </div>
        </div>
        
        ${sampleWeather ? `
        <div class="weather-info">
            <h5>🌡️ Sample Weather Conditions</h5>
            <div class="weather-details">
                ${sampleWeather.weather.temp}°C, ${sampleWeather.weather.description}, 
                ${sampleWeather.weather.precipitation}mm precipitation, 
                ${sampleWeather.weather.wind_speed}km/h winds
            </div>
        </div>
        ` : ''}
        
        <div class="route-actions">
            <button class="btn-small btn-focus" onclick="focusRoute(${index})">Focus on Map</button>
            <button class="btn-small btn-hide" onclick="toggleRoute(${index})">Toggle Route</button>
        </div>
    `;
    
    card.addEventListener('click', function(e) {
        if (!e.target.classList.contains('btn-small')) {
            selectRoute(index);
        }
    });
    
    return card;
}

function displayRoutesOnMap(routes, origin, destination) {
    clearAllRoutes();
    addLocationMarkers(origin, destination);

    // Process routes sequentially to ensure proper marker placement
    processRoutesSequentially(routes, origin, destination, 0);
}

function processRoutesSequentially(routes, origin, destination, routeIndex) {
    if (routeIndex >= routes.length) {
        // All routes processed, now fit map
        setTimeout(fitMapToRoutes, 1000);
        return;
    }

    const route = routes[routeIndex];
    
    // Get directions for this specific route
    const routeOptions = getRouteOptions(route, routeIndex);
    
    directionsService.route({
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
        ...routeOptions
    }, (response, status) => {
        if (status === 'OK') {
            // Use the best matching route from Google's response
            const googleRouteIndex = Math.min(routeIndex, response.routes.length - 1);
            createRouteRenderer(route, routeIndex, response, googleRouteIndex);
            
            // Add markers based on the actual Google route path
            addMarkersAlongRoute(route, routeIndex, response.routes[googleRouteIndex]);
        } else {
            console.error(`Route ${routeIndex} failed:`, status);
        }
        
        // Process next route
        processRoutesSequentially(routes, origin, destination, routeIndex + 1);
    });
}

function createRouteRenderer(route, index, googleResponse, googleRouteIndex) {
    const color = RISK_COLORS[route.risk_level];
    const strokeWeight = getStrokeWeight(route, index);
    const strokePattern = getStrokePattern(route, index);
    
    const directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        polylineOptions: {
            strokeColor: color,
            strokeWeight: strokeWeight,
            strokeOpacity: 0.9,
            zIndex: 1000 - index,
            ...strokePattern
        },
        suppressMarkers: true,
        preserveViewport: true
    });

    try {
        directionsRenderer.setDirections(googleResponse);
        directionsRenderer.setRouteIndex(googleRouteIndex);
    } catch (error) {
        console.warn(`Error setting route ${index}:`, error);
        return;
    }
    
    routeDisplays.push({
        renderer: directionsRenderer,
        visible: true,
        route: route,
        index: index,
        googleRoute: googleResponse.routes[googleRouteIndex]
    });
}

// FIXED: New function to add markers along the actual Google route path
function addMarkersAlongRoute(route, routeIndex, googleRoute) {
    if (!googleRoute || !route.weather_points) return;
    
    const routePath = [];
    
    // Extract all points from the Google route
    googleRoute.legs.forEach(leg => {
        leg.steps.forEach(step => {
            if (step.path) {
                routePath.push(...step.path);
            } else {
                // Fallback: use start and end points
                routePath.push(step.start_location);
                routePath.push(step.end_location);
            }
        });
    });

    // Add route identifier marker at midpoint
    if (routePath.length > 0) {
        const midIndex = Math.floor(routePath.length / 2);
        const midPoint = routePath[midIndex];
        addRouteIdentifierMarker(route, routeIndex, midPoint);
    }

    // Add weather markers along the route path
    addWeatherMarkersOnRoute(route, routeIndex, routePath);
}

function addRouteIdentifierMarker(route, routeIndex, position) {
    const markerColors = ['green', 'blue', 'purple', 'orange', 'yellow'];
    const markerColor = markerColors[routeIndex % markerColors.length];
    
    const routeMarker = new google.maps.Marker({
        position: position,
        map: map,
        title: `Route ${routeIndex + 1}: ${route.summary}`,
        icon: {
            url: `https://maps.google.com/mapfiles/ms/icons/${markerColor}-dot.png`,
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 32)
        },
        zIndex: 100 + routeIndex
    });

    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div style="padding: 8px; max-width: 250px;">
                <h4 style="margin: 0 0 8px 0; color: ${RISK_COLORS[route.risk_level]};">
                    Route ${routeIndex + 1}: ${route.summary}
                </h4>
                <p style="margin: 0; font-size: 13px;">
                    <strong>Distance:</strong> ${route.distance}<br>
                    <strong>Duration:</strong> ${route.duration}<br>
                    <strong>Ice Risk:</strong> ${Math.round(route.avg_ice_risk * 100)}%<br>
                    <strong>Route Type:</strong> ${route.route_type || 'Mixed'}
                </p>
                <div style="margin-top: 8px; padding: 4px 8px; background: ${getRiskBackgroundColor(route.risk_level)}; border-radius: 4px; text-align: center;">
                    <small style="font-weight: bold;">${route.risk_level.toUpperCase()} RISK</small>
                </div>
            </div>
        `
    });

    routeMarker.addListener('click', () => {
        // Close any open info windows
        routeMarkers.forEach(m => {
            if (m.infoWindow) m.infoWindow.close();
        });
        infoWindow.open(map, routeMarker);
    });

    routeMarker.infoWindow = infoWindow;
    routeMarker.routeIndex = routeIndex;
    routeMarkers.push(routeMarker);
    markers.push(routeMarker);
}

// FIXED: New function to place weather markers along the actual route path
function addWeatherMarkersOnRoute(route, routeIndex, routePath) {
    if (!route.weather_points || routePath.length === 0) return;
    
    // Filter high-risk weather points
    const highRiskPoints = route.weather_points.filter(point => point.ice_risk > 0.6);
    
    // Limit to 3 weather markers per route to avoid clutter
    const selectedPoints = highRiskPoints.slice(0, 3);
    
    selectedPoints.forEach((weatherPoint, index) => {
        // Find the closest point on the actual route path
        let closestRoutePoint = routePath[0];
        let minDistance = Number.MAX_VALUE;
        
        routePath.forEach(routePoint => {
            const distance = calculateDistance(
                weatherPoint.location.lat, weatherPoint.location.lng,
                routePoint.lat(), routePoint.lng()
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestRoutePoint = routePoint;
            }
        });
        
        // Only place marker if it's reasonably close to the route (within 5km)
        if (minDistance < 5000) {
            const weatherMarker = new google.maps.Marker({
                position: {
                    lat: closestRoutePoint.lat(),
                    lng: closestRoutePoint.lng()
                },
                map: map,
                title: `Weather Alert: ${weatherPoint.weather.description}`,
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
                            <circle cx="14" cy="14" r="12" fill="#e74c3c" stroke="white" stroke-width="2"/>
                            <text x="14" y="18" text-anchor="middle" fill="white" font-size="14" font-weight="bold">⚠</text>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(28, 28),
                    anchor: new google.maps.Point(14, 14)
                },
                zIndex: 200 + routeIndex
            });

            const weatherInfoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 10px; max-width: 220px;">
                        <h4 style="margin: 0 0 8px 0; color: #e74c3c;">⚠️ Icy Road Alert</h4>
                        <p style="margin: 0; font-size: 13px;">
                            <strong>Conditions:</strong> ${weatherPoint.weather.description}<br>
                            <strong>Temperature:</strong> ${weatherPoint.weather.temp}°C<br>
                            <strong>Ice Risk:</strong> ${Math.round(weatherPoint.ice_risk * 100)}%<br>
                            <strong>Precipitation:</strong> ${weatherPoint.weather.precipitation}mm<br>
                            <strong>Wind:</strong> ${weatherPoint.weather.wind_speed} km/h
                        </p>
                        <div style="margin-top: 6px; font-size: 11px; color: #666;">
                            Route ${routeIndex + 1} - High Risk Area
                        </div>
                    </div>
                `
            });

            weatherMarker.addListener('click', () => {
                // Close other weather info windows
                weatherMarkers.forEach(m => {
                    if (m.weatherInfoWindow) m.weatherInfoWindow.close();
                });
                weatherInfoWindow.open(map, weatherMarker);
            });

            weatherMarker.weatherInfoWindow = weatherInfoWindow;
            weatherMarker.routeIndex = routeIndex;
            weatherMarkers.push(weatherMarker);
            markers.push(weatherMarker);
        }
    });
}

// Helper function to calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function getRouteOptions(route, index) {
    // Create different routing options based on route type and index
    const options = {};
    
    if (route.route_type === 'highway' || route.summary.includes('Highway')) {
        options.avoidTolls = false;
        options.avoidHighways = false;
    } else if (route.route_type === 'local' || route.summary.includes('Local')) {
        options.avoidHighways = true;
        options.avoidTolls = true;
    } else {
        // Alternate between different options for variation
        if (index % 2 === 0) {
            options.avoidTolls = true;
        } else {
            options.avoidHighways = false;
        }
    }
    
    return options;
}

function getStrokeWeight(route, index) {
    // Vary stroke weight by risk level and route index
    let baseWeight = route.risk_level === 'high' ? 8 : 
                   route.risk_level === 'medium' ? 7 : 
                   route.risk_level === 'low' ? 6 : 5;
    
    // Add variation based on index to make routes more distinguishable
    return baseWeight + (index % 3);
}

function getStrokePattern(route, index) {
    // Create different stroke patterns for visual distinction
    const patterns = {
        0: {}, // Solid line
        1: { strokeOpacity: 0.8 }, // Slightly transparent
        2: { strokeOpacity: 0.9 }, // Different transparency
        3: { strokeOpacity: 0.7 }, // More transparent
        4: { strokeOpacity: 0.85 }  // Another variation
    };
    
    return patterns[index % 5] || {};
}

function addLocationMarkers(origin, destination) {
    const geocoder = new google.maps.Geocoder();
    
    // Enhanced start marker
    geocoder.geocode({ address: origin }, (results, status) => {
        if (status === 'OK') {
            const startMarker = new google.maps.Marker({
                position: results[0].geometry.location,
                map: map,
                title: 'Start: ' + origin,
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
                            <path d="M20 0C9 0 0 9 0 20c0 15 20 30 20 30s20-15 20-30C40 9 31 0 20 0z" fill="#27ae60"/>
                            <circle cx="20" cy="20" r="8" fill="white"/>
                            <text x="20" y="25" text-anchor="middle" fill="#27ae60" font-size="12" font-weight="bold">S</text>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(40, 50),
                    anchor: new google.maps.Point(20, 50)
                },
                zIndex: 1000
            });

            const startInfoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 8px;">
                        <h4 style="margin: 0 0 4px 0; color: #27ae60;">🚀 Start Location</h4>
                        <p style="margin: 0; font-size: 14px;">${origin}</p>
                    </div>
                `
            });

            startMarker.addListener('click', () => {
                startInfoWindow.open(map, startMarker);
            });

            markers.push(startMarker);
        }
    });

    // Enhanced destination marker
    geocoder.geocode({ address: destination }, (results, status) => {
        if (status === 'OK') {
            const endMarker = new google.maps.Marker({
                position: results[0].geometry.location,
                map: map,
                title: 'Destination: ' + destination,
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
                            <path d="M20 0C9 0 0 9 0 20c0 15 20 30 20 30s20-15 20-30C40 9 31 0 20 0z" fill="#e74c3c"/>
                            <circle cx="20" cy="20" r="8" fill="white"/>
                            <text x="20" y="25" text-anchor="middle" fill="#e74c3c" font-size="12" font-weight="bold">E</text>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(40, 50),
                    anchor: new google.maps.Point(20, 50)
                },
                zIndex: 1000
            });

            const endInfoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 8px;">
                        <h4 style="margin: 0 0 4px 0; color: #e74c3c;">🎯 Destination</h4>
                        <p style="margin: 0; font-size: 14px;">${destination}</p>
                    </div>
                `
            });

            endMarker.addListener('click', () => {
                endInfoWindow.open(map, endMarker);
            });

            markers.push(endMarker);
        }
    });
}

function getRiskBackgroundColor(riskLevel) {
    const colors = {
        'minimal': '#d4edda',
        'low': '#fff3cd',
        'medium': '#f8d7da',
        'high': '#f5c6cb'
    };
    return colors[riskLevel] || '#f8f9fa';
}

function selectRoute(index) {
    // Remove selection from all cards
    document.querySelectorAll('.route-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Add selection to the clicked card
    const selectedCard = document.querySelector(`[data-route-index="${index}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Focus on ONLY this route
    focusRoute(index);
}

function focusRoute(index) {
    console.log(`Focusing on route ${index + 1}`);
    
    // Hide ALL other routes first
    routeDisplays.forEach((display, i) => {
        if (display.renderer) {
            if (i !== index) {
                display.renderer.setMap(null);
                display.visible = false;
            }
        }
    });

    // Ensure the selected route is visible and highlighted
    const selectedDisplay = routeDisplays[index];
    if (selectedDisplay && selectedDisplay.renderer) {
        // Make sure it's visible
        selectedDisplay.renderer.setMap(map);
        selectedDisplay.visible = true;
        
        // Enhance the focused route appearance
        const route = selectedDisplay.route;
        const color = RISK_COLORS[route.risk_level];
        
        selectedDisplay.renderer.setOptions({
            polylineOptions: {
                strokeColor: color,
                strokeWeight: 12,
                strokeOpacity: 1.0,
                zIndex: 2000
            }
        });

        console.log(`Route ${index + 1} is now visible and highlighted`);
    }

    // Show ONLY markers for the selected route (plus start/end)
    markers.forEach(marker => {
        if (marker.title && (marker.title.includes('Start:') || marker.title.includes('Destination:'))) {
            // Always show start/end markers
            marker.setVisible(true);
        } else if (marker.hasOwnProperty('routeIndex')) {
            // Show only markers for the selected route
            marker.setVisible(marker.routeIndex === index);
        } else {
            // Hide other markers
            marker.setVisible(false);
        }
    });

    updateCardVisibility();

    // Fit map to the focused route
    setTimeout(() => {
        fitMapToSingleRoute(selectedDisplay.renderer);
    }, 100);
}


function toggleSatellite() {
    if (isSatelliteView) {
        map.setMapTypeId('roadmap');
        isSatelliteView = false;
    } else {
        map.setMapTypeId('satellite');
        isSatelliteView = true;
    }
}

function updateCardVisibility() {
    routeDisplays.forEach((display, index) => {
        const card = document.querySelector(`[data-route-index="${index}"]`);
        if (card) {
            if (display.visible) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        }
    });
}

function fitMapToRoutes() {
    const visibleDisplays = routeDisplays.filter(d => d.visible && d.renderer);
    
    if (visibleDisplays.length === 0) {
        console.warn('No visible routes to fit map to');
        return;
    }

    const bounds = new google.maps.LatLngBounds();
    let boundsExtended = false;

    visibleDisplays.forEach(display => {
        try {
            if (display.renderer.getDirections()) {
                const route = display.renderer.getDirections().routes[0];
                route.legs.forEach(leg => {
                    leg.steps.forEach(step => {
                        bounds.extend(step.start_location);
                        bounds.extend(step.end_location);
                        boundsExtended = true;
                    });
                });
            }
        } catch (error) {
            console.warn('Error accessing route directions:', error);
        }
    });

    if (boundsExtended) {
        map.fitBounds(bounds);
        
        google.maps.event.addListenerOnce(map, 'bounds_changed', function() {
            const zoom = map.getZoom();
            if (zoom > 13) {
                map.setZoom(13);
            }
            if (zoom < 6) {
                map.setZoom(6);
            }
        });
    } else {
        console.warn('Could not extend bounds for any routes');
    }
}

function clearAllRoutes() {
    routeDisplays.forEach(display => {
        if (display.renderer) {
            display.renderer.setMap(null);
        }
    });
    routeDisplays = [];

    markers.forEach(marker => {
        if (marker.infoWindow) {
            marker.infoWindow.close();
        }
        if (marker.weatherInfoWindow) {
            marker.weatherInfoWindow.close();
        }
        marker.setMap(null);
    });
    markers = [];
    weatherMarkers = [];
    routeMarkers = [];
}

function getRiskIcon(riskLevel) {
    switch(riskLevel) {
        case 'minimal': return '✅';
        case 'low': return '⚡';
        case 'medium': return '🔶';
        case 'high': return '🚨';
        default: return '❓';
    }
}

function displayError(message) {
    const routesList = document.getElementById('routesList');
    routesList.innerHTML = `
        <div class="warning">
            <span class="warning-icon">❌</span>
            <strong>Error:</strong> ${message}
            <br><br>
            <small>Please check your internet connection and ensure the addresses are valid.</small>
        </div>
    `;
    document.getElementById('results').style.display = 'block';
}


function calculateRiskLevel(avgRisk, maxRisk) {
    // Ensure we're working with percentages (0-100)
    const avgRiskPercent = typeof avgRisk === 'number' ? avgRisk : Math.round(avgRisk * 100);
    const maxRiskPercent = typeof maxRisk === 'number' ? maxRisk : Math.round(maxRisk * 100);
    
    // Use AVERAGE risk for classification (not max) - this matches typical route planning
    const primaryRisk = avgRiskPercent;
    
    console.log('Risk calculation:', { avgRiskPercent, maxRiskPercent, primaryRisk });
    
    if (primaryRisk >= 75) return 'high';
    if (primaryRisk >= 50) return 'medium';
    if (primaryRisk >= 25) return 'low';
    return 'minimal';
}

// 2. FIXED: Updated compareRoutes function with forced consistency
function compareRoutes() {
    console.log('compareRoutes() called');
    
    if (!currentRoutes || currentRoutes.length < 2) {
        console.warn('Need at least 2 routes to compare. Current routes:', currentRoutes?.length || 0);
        alert('Please generate at least 2 routes before comparing.');
        return;
    }

    const comparison = currentRoutes.map((route, index) => {
        // Ensure risk values are between 0 and 100
        const avgRisk = Math.max(0, Math.min(100, Math.round((route.avg_ice_risk || 0) * 100)));
        const maxRisk = Math.max(0, Math.min(100, Math.round((route.max_ice_risk || 0) * 100)));
        
        // ALWAYS use calculated risk level for consistency
        const calculatedRiskLevel = calculateRiskLevel(avgRisk, maxRisk);
        
        // Force update the route object with calculated risk level
        route.risk_level = calculatedRiskLevel;
        route.display_risk_level = calculatedRiskLevel;
        
        console.log(`Route ${index + 1} risk calculation:`, {
            avgRisk,
            maxRisk,
            calculatedLevel: calculatedRiskLevel,
            backendLevel: route.original_risk_level || route.risk_level
        });
        
        return {
            index: index + 1,
            name: route.summary || `Route ${index + 1}`,
            distance: route.distance || 'N/A',
            duration: route.duration || 'N/A',
            risk: avgRisk,
            type: route.route_type || 'mixed',
            maxRisk: maxRisk,
            riskLevel: calculatedRiskLevel, // Always use calculated
            rawDistance: route.raw_distance || 'N/A',
            rawDuration: route.raw_duration || 'N/A'
        };
    });

    console.log('Route comparison data with FORCED consistency:', comparison);
    console.table(comparison);
    showRouteComparison(comparison);
}

// 3. FIXED: Updated createEnhancedRouteCard to match comparison
function createEnhancedRouteCard(route, index) {
    const card = document.createElement('div');
    card.className = 'route-card';
    
    // Calculate consistent risk values
    const avgRisk = Math.max(0, Math.min(100, Math.round((route.avg_ice_risk || 0) * 100)));
    const maxRisk = Math.max(0, Math.min(100, Math.round((route.max_ice_risk || 0) * 100)));
    
    // ALWAYS use calculated risk level
    const calculatedRiskLevel = calculateRiskLevel(avgRisk, maxRisk);
    
    // Store original backend risk level for debugging
    if (!route.original_risk_level) {
        route.original_risk_level = route.risk_level;
    }
    
    // Force the route to use calculated risk level
    route.risk_level = calculatedRiskLevel;
    route.display_risk_level = calculatedRiskLevel;
    
    card.dataset.routeIndex = index;
    card.style.setProperty('--risk-color', RISK_COLORS[calculatedRiskLevel]);
    
    const riskClass = `risk-${calculatedRiskLevel}`;
    const riskIcon = getRiskIcon(calculatedRiskLevel);
    
    // Use actual Google Maps data if available, otherwise use backend data
    const displayDistance = route.actual_distance || route.distance;
    const displayDuration = route.traffic_duration || route.actual_duration || route.duration;
    
    // Sample weather from the route
    const sampleWeather = route.weather_points && route.weather_points.length > 0 ? 
                         route.weather_points[Math.floor(route.weather_points.length / 2)] : null;
    
    console.log(`Route ${index + 1} card risk level FORCED to:`, calculatedRiskLevel);
    
    card.innerHTML = `
        <div class="route-header">
            <div class="route-title">Route ${index + 1}: ${route.summary}</div>
            <div class="risk-badge ${riskClass}">${riskIcon} ${calculatedRiskLevel.toUpperCase()}</div>
        </div>
        
        <div class="route-details">
            <div class="detail-item">
                <div class="detail-label">Distance</div>
                <div class="detail-value">${displayDistance}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">${route.traffic_duration ? 'Time (w/ Traffic)' : 'Duration'}</div>
                <div class="detail-value">${displayDuration}</div>
            </div>
            ${route.traffic_delay ? `
            <div class="detail-item">
                <div class="detail-label">Traffic Impact</div>
                <div class="detail-value" style="color: ${route.traffic_delay === 'No delay' ? '#2ecc71' : '#e67e22'};">
                    ${route.traffic_impact || route.traffic_delay}
                </div>
            </div>
            ` : ''}
            <div class="detail-item">
                <div class="detail-label">Average Risk</div>
                <div class="detail-value" style="color: ${getRiskColor(avgRisk)};">${avgRisk}%</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Peak Risk</div>
                <div class="detail-value" style="color: ${getRiskColor(maxRisk)};">${maxRisk}%</div>
            </div>
        </div>
        
        <div class="risk-details">
            <h4>⚠️ Risk Analysis</h4>
            <div class="risk-stats">
                <div class="risk-stat">
                    <div class="risk-stat-value">${route.high_risk_segments || 0}</div>
                    <div class="risk-stat-label">High Risk Segments</div>
                </div>
                <div class="risk-stat">
                    <div class="risk-stat-value">${Math.round((route.risk_variance || 0) * 100)}</div>
                    <div class="risk-stat-label">Risk Variation</div>
                </div>
                <div class="risk-stat">
                    <div class="risk-stat-value">${route.weather_points ? route.weather_points.length : 0}</div>
                    <div class="risk-stat-label">Weather Points</div>
                </div>
            </div>
            <div style="font-size: 10px; color: #666; margin-top: 4px;">
                Risk Level: ${calculatedRiskLevel.toUpperCase()} (based on ${avgRisk}% avg risk)
                ${route.original_risk_level && route.original_risk_level !== calculatedRiskLevel ? 
                  `<br>Backend sent: ${route.original_risk_level}` : ''}
            </div>
        </div>
        
        ${sampleWeather ? `
        <div class="weather-info">
            <h5>🌡️ Sample Weather Conditions</h5>
            <div class="weather-details">
                ${sampleWeather.weather.temp}°C, ${sampleWeather.weather.description}, 
                ${sampleWeather.weather.precipitation}mm precipitation, 
                ${sampleWeather.weather.wind_speed}km/h winds
            </div>
        </div>
        ` : ''}
        
        <div class="route-actions">
            <button class="btn-small btn-focus" onclick="focusRoute(${index})">Focus on Map</button>
            <button class="btn-small btn-hide" onclick="toggleRoute(${index})">Toggle Route</button>
        </div>
    `;
    
    card.addEventListener('click', function(e) {
        if (!e.target.classList.contains('btn-small')) {
            selectRoute(index);
        }
    });
    
    return card;
}

// 4. FIXED: Updated comparison table with forced consistency
function showRouteComparison(comparison) {
    console.log('showRouteComparison() called with:', comparison);
    
    // Remove existing comparison if it exists
    const existingComparison = document.getElementById('route-comparison');
    if (existingComparison) {
        existingComparison.remove();
    }

    // FORCE recalculation for all routes to ensure 100% consistency
    const enhancedComparison = comparison.map(route => {
        const routeData = currentRoutes[route.index - 1];
        
        // Recalculate everything from scratch
        const avgRisk = Math.max(0, Math.min(100, Math.round((routeData.avg_ice_risk || 0) * 100)));
        const maxRisk = Math.max(0, Math.min(100, Math.round((routeData.max_ice_risk || 0) * 100)));
        const forcedRiskLevel = calculateRiskLevel(avgRisk, maxRisk);
        
        // Update the actual route object
        routeData.risk_level = forcedRiskLevel;
        
        console.log(`Comparison row ${route.index}: FORCED to ${forcedRiskLevel} (avg: ${avgRisk}%)`);
        
        return {
            ...route,
            distance: routeData.actual_distance || route.distance,
            duration: routeData.traffic_duration || routeData.actual_duration || route.duration,
            trafficImpact: routeData.traffic_impact || 'Normal',
            trafficDelay: routeData.traffic_delay || 'No delay',
            riskLevel: forcedRiskLevel, // FORCED consistency
            risk: avgRisk,
            maxRisk: maxRisk
        };
    });

    const comparisonHTML = `
        <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0; border: 2px solid #3498db; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4 style="margin: 0 0 10px 0; color: #3498db;">📊 Route Comparison (Forced Risk Consistency)</h4>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 6px; border: 1px solid #ddd; text-align: left;">Route</th>
                        <th style="padding: 6px; border: 1px solid #ddd; text-align: left;">Distance</th>
                        <th style="padding: 6px; border: 1px solid #ddd; text-align: left;">Time</th>
                        <th style="padding: 6px; border: 1px solid #ddd; text-align: left;">Traffic</th>
                        <th style="padding: 6px; border: 1px solid #ddd; text-align: left;">Ice Risk</th>
                        <th style="padding: 6px; border: 1px solid #ddd; text-align: left;">Safety Level</th>
                    </tr>
                </thead>
                <tbody>
                    ${enhancedComparison.map(route => `
                        <tr style="cursor: pointer;" onclick="focusRoute(${route.index - 1})" title="Click to focus on this route">
                            <td style="padding: 6px; border: 1px solid #ddd;"><strong>${route.name}</strong></td>
                            <td style="padding: 6px; border: 1px solid #ddd;">${route.distance}</td>
                            <td style="padding: 6px; border: 1px solid #ddd;">${route.duration}</td>
                            <td style="padding: 6px; border: 1px solid #ddd; color: ${route.trafficDelay === 'No delay' ? '#2ecc71' : '#e67e22'};">
                                ${route.trafficImpact}
                            </td>
                            <td style="padding: 6px; border: 1px solid #ddd; color: ${getRiskColor(route.risk)};">
                                <strong>${route.risk}% avg</strong><br>
                                <small style="color: ${getRiskColor(route.maxRisk)};">${route.maxRisk}% max</small>
                            </td>
                            <td style="padding: 6px; border: 1px solid #ddd;">
                                <span style="background: ${RISK_COLORS[route.riskLevel] || '#gray'}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">
                                    ${route.riskLevel.toUpperCase()}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="margin-top: 8px; font-size: 11px; color: #666;">
                🚦 Real-time traffic • ❄️ Risk based on AVERAGE ice risk • 💡 Click rows to focus routes
            </div>
            <div style="margin-top: 4px; font-size: 10px; color: #999;">
                Risk levels: 0-24% = Minimal, 25-49% = Low, 50-74% = Medium, 75%+ = High (based on average risk)
            </div>
            <button onclick="document.getElementById('route-comparison').remove()" 
                    style="margin-top: 8px; padding: 4px 8px; background: #e74c3c; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
                Close Comparison
            </button>
        </div>
    `;

    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        const comparisonDiv = document.createElement('div');
        comparisonDiv.id = 'route-comparison';
        comparisonDiv.innerHTML = comparisonHTML;
        
        const routesList = document.getElementById('routesList');
        if (routesList) {
            resultsDiv.insertBefore(comparisonDiv, routesList);
            console.log('Route comparison table added with FORCED consistency');
        } else {
            resultsDiv.appendChild(comparisonDiv);
        }
        
        comparisonDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // FORCE refresh the route cards to match
        setTimeout(() => {
            refreshRouteCards();
        }, 100);
    } else {
        console.error('Results div not found');
        alert('Error: Could not display route comparison table');
    }
}

// 5. NEW: Force refresh route cards to match comparison
function refreshRouteCards() {
    const routesList = document.getElementById('routesList');
    if (routesList) {
        routesList.innerHTML = '';
        currentRoutes.forEach((route, index) => {
            const routeCard = createEnhancedRouteCard(route, index);
            routesList.appendChild(routeCard);
        });
        console.log('Route cards refreshed with consistent risk levels');
    }
}

// 6. FIXED: Debug function that forces consistency
function debugRiskLevels() {
    console.log('=== RISK LEVEL CONSISTENCY CHECK ===');
    
    currentRoutes.forEach((route, index) => {
        const avgRisk = Math.round((route.avg_ice_risk || 0) * 100);
        const maxRisk = Math.round((route.max_ice_risk || 0) * 100);
        const calculatedLevel = calculateRiskLevel(avgRisk, maxRisk);
        
        console.log(`Route ${index + 1}:`, {
            summary: route.summary,
            originalBackendLevel: route.original_risk_level || route.risk_level,
            currentLevel: route.risk_level,
            calculatedLevel: calculatedLevel,
            avgRisk: avgRisk,
            maxRisk: maxRisk,
            shouldBe: calculatedLevel
        });
        
        // Force update
        route.risk_level = calculatedLevel;
    });
    
    // Refresh displays
    refreshRouteCards();
    
    return currentRoutes;
}


// Helper function to get risk color
function getRiskColor(riskPercentage) {
    if (riskPercentage >= 75) return '#e74c3c';      // High risk - red
    if (riskPercentage >= 50) return '#e67e22';      // Medium risk - orange  
    if (riskPercentage >= 25) return '#f39c12';      // Low risk - yellow
    return '#2ecc71';                                 // Minimal risk - green
}

// Add this to make the compare button more visible - modify your window.onload function:
window.onload = function() {
    console.log('🚗 IcyRoute - Google Maps Platform Awards Demo Ready');
    console.log('🔧 FIXED: Marker positioning and route alignment');
    console.log('Features: Enhanced route visualization, weather markers, route comparison');
    
    // Add route comparison button to map controls
    const mapControls = document.querySelector('.map-controls');
    if (mapControls && !document.getElementById('compare-btn')) {
        const compareBtn = document.createElement('button');
        compareBtn.id = 'compare-btn';
        compareBtn.className = 'control-btn';
        compareBtn.textContent = '📊 Compare Routes';
        compareBtn.style.cssText = 'background: #3498db; color: white; padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer; margin: 5px;';
        compareBtn.onclick = compareRoutes;
        mapControls.appendChild(compareBtn);
        console.log('Compare routes button added');
    }
    
    // Alternative: Add compare button to the results area
    setTimeout(() => {
        const resultsDiv = document.getElementById('results');
        if (resultsDiv && !document.getElementById('compare-btn-alt')) {
            const altCompareBtn = document.createElement('button');
            altCompareBtn.id = 'compare-btn-alt';
            altCompareBtn.textContent = '📊 Compare All Routes';
            altCompareBtn.style.cssText = 'background: #3498db; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; margin: 10px 0; width: 100%; font-weight: bold;';
            altCompareBtn.onclick = compareRoutes;
            
            const routesList = document.getElementById('routesList');
            if (routesList) {
                resultsDiv.insertBefore(altCompareBtn, routesList);
            }
        }
    }, 1000);
};

function showAllRoutes() {
    console.log('Showing all routes');
    let visibleCount = 0;
    
    routeDisplays.forEach((display, index) => {
        if (display.renderer) {
            display.renderer.setMap(map);
            display.visible = true;
            visibleCount++;
            
            // Reset to normal styling with variation
            const route = display.route;
            const color = RISK_COLORS[route.risk_level];
            const strokeWeight = getStrokeWeight(route, index);
            const strokePattern = getStrokePattern(route, index);
            
            display.renderer.setOptions({
                polylineOptions: {
                    strokeColor: color,
                    strokeWeight: strokeWeight,
                    strokeOpacity: 0.9,
                    zIndex: 1000 - index,
                    ...strokePattern
                }
            });
        }
    });

    // Show ALL markers
    markers.forEach(marker => {
        marker.setVisible(true);
    });

    updateCardVisibility();
    
    if (visibleCount > 0) {
        setTimeout(fitMapToRoutes, 200);
    }
    
    console.log(`Showing ${visibleCount} routes with all markers visible`);
}


function ensureRouteVisible(index) {
    const display = routeDisplays[index];
    if (display && display.renderer && !display.visible) {
        console.log(`Making route ${index + 1} visible`);
        
        // Show the route renderer
        display.renderer.setMap(map);
        display.visible = true;
        
        // Apply proper styling
        const route = display.route;
        const color = RISK_COLORS[route.risk_level];
        
        display.renderer.setOptions({
            polylineOptions: {
                strokeColor: color,
                strokeWeight: 12,
                strokeOpacity: 1.0,
                zIndex: 2000
            }
        });
    }
}

function hideAllRoutes() {
    console.log('Hiding all routes');
    
    // Hide all route renderers
    routeDisplays.forEach(display => {
        if (display.renderer) {
            display.renderer.setMap(null);
            display.visible = false;
        }
    });

    // Hide route-specific markers but keep start/end markers visible
    markers.forEach(marker => {
        if (marker.title && (marker.title.includes('Start:') || marker.title.includes('Destination:'))) {
            // Keep start/end markers visible
            marker.setVisible(true);
        } else if (marker.hasOwnProperty('routeIndex')) {
            // Hide route-specific markers
            marker.setVisible(false);
        } else {
            // Hide other markers too
            marker.setVisible(false);
        }
    });

    updateCardVisibility();
    console.log('All routes hidden, start/end markers remain visible');
}


function toggleRoute(index) {
    const display = routeDisplays[index];
    if (!display || !display.renderer) {
        console.warn(`Route ${index} not found or not properly initialized`);
        return;
    }

    if (display.visible) {
        display.renderer.setMap(null);
        display.visible = false;
    } else {
        display.renderer.setMap(map);
        display.visible = true;
        
        // Apply proper styling when showing
        const route = display.route;
        const color = RISK_COLORS[route.risk_level];
        const strokeWeight = getStrokeWeight(route, index);
        const strokePattern = getStrokePattern(route, index);
        
        display.renderer.setOptions({
            polylineOptions: {
                strokeColor: color,
                strokeWeight: strokeWeight,
                strokeOpacity: 0.9,
                zIndex: 1000 - index,
                ...strokePattern
            }
        });
    }

    // Update route marker visibility
    markers.forEach(marker => {
        if (marker.hasOwnProperty('routeIndex') && marker.routeIndex === index) {
            marker.setVisible(display.visible);
        }
    });

    updateCardVisibility();
}

// Initialize demo on page load
window.onload = function() {
    console.log('🚗 IcyRoute - Google Maps Platform Awards Demo Ready');
    console.log('🔧 FIXED: Marker positioning and route alignment');
    console.log('Features: Enhanced route visualization, weather markers, route comparison');
    
    // Add route comparison button to map controls
    const mapControls = document.querySelector('.map-controls');
    if (mapControls && !document.getElementById('compare-btn')) {
        const compareBtn = document.createElement('button');
        compareBtn.id = 'compare-btn';
        compareBtn.className = 'control-btn';
        compareBtn.textContent = 'Compare Routes';
        compareBtn.onclick = compareRoutes;
        mapControls.appendChild(compareBtn);
    }
};

// Add keyboard shortcuts for demo
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case '1':
                e.preventDefault();
                loadDemo('Minneapolis, MN', 'Duluth, MN');
                break;
            case '2':
                e.preventDefault();
                loadDemo('Buffalo, NY', 'Syracuse, NY');
                break;
            case '3':
                e.preventDefault();
                loadDemo('Detroit, MI', 'Grand Rapids, MI');
                break;
            case 'a':
                e.preventDefault();
                showAllRoutes();
                break;
            case 'h':
                e.preventDefault();
                hideAllRoutes();
                break;
        }
    }
});

// Enhanced route debugging function
function debugRoutes() {
    console.log('=== ROUTE DEBUG INFO ===');
    console.log(`Total routes: ${routeDisplays.length}`);
    console.log(`Visible routes: ${routeDisplays.filter(d => d.visible).length}`);
    console.log(`Total markers: ${markers.length}`);
    console.log(`Weather markers: ${weatherMarkers.length}`);
    console.log(`Route markers: ${routeMarkers.length}`);
    
    routeDisplays.forEach((display, index) => {
        console.log(`Route ${index}:`, {
            visible: display.visible,
            hasRenderer: !!display.renderer,
            hasDirections: !!(display.renderer && display.renderer.getDirections()),
            summary: display.route.summary,
            riskLevel: display.route.risk_level,
            weatherPoints: display.route.weather_points?.length || 0
        });
    });
    
    console.log('Marker distribution:');
    const markersByType = {
        start: 0,
        destination: 0,
        route: 0,
        weather: 0,
        other: 0
    };
    
    markers.forEach(marker => {
        if (marker.title) {
            if (marker.title.includes('Start:')) markersByType.start++;
            else if (marker.title.includes('Destination:')) markersByType.destination++;
            else if (marker.title.includes('Route')) markersByType.route++;
            else if (marker.title.includes('Weather Alert')) markersByType.weather++;
            else markersByType.other++;
        } else {
            markersByType.other++;
        }
    });
    
    console.table(markersByType);
    
    return {
        routeDisplays,
        markers,
        weatherMarkers,
        routeMarkers,
        markersByType
    };
}

// Make functions globally available
window.debugRoutes = debugRoutes;
window.debugRiskLevels = debugRiskLevels;
window.showAllRoutes = showAllRoutes;
window.hideAllRoutes = hideAllRoutes;
window.compareRoutes = compareRoutes;
window.focusRoute = focusRoute;
window.toggleRoute = toggleRoute;
window.toggleSatellite = toggleSatellite;
window.loadDemo = loadDemo;