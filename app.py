import os
import requests
import json
import math
from flask import Flask, render_template, request, jsonify
from datetime import datetime, timedelta
import googlemaps
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# API Keys from environment variables
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')

if not GOOGLE_MAPS_API_KEY:
    raise ValueError("GOOGLE_MAPS_API_KEY environment variable is required")

# Initialize Google Maps client
gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)

class IceDetector:
    def __init__(self):
        self.ice_risk_threshold = {
            'low': 0.3,
            'medium': 0.6,
            'high': 0.8
        }
    
    def calculate_ice_risk(self, weather_data):
        """Calculate ice risk based on weather conditions"""
        temp = weather_data.get('temp', 0)
        humidity = weather_data.get('humidity', 0)
        precipitation = weather_data.get('precipitation', 0)
        wind_speed = weather_data.get('wind_speed', 0)
        
        # Ice risk factors
        ice_risk = 0
        
        # Temperature factor (highest risk around freezing)
        if -2 <= temp <= 2:  # Celsius
            ice_risk += 0.4
        elif -5 <= temp < -2 or 2 < temp <= 5:
            ice_risk += 0.2
        
        # Humidity factor
        if humidity > 80:
            ice_risk += 0.2
        elif humidity > 60:
            ice_risk += 0.1
        
        # Precipitation factor
        if precipitation > 0:
            ice_risk += 0.3
        
        # Wind factor (can cause rapid cooling)
        if wind_speed > 15:  # km/h
            ice_risk += 0.1
        
        return min(ice_risk, 1.0)
    
    def get_risk_level(self, ice_risk):
        """Convert numeric risk to category"""
        if ice_risk >= self.ice_risk_threshold['high']:
            return 'high'
        elif ice_risk >= self.ice_risk_threshold['medium']:
            return 'medium'
        elif ice_risk >= self.ice_risk_threshold['low']:
            return 'low'
        else:
            return 'minimal'

class WeatherService:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://maps.googleapis.com/maps/api/weather"
    
    def get_weather_along_route(self, route_points):
        """Get weather data for points along the route"""
        weather_data = []
        
        # Sample points along route (every ~50km)
        sample_points = self.sample_route_points(route_points, 50000)  # 50km intervals
        
        for point in sample_points:
            try:
                weather = self.get_weather_at_location(point['lat'], point['lng'])
                weather_data.append({
                    'location': point,
                    'weather': weather,
                    'ice_risk': IceDetector().calculate_ice_risk(weather)
                })
            except Exception as e:
                print(f"Weather API error: {e}")
                # Use default moderate risk if API fails
                weather_data.append({
                    'location': point,
                    'weather': {'temp': 0, 'humidity': 70, 'precipitation': 0.1, 'wind_speed': 10},
                    'ice_risk': 0.5
                })
        
        return weather_data
    
    def get_weather_at_location(self, lat, lng):
        """Get current weather at specific coordinates using Google Weather API"""
        # Google Weather API endpoint
        url = f"https://maps.googleapis.com/maps/api/weather/json?location={lat},{lng}&key={self.api_key}"
        
        try:
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            
            # Parse Google Weather API response
            current = data.get('current', {})
            return {
                'temp': current.get('temperature', 0),
                'humidity': current.get('humidity', 50),
                'precipitation': current.get('precipitation_mm', 0),
                'wind_speed': current.get('wind_speed_kmh', 0),
                'description': current.get('condition', 'unknown'),
                'feels_like': current.get('feels_like', 0),
                'visibility': current.get('visibility_km', 10)
            }
        except requests.exceptions.RequestException as e:
            print(f"Google Weather API error: {e}")
            # Fallback to simulated weather data for demo
            return self.get_simulated_weather(lat, lng)
    
    def get_simulated_weather(self, lat, lng):
        """Generate realistic winter weather data for demo purposes"""
        import random
        
        # Simulate realistic winter conditions for demo
        # Higher ice risk in northern latitudes and known problematic areas
        base_temp = -5 + (45 - abs(lat)) * 0.5  # Colder in northern areas
        
        # Add some randomness for realistic variation
        temp_variation = random.uniform(-3, 3)
        temp = base_temp + temp_variation
        
        # Simulate precipitation and humidity
        precipitation = random.uniform(0, 2) if random.random() < 0.3 else 0
        humidity = random.uniform(60, 95)
        wind_speed = random.uniform(5, 25)
        
        # Determine weather description based on conditions
        if temp < -2 and precipitation > 0:
            description = "freezing rain" if temp > -5 else "snow"
        elif temp < 2 and humidity > 80:
            description = "overcast, potential ice"
        elif temp < 0:
            description = "clear, cold"
        else:
            description = "partly cloudy"
        
        return {
            'temp': round(temp, 1),
            'humidity': round(humidity, 1),
            'precipitation': round(precipitation, 2),
            'wind_speed': round(wind_speed, 1),
            'description': description,
            'feels_like': round(temp - (wind_speed * 0.2), 1),
            'visibility': round(random.uniform(5, 15), 1)
        }
    
    def sample_route_points(self, route_points, interval_meters):
        """Sample points along route at specified intervals"""
        if not route_points:
            return []
        
        sampled_points = [route_points[0]]  # Always include start
        
        total_distance = 0
        last_sampled_distance = 0
        
        for i in range(1, len(route_points)):
            segment_distance = self.haversine_distance(
                route_points[i-1]['lat'], route_points[i-1]['lng'],
                route_points[i]['lat'], route_points[i]['lng']
            )
            total_distance += segment_distance
            
            if total_distance - last_sampled_distance >= interval_meters:
                sampled_points.append(route_points[i])
                last_sampled_distance = total_distance
        
        # Always include destination
        if route_points[-1] not in sampled_points:
            sampled_points.append(route_points[-1])
        
        return sampled_points
    
    def haversine_distance(self, lat1, lon1, lat2, lon2):
        """Calculate distance between two points in meters"""
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat/2)**2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c

