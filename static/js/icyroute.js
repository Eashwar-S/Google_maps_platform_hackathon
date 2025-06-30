// IcyRoute - Smart Winter Route Planning JavaScript
// Google Maps Platform Awards Submission

let map;
let directionsService;
let routeDisplays = [];
let currentRoutes = [];
let markers = [];
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
    const sampleWeather = route.weather_points && route.weather_points.length > 0 ? 
        route.weather_points[Math.floor(route.weather_points.length / 2)] : null;
    
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
                    <div class="risk-stat-value">${route.weather_points ? route.weather_points.length : 0}</div>
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

    // Get all possible routes from Google first, then match with our data
    directionsService.route({
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
        avoidHighways: false,
        avoidTolls: false
    }, (response, status) => {
        if (status === 'OK') {
            // Create renderers for each of our route variations
            routes.forEach((route, index) => {
                createRouteRenderer(route, index, response, origin, destination);
            });
            
            // Fit map after all routes are processed
            setTimeout(fitMapToRoutes, 1000);
        } else {
            console.error('Directions request failed due to ' + status);
            // Fallback: try individual route requests
            routes.forEach((route, index) => {
                createFallbackRoute(route, index, origin, destination);
            });
        }
    });
}

function createRouteRenderer(route, index, googleResponse, origin, destination) {
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
        directionsRenderer.setRouteIndex(Math.min(index, googleResponse.routes.length - 1));
    } catch (error) {
        console.warn(`Error setting route ${index}:`, error);
        createFallbackRoute(route, index, origin, destination);
        return;
    }
    
    routeDisplays.push({
        renderer: directionsRenderer,
        visible: true,
        route: route,
        index: index
    });

    // Add visual differentiators
    addRouteMarkers(route, index);
    addWeatherMarkers(route.weather_points, index);
}

function createFallbackRoute(route, index, origin, destination) {
    const routeOptions = getRouteOptions(route, index);
    
    directionsService.route({
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
        ...routeOptions
    }, (response, status) => {
        if (status === 'OK') {
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

            directionsRenderer.setDirections(response);
            
            routeDisplays.push({
                renderer: directionsRenderer,
                visible: true,
                route: route,
                index: index
            });

            addRouteMarkers(route, index);
            addWeatherMarkers(route.weather_points, index);
        } else {
            console.error(`Route ${index} failed:`, status);
        }
    });
}

function getRouteOptions(route, index) {
    const options = {};
    
    if (route.route_type === 'highway' || route.summary.includes('Highway')) {
        options.avoidTolls = false;
        options.avoidHighways = false;
    } else if (route.route_type === 'local' || route.summary.includes('Local')) {
        options.avoidHighways = true;
        options.avoidTolls = true;
    } else {
        if (index % 2 === 0) {
            options.avoidTolls = true;
        } else {
            options.avoidHighways = false;
        }
    }
    
    return options;
}

function getStrokeWeight(route, index) {
    let baseWeight = route.risk_level === 'high' ? 8 : 
                   route.risk_level === 'medium' ? 7 : 
                   route.risk_level === 'low' ? 6 : 5;
    
    return baseWeight + (index % 3);
}

function getStrokePattern(route, index) {
    const patterns = {
        0: {},
        1: { strokeOpacity: 0.8 },
        2: { strokeOpacity: 0.9 },
        3: { strokeOpacity: 0.7 },
        4: { strokeOpacity: 0.85 }
    };
    
    return patterns[index % 5] || {};
}