class RouteOptimizer:
    def __init__(self, gmaps_client):
        self.gmaps = gmaps_client
    
    def get_routes(self, origin, destination, avoid_icy=False):
        """Get route options with ice consideration"""
        try:
            # Get multiple route alternatives using Google Routes API
            directions_result = self.gmaps.directions(
                origin, 
                destination,
                mode="driving",
                alternatives=True,
                departure_time=datetime.now(),
                avoid=["tolls"] if avoid_icy else None  # Can be customized based on preferences
            )
            
            routes = []
            weather_service = WeatherService(GOOGLE_MAPS_API_KEY)
            
            for i, route in enumerate(directions_result):
                # Extract route points
                route_points = self.extract_route_points(route)
                
                # Get weather data along route
                weather_data = weather_service.get_weather_along_route(route_points)
                
                # Calculate average ice risk
                avg_ice_risk = sum(w['ice_risk'] for w in weather_data) / len(weather_data)
                max_ice_risk = max(w['ice_risk'] for w in weather_data)
                
                route_info = {
                    'route_index': i,
                    'summary': route['summary'],
                    'distance': route['legs'][0]['distance']['text'],
                    'duration': route['legs'][0]['duration']['text'],
                    'avg_ice_risk': avg_ice_risk,
                    'max_ice_risk': max_ice_risk,
                    'risk_level': IceDetector().get_risk_level(avg_ice_risk),
                    'weather_points': weather_data,
                    'polyline': route['overview_polyline']['points'],
                    'start_location': {
                        'lat': route['legs'][0]['start_location']['lat'],
                        'lng': route['legs'][0]['start_location']['lng']
                    },
                    'end_location': {
                        'lat': route['legs'][0]['end_location']['lat'],
                        'lng': route['legs'][0]['end_location']['lng']
                    },
                    'bounds': {
                        'northeast': route['bounds']['northeast'],
                        'southwest': route['bounds']['southwest']
                    }
                }
                
                routes.append(route_info)
            
            # Sort routes by ice risk if avoiding icy roads
            if avoid_icy:
                routes.sort(key=lambda x: (x['avg_ice_risk'], x['max_ice_risk']))
            
            return routes
            
        except Exception as e:
            print(f"Route calculation error: {e}")
            return []
    
    def extract_route_points(self, route):
        """Extract coordinate points from route"""
        points = []
        
        for leg in route['legs']:
            for step in leg['steps']:
                points.append({
                    'lat': step['start_location']['lat'],
                    'lng': step['start_location']['lng']
                })
                points.append({
                    'lat': step['end_location']['lat'],
                    'lng': step['end_location']['lng']
                })
        
        return points

# Flask Routes
@app.route('/')
def index():
    return render_template('index.html', google_maps_api_key=GOOGLE_MAPS_API_KEY)

@app.route('/api/routes', methods=['POST'])
def get_routes():
    data = request.json
    origin = data.get('origin')
    destination = data.get('destination')
    driver_experience = data.get('driver_experience', 'intermediate')
    avoid_icy = data.get('avoid_icy', False)
    
    if not origin or not destination:
        return jsonify({'error': 'Origin and destination required'}), 400
    
    optimizer = RouteOptimizer(gmaps)
    routes = optimizer.get_routes(origin, destination, avoid_icy)
    
    # Filter routes based on driver experience
    filtered_routes = filter_routes_by_experience(routes, driver_experience)
    
    return jsonify({
        'routes': filtered_routes,
        'driver_experience': driver_experience,
        'timestamp': datetime.now().isoformat()
    })

def filter_routes_by_experience(routes, experience):
    """Filter and rank routes based on driver experience"""
    if experience == 'beginner':
        # Beginners should avoid high-risk routes
        return [r for r in routes if r['risk_level'] in ['minimal', 'low']]
    elif experience == 'intermediate':
        # Intermediate drivers can handle low to medium risk
        return [r for r in routes if r['risk_level'] in ['minimal', 'low', 'medium']]
    else:  # expert
        # Expert drivers get all routes but with clear warnings
        return routes

# Demo route for testing
@app.route('/demo')
def demo():
    """Demo route with pre-configured icy conditions"""
    demo_routes = [
        {
            'origin': 'Minneapolis, MN',
            'destination': 'Duluth, MN',
            'description': 'Common icy corridor in Minnesota winter'
        },
        {
            'origin': 'Buffalo, NY',
            'destination': 'Rochester, NY',
            'description': 'Lake effect snow/ice region'
        },
        {
            'origin': 'Detroit, MI',
            'destination': 'Grand Rapids, MI',
            'description': 'Heavy winter conditions area'
        }
    ]
    return render_template('demo.html', demo_routes=demo_routes)

if __name__ == '__main__':
    print("🚗 IcyRoute - Winter Route Planning System")
    print("=" * 50)
    print("Features:")
    print("• Real-time ice risk assessment using Google Weather API")
    print("• Driver experience-based route filtering")
    print("• Alternative route suggestions via Google Routes API")
    print("• Weather integration along routes")
    print("• Google Maps Platform integration")
    print("=" * 50)
    print("Setup Instructions:")
    print("1. Get Google Maps Platform API key from Google Cloud Console")
    print("2. Enable the following APIs:")
    print("   - Directions API")
    print("   - Geocoding API")
    print("   - Places API")
    print("   - Weather API (if available in your region)")
    print("3. Replace GOOGLE_MAPS_API_KEY in the code")
    print("4. Install required packages: pip install flask googlemaps requests")
    print("5. Create templates folder and save the HTML content as index.html")
    print("=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5000)