function addRouteMarkers(route, routeIndex) {
    const markerColors = ['green', 'blue', 'purple', 'orange', 'yellow'];
    const markerColor = markerColors[routeIndex % markerColors.length];
    
    if (route.weather_points && route.weather_points.length > 2) {
        const midPoint = route.weather_points[Math.floor(route.weather_points.length / 2)];
        
        const midMarker = new google.maps.Marker({
            position: { lat: midPoint.location.lat, lng: midPoint.location.lng },
            map: map,
            title: `Route ${routeIndex + 1}: ${route.summary} - Midpoint`,
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

        midMarker.addListener('click', () => {
            markers.forEach(m => {
                if (m.infoWindow) m.infoWindow.close();
            });
            infoWindow.open(map, midMarker);
        });

        midMarker.infoWindow = infoWindow;
        markers.push(midMarker);
    }
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

function addWeatherMarkers(weatherPoints, routeIndex) {
    if (!weatherPoints || weatherPoints.length === 0) return;
    
    const highRiskPoints = weatherPoints.filter((point, index) => 
        point.ice_risk > 0.6 && index % 3 === 0
    );

    highRiskPoints.slice(0, 3).forEach((point, index) => {
        const marker = new google.maps.Marker({
            position: { lat: point.location.lat, lng: point.location.lng },
            map: map,
            title: `Weather Alert: ${point.weather.description}`,
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
                    <h4 style="margin: 0 0 8px 0; color: #e74c3c;">⚠️ Weather Alert</h4>
                    <p style="margin: 0; font-size: 13px;">
                        <strong>Conditions:</strong> ${point.weather.description}<br>
                        <strong>Temperature:</strong> ${point.weather.temp}°C<br>
                        <strong>Ice Risk:</strong> ${Math.round(point.ice_risk * 100)}%<br>
                        <strong>Precipitation:</strong> ${point.weather.precipitation}mm<br>
                        <strong>Wind:</strong> ${point.weather.wind_speed} km/h
                    </p>
                    <div style="margin-top: 6px; font-size: 11px; color: #666;">
                        Route ${routeIndex + 1} - Segment ${point.segment_index + 1}
                    </div>
                </div>
            `
        });

        marker.addListener('click', () => {
            markers.forEach(m => {
                if (m.weatherInfoWindow) m.weatherInfoWindow.close();
            });
            weatherInfoWindow.open(map, marker);
        });

        marker.weatherInfoWindow = weatherInfoWindow;
        markers.push(marker);
    });
}

function addLocationMarkers(origin, destination) {
    const geocoder = new google.maps.Geocoder();
    
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

function selectRoute(index) {
    document.querySelectorAll('.route-card').forEach(card => {
        card.classList.remove('selected');
    });

    const selectedCard = document.querySelector(`[data-route-index="${index}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    focusRoute(index);
}

function focusRoute(index) {
    routeDisplays.forEach((display, i) => {
        if (display.renderer) {
            display.renderer.setMap(null);
            display.visible = false;
        }
    });

    const focusedDisplay = routeDisplays[index];
    if (focusedDisplay && focusedDisplay.renderer) {
        focusedDisplay.renderer.setMap(map);
        focusedDisplay.visible = true;
        
        const route = focusedDisplay.route;
        const color = RISK_COLORS[route.risk_level];
        
        focusedDisplay.renderer.setOptions({
            polylineOptions: {
                strokeColor: color,
                strokeWeight: 12,
                strokeOpacity: 1.0,
                zIndex: 2000
            }
        });

        markers.forEach(marker => {
            if (marker.title && marker.title.includes('Route')) {
                const markerRouteIndex = parseInt(marker.title.match(/Route (\d+)/)?.[1]) - 1;
                marker.setVisible(markerRouteIndex === index);
            } else {
                marker.setVisible(true);
            }
        });

        setTimeout(() => {
            fitMapToSingleRoute(focusedDisplay.renderer);
        }, 100);
    }

    updateCardVisibility();
}

function fitMapToSingleRoute(renderer) {
    try {
        if (renderer && renderer.getDirections()) {
            const bounds = new google.maps.LatLngBounds();
            const route = renderer.getDirections().routes[0];
            
            route.legs.forEach(leg => {
                leg.steps.forEach(step => {
                    bounds.extend(step.start_location);
                    bounds.extend(step.end_location);
                });
            });

            map.fitBounds(bounds);
            
            google.maps.event.addListenerOnce(map, 'bounds_changed', function() {
                if (map.getZoom() > 14) {
                    map.setZoom(14);
                }
                if (map.getZoom() < 8) {
                    map.setZoom(8);
                }
            });
        }
    } catch (error) {
        console.warn('Error fitting map to single route:', error);
        fitMapToRoutes();
    }
}

function showAllRoutes() {
    let visibleCount = 0;
    
    routeDisplays.forEach((display, index) => {
        if (display.renderer) {
            display.renderer.setMap(map);
            display.visible = true;
            visibleCount++;
            
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

    markers.forEach(marker => {
        marker.setVisible(true);
    });

    updateCardVisibility();
    
    if (visibleCount > 0) {
        setTimeout(fitMapToRoutes, 200);
    }
    
    console.log(`Showing ${visibleCount} routes`);
}

function hideAllRoutes() {
    routeDisplays.forEach(display => {
        if (display.renderer) {
            display.renderer.setMap(null);
            display.visible = false;
        }
    });

    markers.forEach(marker => {
        if (marker.title && marker.title.includes('Route')) {
            marker.setVisible(false);
        } else {
            marker.setVisible(true);
        }
    });

    updateCardVisibility();
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

    markers.forEach(marker => {
        if (marker.title && marker.title.includes(`Route ${index + 1}`)) {
            marker.setVisible(display.visible);
        }
    });

    updateCardVisibility();
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

// Enhanced route comparison function
function compareRoutes() {
    if (currentRoutes.length < 2) return;

    const comparison = currentRoutes.map((route, index) => {
        return {
            index: index + 1,
            name: route.summary,
            distance: route.distance,
            duration: route.duration,
            risk: Math.round(route.avg_ice_risk * 100),
            type: route.route_type || 'mixed'
        };
    });

    console.table(comparison);
    showRouteComparison(comparison);
}

function showRouteComparison(comparison) {
    const comparisonHTML = `
        <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0; border: 2px solid #3498db;">
            <h4 style="margin: 0 0 10px 0; color: #3498db;">📊 Route Comparison</h4>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 4px; border: 1px solid #ddd;">Route</th>
                        <th style="padding: 4px; border: 1px solid #ddd;">Distance</th>
                        <th style="padding: 4px; border: 1px solid #ddd;">Time</th>
                        <th style="padding: 4px; border: 1px solid #ddd;">Risk</th>
                    </tr>
                </thead>
                <tbody>
                    ${comparison.map(route => `
                        <tr>
                            <td style="padding: 4px; border: 1px solid #ddd;">Route ${route.index}</td>
                            <td style="padding: 4px; border: 1px solid #ddd;">${route.distance}</td>
                            <td style="padding: 4px; border: 1px solid #ddd;">${route.duration}</td>
                            <td style="padding: 4px; border: 1px solid #ddd;">${route.risk}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    const resultsDiv = document.getElementById('results');
    if (!document.getElementById('route-comparison')) {
        const comparisonDiv = document.createElement('div');
        comparisonDiv.id = 'route-comparison';
        comparisonDiv.innerHTML = comparisonHTML;
        resultsDiv.insertBefore(comparisonDiv, document.getElementById('routesList'));
    }
}

// Initialize demo on page load
window.onload = function() {
    console.log('🚗 IcyRoute - Google Maps Platform Awards Demo Ready');
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

// Add route debugging function
function debugRoutes() {
    console.log('=== ROUTE DEBUG INFO ===');
    console.log(`Total routes: ${routeDisplays.length}`);
    console.log(`Visible routes: ${routeDisplays.filter(d => d.visible).length}`);
    console.log(`Total markers: ${markers.length}`);
    
    routeDisplays.forEach((display, index) => {
        console.log(`Route ${index}:`, {
            visible: display.visible,
            hasRenderer: !!display.renderer,
            hasDirections: !!(display.renderer && display.renderer.getDirections()),
            summary: display.route.summary,
            riskLevel: display.route.risk_level
        });
    });
    
    return routeDisplays;
}

// Make functions globally available
window.debugRoutes = debugRoutes;
window.showAllRoutes = showAllRoutes;
window.hideAllRoutes = hideAllRoutes;
window.compareRoutes = compareRoutes;
window.focusRoute = focusRoute;
window.toggleRoute = toggleRoute;
window.toggleSatellite = toggleSatellite;
window.loadDemo = loadDemo;// IcyRoute - Smart Winter Route Planning JavaScript
// Google Maps Platform Awards Submission

// let map;
// let directionsService;
// let routeDisplays = [];
// let currentRoutes = [];
// let markers = [];
// let isSatelliteView = false;

// // Enhanced risk level colors with gradients
// const RISK_COLORS = {
//     'minimal': '#2ecc71',
//     'low': '#f39c12',
//     'medium': '#e67e22',
//     'high': '#e74c3c'
// };

// // Initialize Google Maps with winter styling
// function initMap() {
//     map = new google.maps.Map(document.getElementById('map'), {
//         zoom: 6,
//         center: { lat: 44.9778, lng: -93.2650 },
//         mapTypeControl: true,
//         streetViewControl: false,
//         fullscreenControl: true,
//         styles: [
//             {
//                 featureType: 'all',
//                 elementType: 'geometry.fill',
//                 stylers: [{ color: '#f0f8ff' }]
//             },
//             {
//                 featureType: 'water',
//                 elementType: 'geometry',
//                 stylers: [{ color: '#b3d9ff' }]
//             },
//             {
//                 featureType: 'landscape',
//                 elementType: 'geometry',
//                 stylers: [{ color: '#ffffff' }]
//             },
//             {
//                 featureType: 'road.highway',
//                 elementType: 'geometry',
//                 stylers: [{ color: '#e6f3ff' }]
//             }
//         ]
//     });

//     directionsService = new google.maps.DirectionsService();
//     loadDemo('Minneapolis, MN', 'Duluth, MN');
// }

// function loadDemo(origin, destination) {
//     document.getElementById('origin').value = origin;
//     document.getElementById('destination').value = destination;
//     document.getElementById('experience').value = 'intermediate';
//     document.getElementById('avoid_icy').checked = true;
    
//     document.getElementById('routeForm').dispatchEvent(new Event('submit'));
// }

// // Form submission handler
// document.addEventListener('DOMContentLoaded', function() {
//     document.getElementById('routeForm').addEventListener('submit', async function(e) {
//         e.preventDefault();
        
//         const formData = {
//             origin: document.getElementById('origin').value,
//             destination: document.getElementById('destination').value,
//             driver_experience: document.getElementById('experience').value,
//             avoid_icy: document.getElementById('avoid_icy').checked
//         };

//         clearAllRoutes();
//         document.getElementById('loading').style.display = 'block';
//         document.getElementById('results').style.display = 'none';
//         document.getElementById('legend').style.display = 'none';

//         try {
//             const response = await fetch('/api/routes', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(formData)
//             });

//             const data = await response.json();
            
//             if (data.error) {
//                 throw new Error(data.error);
//             }

//             displayResults(data);
//             displayRoutesOnMap(data.routes, formData.origin, formData.destination);
//         } catch (error) {
//             console.error('Error:', error);
//             displayError(error.message);
//         } finally {
//             document.getElementById('loading').style.display = 'none';
//         }
//     });
// });

// function displayResults(data) {
//     const resultsDiv = document.getElementById('results');
//     const routesList = document.getElementById('routesList');
//     const legend = document.getElementById('legend');
    
//     routesList.innerHTML = '';
//     currentRoutes = data.routes;

//     if (data.routes.length === 0) {
//         routesList.innerHTML = '<div class="warning"><span class="warning-icon">❌</span><strong>No safe routes found</strong> for your experience level. Consider adjusting your settings or choosing expert mode.</div>';
//     } else {
//         data.routes.forEach((route, index) => {
//             const routeCard = createEnhancedRouteCard(route, index);
//             routesList.appendChild(routeCard);
//         });
//     }

//     resultsDiv.style.display = 'block';
//     legend.style.display = 'block';
// }

// function createEnhancedRouteCard(route, index) {
//     const card = document.createElement('div');
//     card.className = 'route-card';
//     card.dataset.routeIndex = index;
//     card.style.setProperty('--risk-color', RISK_COLORS[route.risk_level]);
    
//     const riskClass = `risk-${route.risk_level}`;
//     const riskIcon = getRiskIcon(route.risk_level);
    
//     // Sample weather from the route
//     const sampleWeather = route.weather_points[Math.floor(route.weather_points.length / 2)];
    
//     card.innerHTML = `
//         <div class="route-header">
//             <div class="route-title">Route ${index + 1}: ${route.summary}</div>
//             <div class="risk-badge ${riskClass}">${riskIcon} ${route.risk_level.toUpperCase()}</div>
//         </div>
        
//         <div class="route-details">
//             <div class="detail-item">
//                 <div class="detail-label">Distance</div>
//                 <div class="detail-value">${route.distance}</div>
//             </div>
//             <div class="detail-item">
//                 <div class="detail-label">Duration</div>
//                 <div class="detail-value">${route.duration}</div>
//             </div>
//             <div class="detail-item">
//                 <div class="detail-label">Average Risk</div>
//                 <div class="detail-value">${Math.round(route.avg_ice_risk * 100)}%</div>
//             </div>
//             <div class="detail-item">
//                 <div class="detail-label">Peak Risk</div>
//                 <div class="detail-value">${Math.round(route.max_ice_risk * 100)}%</div>
//             </div>
//         </div>
        
//         <div class="risk-details">
//             <h4>⚠️ Risk Analysis</h4>
//             <div class="risk-stats">
//                 <div class="risk-stat">
//                     <div class="risk-stat-value">${route.high_risk_segments || 0}</div>
//                     <div class="risk-stat-label">High Risk Segments</div>
//                 </div>
//                 <div class="risk-stat">
//                     <div class="risk-stat-value">${Math.round((route.risk_variance || 0) * 100)}</div>
//                     <div class="risk-stat-label">Risk Variation</div>
//                 </div>
//                 <div class="risk-stat">
//                     <div class="risk-stat-value">${route.weather_points.length}</div>
//                     <div class="risk-stat-label">Weather Points</div>
//                 </div>
//             </div>
//         </div>
        
//         ${sampleWeather ? `
//         <div class="weather-info">
//             <h5>🌡️ Sample Weather Conditions</h5>
//             <div class="weather-details">
//                 ${sampleWeather.weather.temp}°C, ${sampleWeather.weather.description}, 
//                 ${sampleWeather.weather.precipitation}mm precipitation, 
//                 ${sampleWeather.weather.wind_speed}km/h winds
//             </div>
//         </div>
//         ` : ''}
        
//         <div class="route-actions">
//             <button class="btn-small btn-focus" onclick="focusRoute(${index})">Focus on Map</button>
//             <button class="btn-small btn-hide" onclick="toggleRoute(${index})">Toggle Route</button>
//         </div>
//     `;
    
//     card.addEventListener('click', function(e) {
//         if (!e.target.classList.contains('btn-small')) {
//             selectRoute(index);
//         }
//     });
    
//     return card;
// }

// function displayRoutesOnMap(routes, origin, destination) {
//     clearAllRoutes();
//     addLocationMarkers(origin, destination);

//     // Get all possible routes from Google first, then match with our data
//     directionsService.route({
//         origin: origin,
//         destination: destination,
//         travelMode: google.maps.TravelMode.DRIVING,
//         provideRouteAlternatives: true,
//         avoidHighways: false,
//         avoidTolls: false
//     }, (response, status) => {
//         if (status === 'OK') {
//             // Create renderers for each of our route variations
//             routes.forEach((route, index) => {
//                 createRouteRenderer(route, index, response, origin, destination);
//             });
            
//             // Fit map after all routes are processed
//             setTimeout(fitMapToRoutes, 1000);
//         } else {
//             console.error('Directions request failed due to ' + status);
//             // Fallback: try individual route requests
//             routes.forEach((route, index) => {
//                 createFallbackRoute(route, index, origin, destination);
//             });
//         }
//     });
// }

// function createRouteRenderer(route, index, googleResponse, origin, destination) {
//     const color = RISK_COLORS[route.risk_level];
//     const strokeWeight = getStrokeWeight(route, index);
//     const strokePattern = getStrokePattern(route, index);
    
//     const directionsRenderer = new google.maps.DirectionsRenderer({
//         map: map,
//         polylineOptions: {
//             strokeColor: color,
//             strokeWeight: strokeWeight,
//             strokeOpacity: 0.9,
//             zIndex: 1000 - index, // Higher index = higher z-index
//             ...strokePattern
//         },
//         suppressMarkers: true,
//         preserveViewport: true
//     });

//     try {
//         directionsRenderer.setDirections(googleResponse);
//         directionsRenderer.setRouteIndex(Math.min(index, googleResponse.routes.length - 1));
//     } catch (error) {
//         console.warn(`Error setting route ${index}:`, error);
//         // Try fallback
//         createFallbackRoute(route, index, origin, destination);
//         return;
//     }
    
//     routeDisplays.push({
//         renderer: directionsRenderer,
//         visible: true,
//         route: route,
//         index: index
//     });

//     // Add visual differentiators
//     addRouteMarkers(route, index);
//     addWeatherMarkers(route.weather_points, index);
// }

// function createFallbackRoute(route, index, origin, destination) {
//     // Fallback: create individual route request with variations
//     const routeOptions = getRouteOptions(route, index);
    
//     directionsService.route({
//         origin: origin,
//         destination: destination,
//         travelMode: google.maps.TravelMode.DRIVING,
//         ...routeOptions
//     }, (response, status) => {
//         if (status === 'OK') {
//             const color = RISK_COLORS[route.risk_level];
//             const strokeWeight = getStrokeWeight(route, index);
//             const strokePattern = getStrokePattern(route, index);
            
//             const directionsRenderer = new google.maps.DirectionsRenderer({
//                 map: map,
//                 polylineOptions: {
//                     strokeColor: color,
//                     strokeWeight: strokeWeight,
//                     strokeOpacity: 0.9,
//                     zIndex: 1000 - index,
//                     ...strokePattern
//                 },
//                 suppressMarkers: true,
//                 preserveViewport: true
//             });

//             directionsRenderer.setDirections(response);
            
//             routeDisplays.push({
//                 renderer: directionsRenderer,
//                 visible: true,
//                 route: route,
//                 index: index
//             });

//             addRouteMarkers(route, index);
//             addWeatherMarkers(route.weather_points, index);
//         } else {
//             console.error(`Route ${index} failed:`, status);
//         }
//     });
// }

// function getRouteOptions(route, index) {
//     // Create different routing options based on route type and index
//     const options = {};
    
//     if (route.route_type === 'highway' || route.summary.includes('Highway')) {
//         options.avoidTolls = false;
//         options.avoidHighways = false;
//     } else if (route.route_type === 'local' || route.summary.includes('Local')) {
//         options.avoidHighways = true;
//         options.avoidTolls = true;
//     } else {
//         // Alternate between different options for variation
//         if (index % 2 === 0) {
//             options.avoidTolls = true;
//         } else {
//             options.avoidHighways = false;
//         }
//     }
    
//     return options;
// }

// function getStrokeWeight(route, index) {
//     // Vary stroke weight by risk level and route index
//     let baseWeight = route.risk_level === 'high' ? 8 : 
//                    route.risk_level === 'medium' ? 7 : 
//                    route.risk_level === 'low' ? 6 : 5;
    
//     // Add variation based on index to make routes more distinguishable
//     return baseWeight + (index % 3);
// }

// function getStrokePattern(route, index) {
//     // Create different stroke patterns for visual distinction
//     const patterns = {
//         0: {}, // Solid line
//         1: { strokeOpacity: 0.8 }, // Slightly transparent
//         2: { strokeOpacity: 0.9 }, // Different transparency
//         3: { strokeOpacity: 0.7 }, // More transparent
//         4: { strokeOpacity: 0.85 }  // Another variation
//     };
    
//     return patterns[index % 5] || {};
// }

// function addRouteMarkers(route, routeIndex) {
//     // Add distinctive markers along the route to show variations
//     const markerColors = ['green', 'blue', 'purple', 'orange', 'yellow'];
//     const markerColor = markerColors[routeIndex % markerColors.length];
    
//     // Add start/mid/end markers for each route
//     if (route.weather_points && route.weather_points.length > 2) {
//         const startPoint = route.weather_points[0];
//         const midPoint = route.weather_points[Math.floor(route.weather_points.length / 2)];
//         const endPoint = route.weather_points[route.weather_points.length - 1];
        
//         // Mid-route marker to show route variation
//         const midMarker = new google.maps.Marker({
//             position: { lat: midPoint.location.lat, lng: midPoint.location.lng },
//             map: map,
//             title: `${route.summary} - Midpoint`,
//             icon: {
//                 url: `https://maps.google.com/mapfiles/ms/icons/${markerColor}-dot.png`,
//                 scaledSize: new google.maps.Size(32, 32),
//                 anchor: new google.maps.Point(16, 32)
//             },
//             zIndex: 100 + routeIndex
//         });

//         const infoWindow = new google.maps.InfoWindow({
//             content: `
//                 <div style="padding: 8px; max-width: 250px;">
//                     <h4 style="margin: 0 0 8px 0; color: ${RISK_COLORS[route.risk_level]};">
//                         Route ${routeIndex + 1}: ${route.summary}
//                     </h4>
//                     <p style="margin: 0; font-size: 13px;">
//                         <strong>Distance:</strong> ${route.distance}<br>
//                         <strong>Duration:</strong> ${route.duration}<br>
//                         <strong>Ice Risk:</strong> ${Math.round(route.avg_ice_risk * 100)}%<br>
//                         <strong>Route Type:</strong> ${route.route_type || 'Mixed'}
//                     </p>
//                     <div style="margin-top: 8px; padding: 4px 8px; background: ${getRiskBackgroundColor(route.risk_level)}; border-radius: 4px; text-align: center;">
//                         <small style="font-weight: bold;">${route.risk_level.toUpperCase()} RISK</small>
//                     </div>
//                 </div>
//             `
//         });

//         midMarker.addListener('click', () => {
//             // Close any open info windows
//             markers.forEach(m => {
//                 if (m.infoWindow) m.infoWindow.close();
//             });
//             infoWindow.open(map, midMarker);
//         });

//         midMarker.infoWindow = infoWindow;
//         markers.push(midMarker);
//     }
// }

// function getRiskBackgroundColor(riskLevel) {
//     const colors = {
//         'minimal': '#d4edda',
//         'low': '#fff3cd',
//         'medium': '#f8d7da',
//         'high': '#f5c6cb'
//     };
//     return colors[riskLevel] || '#f8f9fa';
// }

// function addWeatherMarkers(weatherPoints, routeIndex) {
//     if (!weatherPoints || weatherPoints.length === 0) return;
    
//     // Only show weather markers for high-risk points and space them out
//     const highRiskPoints = weatherPoints.filter((point, index) => 
//         point.ice_risk > 0.6 && index % 3 === 0
//     );

//     highRiskPoints.slice(0, 3).forEach((point, index) => { // Limit to 3 per route
//         const marker = new google.maps.Marker({
//             position: { lat: point.location.lat, lng: point.location.lng },
//             map: map,
//             title: `Weather Alert: ${point.weather.description}`,
//             icon: {
//                 url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
//                     <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
//                         <circle cx="14" cy="14" r="12" fill="#e74c3c" stroke="white" stroke-width="2"/>
//                         <text x="14" y="18" text-anchor="middle" fill="white" font-size="14" font-weight="bold">⚠</text>
//                     </svg>
//                 `),
//                 scaledSize: new google.maps.Size(28, 28),
//                 anchor: new google.maps.Point(14, 14)
//             },
//             zIndex: 200 + routeIndex
//         });

//         const weatherInfoWindow = new google.maps.InfoWindow({
//             content: `
//                 <div style="padding: 10px; max-width: 220px;">
//                     <h4 style="margin: 0 0 8px 0; color: #e74c3c;">⚠️ Weather Alert</h4>
//                     <p style="margin: 0; font-size: 13px;">
//                         <strong>Conditions:</strong> ${point.weather.description}<br>
//                         <strong>Temperature:</strong> ${point.weather.temp}°C<br>
//                         <strong>Ice Risk:</strong> ${Math.round(point.ice_risk * 100)}%<br>
//                         <strong>Precipitation:</strong> ${point.weather.precipitation}mm<br>
//                         <strong>Wind:</strong> ${point.weather.wind_speed} km/h
//                     </p>
//                     <div style="margin-top: 6px; font-size: 11px; color: #666;">
//                         Route ${routeIndex + 1} - Segment ${point.segment_index + 1}
//                     </div>
//                 </div>
//             `
//         });

//         marker.addListener('click', () => {
//             // Close other weather info windows
//             markers.forEach(m => {
//                 if (m.weatherInfoWindow) m.weatherInfoWindow.close();
//             });
//             weatherInfoWindow.open(map, marker);
//         });

//         marker.weatherInfoWindow = weatherInfoWindow;
//         markers.push(marker);
//     });
// }

// function addLocationMarkers(origin, destination) {
//     const geocoder = new google.maps.Geocoder();
    
//     // Enhanced start marker
//     geocoder.geocode({ address: origin }, (results, status) => {
//         if (status === 'OK') {
//             const startMarker = new google.maps.Marker({
//                 position: results[0].geometry.location,
//                 map: map,
//                 title: 'Start: ' + origin,
//                 icon: {
//                     url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
//                         <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
//                             <path d="M20 0C9 0 0 9 0 20c0 15 20 30 20 30s20-15 20-30C40 9 31 0 20 0z" fill="#27ae60"/>
//                             <circle cx="20" cy="20" r="8" fill="white"/>
//                             <text x="20" y="25" text-anchor="middle" fill="#27ae60" font-size="12" font-weight="bold">S</text>
//                         </svg>
//                     `),
//                     scaledSize: new google.maps.Size(40, 50),
//                     anchor: new google.maps.Point(20, 50)
//                 },
//                 zIndex: 1000
//             });

//             const startInfoWindow = new google.maps.InfoWindow({
//                 content: `
//                     <div style="padding: 8px;">
//                         <h4 style="margin: 0 0 4px 0; color: #27ae60;">🚀 Start Location</h4>
//                         <p style="margin: 0; font-size: 14px;">${origin}</p>
//                     </div>
//                 `
//             });

//             startMarker.addListener('click', () => {
//                 startInfoWindow.open(map, startMarker);
//             });

//             markers.push(startMarker);
//         }
//     });

//     // Enhanced destination marker
//     geocoder.geocode({ address: destination }, (results, status) => {
//         if (status === 'OK') {
//             const endMarker = new google.maps.Marker({
//                 position: results[0].geometry.location,
//                 map: map,
//                 title: 'Destination: ' + destination,
//                 icon: {
//                     url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
//                         <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
//                             <path d="M20 0C9 0 0 9 0 20c0 15 20 30 20 30s20-15 20-30C40 9 31 0 20 0z" fill="#e74c3c"/>
//                             <circle cx="20" cy="20" r="8" fill="white"/>
//                             <text x="20" y="25" text-anchor="middle" fill="#e74c3c" font-size="12" font-weight="bold">E</text>
//                         </svg>
//                     `),
//                     scaledSize: new google.maps.Size(40, 50),
//                     anchor: new google.maps.Point(20, 50)
//                 },
//                 zIndex: 1000
//             });

//             const endInfoWindow = new google.maps.InfoWindow({
//                 content: `
//                     <div style="padding: 8px;">
//                         <h4 style="margin: 0 0 4px 0; color: #e74c3c;">🎯 Destination</h4>
//                         <p style="margin: 0; font-size: 14px;">${destination}</p>
//                     </div>
//                 `
//             });

//             endMarker.addListener('click', () => {
//                 endInfoWindow.open(map, endMarker);
//             });

//             markers.push(endMarker);
//         }
//     });
// }

// function selectRoute(index) {
//     document.querySelectorAll('.route-card').forEach(card => {
//         card.classList.remove('selected');
//     });

//     const selectedCard = document.querySelector(`[data-route-index="${index}"]`);
//     if (selectedCard) {
//         selectedCard.classList.add('selected');
//         selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
//     }

//     focusRoute(index);
// }

// function focusRoute(index) {
//     // Hide all routes first
//     routeDisplays.forEach((display, i) => {
//         if (display.renderer) {
//             display.renderer.setMap(null);
//             display.visible = false;
//         }
//     });

//     // Show and highlight the focused route
//     const focusedDisplay = routeDisplays[index];
//     if (focusedDisplay && focusedDisplay.renderer) {
//         focusedDisplay.renderer.setMap(map);
//         focusedDisplay.visible = true;
        
//         // Enhance the focused route appearance
//         const route = focusedDisplay.route;
//         const color = RISK_COLORS[route.risk_level];
        
//         focusedDisplay.renderer.setOptions({
//             polylineOptions: {
//                 strokeColor: color,
//                 strokeWeight: 12,
//                 strokeOpacity: 1.0,
//                 zIndex: 2000
//             }
//         });

//         // Hide all route markers except for the focused route
//         markers.forEach(marker => {
//             if (marker.title && marker.title.includes('Route')) {
//                 const markerRouteIndex = parseInt(marker.title.match(/Route (\d+)/)?.[1]) - 1;
//                 marker.setVisible(markerRouteIndex === index);
//             } else {
//                 marker.setVisible(true); // Keep start/end markers visible
//             }
//         });

//         // Fit map to focused route
//         setTimeout(() => {
//             fitMapToSingleRoute(focusedDisplay.renderer);
//         }, 100);
//     }

//     updateCardVisibility();
// }

// function fitMapToSingleRoute(renderer) {
//     try {
//         if (renderer && renderer.getDirections()) {
//             const bounds = new google.maps.LatLngBounds();
//             const route = renderer.getDirections().routes[0];
            
//             route.legs.forEach(leg => {
//                 leg.steps.forEach(step => {
//                     bounds.extend(step.start_location);
//                     bounds.extend(step.end_location);
//                 });
//             });

//             map.fitBounds(bounds);
            
//             // Ensure reasonable zoom level
//             google.maps.event.addListenerOnce(map, 'bounds_changed', function() {
//                 if (map.getZoom() > 14) {
//                     map.setZoom(14);
//                 }
//                 if (map.getZoom() < 8) {
//                     map.setZoom(8);
//                 }
//             });
//         }
//     } catch (error) {
//         console.warn('Error fitting map to single route:', error);
//         fitMapToRoutes(); // Fallback to general fit
//     }
// }

// function showAllRoutes() {
//     let visibleCount = 0;
    
//     routeDisplays.forEach((display, index) => {
//         if (display.renderer) {
//             display.renderer.setMap(map);
//             display.visible = true;
//             visibleCount++;
            
//             // Reset to normal styling with variation
//             const route = display.route;
//             const color = RISK_COLORS[route.risk_level];
//             const strokeWeight = getStrokeWeight(route, index);
//             const strokePattern = getStrokePattern(route, index);
            
//             display.renderer.setOptions({
//                 polylineOptions: {
//                     strokeColor: color,
//                     strokeWeight: strokeWeight,
//                     strokeOpacity: 0.9,
//                     zIndex: 1000 - index,
//                     ...strokePattern
//                 }
//             });
//         }
//     });

//     // Show all route markers
//     markers.forEach(marker => {
//         marker.setVisible(true);
//     });

//     updateCardVisibility();
    
//     if (visibleCount > 0) {
//         setTimeout(fitMapToRoutes, 200);
//     }
    
//     console.log(`Showing ${visibleCount} routes`);
// }

// function hideAllRoutes() {
//     routeDisplays.forEach(display => {
//         if (display.renderer) {
//             display.renderer.setMap(null);
//             display.visible = false;
//         }
//     });

//     // Hide route markers but keep start/end markers
//     markers.forEach(marker => {
//         if (marker.title && marker.title.includes('Route')) {
//             marker.setVisible(false);
//         } else {
//             marker.setVisible(true);
//         }
//     });

//     updateCardVisibility();
// }

// function toggleRoute(index) {
//     const display = routeDisplays[index];
//     if (!display || !display.renderer) {
//         console.warn(`Route ${index} not found or not properly initialized`);
//         return;
//     }

//     if (display.visible) {
//         display.renderer.setMap(null);
//         display.visible = false;
//     } else {
//         display.renderer.setMap(map);
//         display.visible = true;
        
//         // Apply proper styling when showing
//         const route = display.route;
//         const color = RISK_COLORS[route.risk_level];
//         const strokeWeight = getStrokeWeight(route, index);
//         const strokePattern = getStrokePattern(route, index);
        
//         display.renderer.setOptions({
//             polylineOptions: {
//                 strokeColor: color,
//                 strokeWeight: strokeWeight,
//                 strokeOpacity: 0.9,
//                 zIndex: 1000 - index,
//                 ...strokePattern
//             }
//         });
//     }

//     // Update route marker visibility
//     markers.forEach(marker => {
//         if (marker.title && marker.title.includes(`Route ${index + 1}`)) {
//             marker.setVisible(display.visible);
//         }
//     });

//     updateCardVisibility();
// }

// function toggleSatellite() {
//     if (isSatelliteView) {
//         map.setMapTypeId('roadmap');
//         isSatelliteView = false;
//     } else {
//         map.setMapTypeId('satellite');
//         isSatelliteView = true;
//     }
// }

// function updateCardVisibility() {
//     routeDisplays.forEach((display, index) => {
//         const card = document.querySelector(`[data-route-index="${index}"]`);
//         if (card) {
//             if (display.visible) {
//                 card.classList.remove('hidden');
//             } else {
//                 card.classList.add('hidden');
//             }
//         }
//     });
// }

// function fitMapToRoutes() {
//     const visibleDisplays = routeDisplays.filter(d => d.visible && d.renderer);
    
//     if (visibleDisplays.length === 0) {
//         console.warn('No visible routes to fit map to');
//         return;
//     }

//     const bounds = new google.maps.LatLngBounds();
//     let boundsExtended = false;

//     visibleDisplays.forEach(display => {
//         try {
//             if (display.renderer.getDirections()) {
//                 const route = display.renderer.getDirections().routes[0];
//                 route.legs.forEach(leg => {
//                     leg.steps.forEach(step => {
//                         bounds.extend(step.start_location);
//                         bounds.extend(step.end_location);
//                         boundsExtended = true;
//                     });
//                 });
//             }
//         } catch (error) {
//             console.warn('Error accessing route directions:', error);
//         }
//     });

//     if (boundsExtended) {
//         map.fitBounds(bounds);
        
//         google.maps.event.addListenerOnce(map, 'bounds_changed', function() {
//             const zoom = map.getZoom();
//             if (zoom > 13) {
//                 map.setZoom(13);
//             }
//             if (zoom < 6) {
//                 map.setZoom(6);
//             }
//         });
//     } else {
//         console.warn('Could not extend bounds for any routes');
//     }
// }
