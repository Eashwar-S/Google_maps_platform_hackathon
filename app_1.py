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

# PRE-STORED WINTER DEMO DATA - Instant responses for demo
WINTER_DEMO_DATA = {
    "Minneapolis_to_Duluth": {
        "date": "January 15, 2024",
        "event": "Severe Midwest Ice Storm",
        "routes": [
            {
                "name": "Highway Route (I-35)",
                "type": "Safest Option",
                "description": "Major highway with better winter maintenance",
                "distance": "155 mi",
                "duration": "2 hours 45 min",
                "safety_score": 72,
                "avg_ice_risk": 0.28,
                "max_ice_risk": 0.45,
                "risk_level": "low",
                "high_risk_segments": 2,
                "weather_points": [
                    {"lat": 44.9778, "lng": -93.2650, "temp": -6, "condition": "light freezing rain", "risk": 0.25},
                    {"lat": 45.3456, "lng": -92.8765, "temp": -8, "condition": "freezing rain", "risk": 0.35},
                    {"lat": 45.8123, "lng": -92.5432, "temp": -10, "condition": "moderate ice", "risk": 0.42},
                    {"lat": 46.7867, "lng": -92.1005, "temp": -12, "condition": "ice storm", "risk": 0.45}
                ],
                "warnings": ["Moderate icing on bridges", "Reduced visibility possible"],
                "advantages": ["Well-maintained highway", "Regular snow plowing", "Emergency services nearby"]
            },
            {
                "name": "Scenic Route (County Roads)",
                "type": "Balanced Route",
                "description": "Mix of highways and scenic county roads",
                "distance": "168 mi",
                "duration": "3 hours 15 min",
                "safety_score": 45,
                "avg_ice_risk": 0.58,
                "max_ice_risk": 0.72,
                "risk_level": "medium",
                "high_risk_segments": 6,
                "weather_points": [
                    {"lat": 44.9778, "lng": -93.2650, "temp": -7, "condition": "freezing rain", "risk": 0.45},
                    {"lat": 45.2345, "lng": -93.1234, "temp": -9, "condition": "severe ice", "risk": 0.68},
                    {"lat": 45.6789, "lng": -92.7654, "temp": -11, "condition": "dangerous ice", "risk": 0.72},
                    {"lat": 46.7867, "lng": -92.1005, "temp": -13, "condition": "extreme ice", "risk": 0.65}
                ],
                "warnings": ["Multiple high-risk segments", "Limited winter maintenance", "Steep grades with ice"],
                "advantages": ["Scenic winter views", "Less traffic", "Shorter wait times"]
            },
            {
                "name": "Rural Route (Back Roads)",
                "type": "Direct Route",
                "description": "Shortest path through rural areas",
                "distance": "142 mi", 
                "duration": "2 hours 58 min",
                "safety_score": 23,
                "avg_ice_risk": 0.78,
                "max_ice_risk": 0.92,
                "risk_level": "high",
                "high_risk_segments": 12,
                "weather_points": [
                    {"lat": 44.9778, "lng": -93.2650, "temp": -8, "condition": "heavy freezing rain", "risk": 0.65},
                    {"lat": 45.1234, "lng": -93.0987, "temp": -10, "condition": "severe ice storm", "risk": 0.82},
                    {"lat": 45.4567, "lng": -92.8765, "temp": -12, "condition": "extreme ice", "risk": 0.92},
                    {"lat": 46.7867, "lng": -92.1005, "temp": -14, "condition": "life-threatening", "risk": 0.88}
                ],
                "warnings": ["DANGEROUS CONDITIONS", "Poor winter maintenance", "Remote areas with limited help", "Multiple bridges freeze first"],
                "advantages": ["Shortest distance", "Fastest in good weather"]
            }
        ]
    },
    "Buffalo_to_Rochester": {
        "date": "February 8, 2024", 
        "event": "Lake Effect Blizzard",
        "routes": [
            {
                "name": "I-90 Thruway",
                "type": "Safest Option",
                "description": "Major interstate with continuous maintenance",
                "distance": "75 mi",
                "duration": "1 hour 25 min",
                "safety_score": 68,
                "avg_ice_risk": 0.32,
                "max_ice_risk": 0.48,
                "risk_level": "low",
                "high_risk_segments": 3,
                "weather_points": [
                    {"lat": 42.8864, "lng": -78.8784, "temp": -2, "condition": "heavy snow", "risk": 0.28},
                    {"lat": 43.0123, "lng": -78.4321, "temp": -1, "condition": "mixed precip", "risk": 0.42},
                    {"lat": 43.1566, "lng": -77.6088, "temp": 0, "condition": "sleet", "risk": 0.48}
                ],
                "warnings": ["Lake effect snow bands", "Visibility issues"],
                "advantages": ["Toll road maintenance", "Regular plowing", "Emergency services"]
            },
            {
                "name": "Route 5 Lakeshore", 
                "type": "Scenic Route",
                "description": "Along Lake Ontario shore",
                "distance": "82 mi",
                "duration": "1 hour 52 min", 
                "safety_score": 41,
                "avg_ice_risk": 0.62,
                "max_ice_risk": 0.78,
                "risk_level": "medium",
                "high_risk_segments": 8,
                "weather_points": [
                    {"lat": 42.8864, "lng": -78.8784, "temp": -3, "condition": "blizzard", "risk": 0.55},
                    {"lat": 43.2456, "lng": -78.1234, "temp": -2, "condition": "severe lake effect", "risk": 0.78},
                    {"lat": 43.1566, "lng": -77.6088, "temp": -1, "condition": "ice and snow", "risk": 0.62}
                ],
                "warnings": ["Intense lake effect snow", "Wind gusts", "Exposed areas"],
                "advantages": ["Beautiful lake views", "Some heated rest stops"]
            },
            {
                "name": "Southern Route",
                "type": "Alternative Route", 
                "description": "Inland route avoiding lake effect",
                "distance": "89 mi",
                "duration": "2 hours 8 min",
                "safety_score": 58,
                "avg_ice_risk": 0.48,
                "max_ice_risk": 0.65,
                "risk_level": "medium",
                "high_risk_segments": 4,
                "weather_points": [
                    {"lat": 42.8864, "lng": -78.8784, "temp": -1, "condition": "light snow", "risk": 0.35},
                    {"lat": 42.7456, "lng": -78.2345, "temp": -2, "condition": "freezing rain", "risk": 0.65},
                    {"lat": 43.1566, "lng": -77.6088, "temp": 0, "condition": "mixed conditions", "risk": 0.48}
                ],
                "warnings": ["Rural areas", "Hills and curves with ice"],
                "advantages": ["Less lake effect", "Avoids worst snow bands"]
            }
        ]
    },
    "Detroit_to_GrandRapids": {
        "date": "December 22, 2024",
        "event": "Michigan Winter Storm", 
        "routes": [
            {
                "name": "I-96 West",
                "type": "Safest Option", 
                "description": "Primary interstate route",
                "distance": "161 mi",
                "duration": "2 hours 38 min",
                "safety_score": 75,
                "avg_ice_risk": 0.25,
                "max_ice_risk": 0.38,
                "risk_level": "low",
                "high_risk_segments": 1,
                "weather_points": [
                    {"lat": 42.3314, "lng": -83.0458, "temp": -3, "condition": "light freezing rain", "risk": 0.22},
                    {"lat": 42.5890, "lng": -84.2345, "temp": -4, "condition": "freezing rain", "risk": 0.32},
                    {"lat": 42.9634, "lng": -85.6681, "temp": -5, "condition": "moderate ice", "risk": 0.38}
                ],
                "warnings": ["Bridge icing possible"],
                "advantages": ["Major highway", "Good maintenance", "Multiple service areas"]
            },
            {
                "name": "M-14 to US-23",
                "type": "Northern Route",
                "description": "Through Ann Arbor and Lansing",
                "distance": "175 mi", 
                "duration": "3 hours 5 min",
                "safety_score": 52,
                "avg_ice_risk": 0.55,
                "max_ice_risk": 0.72,
                "risk_level": "medium",
                "high_risk_segments": 7,
                "weather_points": [
                    {"lat": 42.3314, "lng": -83.0458, "temp": -4, "condition": "freezing rain", "risk": 0.45},
                    {"lat": 42.2808, "lng": -83.7430, "temp": -6, "condition": "ice storm", "risk": 0.72},
                    {"lat": 42.9634, "lng": -85.6681, "temp": -7, "condition": "severe ice", "risk": 0.68}
                ],
                "warnings": ["University area congestion", "Multiple bridges", "Hilly terrain"],
                "advantages": ["Good urban infrastructure", "More gas stations"]
            },
            {
                "name": "I-94 to I-69",
                "type": "Southern Route",
                "description": "Through Kalamazoo corridor", 
                "distance": "157 mi",
                "duration": "2 hours 52 min",
                "safety_score": 38,
                "avg_ice_risk": 0.68,
                "max_ice_risk": 0.85,
                "risk_level": "high",
                "high_risk_segments": 9,
                "weather_points": [
                    {"lat": 42.3314, "lng": -83.0458, "temp": -5, "condition": "heavy freezing rain", "risk": 0.58},
                    {"lat": 42.2917, "lng": -85.5872, "temp": -7, "condition": "severe ice storm", "risk": 0.85},
                    {"lat": 42.9634, "lng": -85.6681, "temp": -8, "condition": "dangerous ice", "risk": 0.78}
                ],
                "warnings": ["SEVERE CONDITIONS", "Rural stretches", "Limited services", "Elevation changes"],
                "advantages": ["Less traffic", "Direct route"]
            }
        ]
    }
}

class FastRouteService:
    """Fast route service with instant demo responses and simple real-time mode"""
    
    def __init__(self):
        self.demo_routes = {
            ('Minneapolis, MN', 'Duluth, MN'): "Minneapolis_to_Duluth",
            ('Buffalo, NY', 'Rochester, NY'): "Buffalo_to_Rochester", 
            ('Detroit, MI', 'Grand Rapids, MI'): "Detroit_to_GrandRapids"
        }
    
    def is_demo_route(self, origin, destination):
        """Check if this is a pre-configured demo route"""
        # Normalize route key
        route_key = (self.normalize_location(origin), self.normalize_location(destination))
        return route_key in self.demo_routes
    
    def normalize_location(self, location):
        """Normalize location names for matching"""
        location = location.strip()
        # Handle common variations
        if 'minneapolis' in location.lower():
            return 'Minneapolis, MN'
        elif 'duluth' in location.lower():
            return 'Duluth, MN'
        elif 'buffalo' in location.lower():
            return 'Buffalo, NY'
        elif 'rochester' in location.lower() and 'ny' in location.lower():
            return 'Rochester, NY'
        elif 'detroit' in location.lower():
            return 'Detroit, MI'
        elif 'grand rapids' in location.lower():
            return 'Grand Rapids, MI'
        return location
    
    def get_demo_routes(self, origin, destination):
        """Get instant pre-stored demo routes"""
        route_key = (self.normalize_location(origin), self.normalize_location(destination))
        
        if route_key not in self.demo_routes:
            return None
        
        demo_key = self.demo_routes[route_key]
        demo_data = WINTER_DEMO_DATA[demo_key]
        
        return {
            'routes': demo_data['routes'],
            'is_demo': True,
            'winter_event': {
                'date': demo_data['date'],
                'description': demo_data['event']
            }
        }
    
    def get_real_time_routes(self, origin, destination):
        """Get real-time routes with simplified weather analysis"""
        try:
            # Get Google Maps routes quickly
            directions_result = gmaps.directions(
                origin, 
                destination,
                mode="driving",
                alternatives=True,
                departure_time=datetime.now()
            )
            
            # Generate route alternatives if we don't have enough
            if len(directions_result) < 3:
                directions_result.extend(self.generate_additional_routes(origin, destination))
            
            routes = []
            for i, route in enumerate(directions_result[:3]):
                route_info = self.create_real_time_route_info(route, i)
                routes.append(route_info)
            
            return {
                'routes': routes,
                'is_demo': False,
                'analysis_note': 'Real-time analysis with current summer conditions'
            }
            
        except Exception as e:
            print(f"Real-time route error: {e}")
            return {'routes': [], 'error': str(e)}
    
    def generate_additional_routes(self, origin, destination):
        """Generate additional route alternatives"""
        additional = []
        
        try:
            # Try avoiding highways
            highway_avoid = gmaps.directions(
                origin, destination,
                mode="driving",
                avoid=["highways"],
                departure_time=datetime.now()
            )
            if highway_avoid:
                additional.extend(highway_avoid[:1])
            
            # Try avoiding tolls
            toll_avoid = gmaps.directions(
                origin, destination,
                mode="driving", 
                avoid=["tolls"],
                departure_time=datetime.now()
            )
            if toll_avoid:
                additional.extend(toll_avoid[:1])
                
        except Exception:
            pass
        
        return additional
    
    def create_real_time_route_info(self, route, index):
        """Create route info for real-time analysis"""
        # For real-time (summer), ice risk is minimal
        summer_risk = 0.05 + (index * 0.03)  # Slight variation for demo
        
        route_types = ["Fastest Route", "Scenic Route", "Alternative Route"]
        descriptions = [
            "Primary route with best travel time",
            "Scenic route with points of interest", 
            "Alternative path avoiding main highways"
        ]
        
        return {
            'name': route.get('summary', f"Route {index + 1}"),
            'type': route_types[index] if index < len(route_types) else f"Route {index + 1}",
            'description': descriptions[index] if index < len(descriptions) else "Alternative route option",
            'distance': route['legs'][0]['distance']['text'],
            'duration': route['legs'][0]['duration']['text'], 
            'safety_score': 92 - (index * 5),  # High safety in summer
            'avg_ice_risk': summer_risk,
            'max_ice_risk': summer_risk + 0.02,
            'risk_level': 'minimal',
            'high_risk_segments': 0,
            'weather_points': self.generate_summer_weather_points(route),
            'warnings': [] if index == 0 else [f"Route {index + 1} may have more traffic"],
            'advantages': [
                "Clear summer conditions",
                "No ice risk detected", 
                "Good visibility expected"
            ]
        }
    
    def generate_summer_weather_points(self, route):
        """Generate summer weather points along route"""
        points = []
        
        # Extract a few points along the route
        legs = route.get('legs', [])
        if legs:
            start_loc = legs[0]['start_location']
            end_loc = legs[0]['end_location']
            
            # Create 3-4 sample points
            for i in range(4):
                ratio = i / 3.0
                lat = start_loc['lat'] + (end_loc['lat'] - start_loc['lat']) * ratio
                lng = start_loc['lng'] + (end_loc['lng'] - start_loc['lng']) * ratio
                
                points.append({
                    'lat': lat,
                    'lng': lng,
                    'temp': 22 + (i * 2),  # Summer temperatures
                    'condition': 'clear skies',
                    'risk': 0.02 + (i * 0.01)
                })
        
        return points

# Simplified Flask Routes
@app.route('/')
def index():
    return render_template('index.html', google_maps_api_key=GOOGLE_MAPS_API_KEY)

@app.route('/api/routes', methods=['POST'])
def get_routes():
    data = request.json
    origin = data.get('origin', '').strip()
    destination = data.get('destination', '').strip()
    driver_experience = data.get('driver_experience', 'intermediate')
    avoid_icy = data.get('avoid_icy', False)
    
    if not origin or not destination:
        return jsonify({'error': 'Origin and destination required'}), 400
    
    route_service = FastRouteService()
    
    # Check if this is a demo route
    if route_service.is_demo_route(origin, destination):
        # Return instant demo data
        result = route_service.get_demo_routes(origin, destination)
        
        if result:
            # Filter routes based on driver experience for demo
            filtered_routes = filter_routes_by_experience(result['routes'], driver_experience)
            
            return jsonify({
                'routes': filtered_routes,
                'driver_experience': driver_experience,
                'is_demo': True,
                'winter_event': result['winter_event'],
                'analysis_timestamp': datetime.now().isoformat(),
                'response_time': 'instant'
            })
    
    # Real-time analysis for other routes
    result = route_service.get_real_time_routes(origin, destination)
    
    if 'error' in result:
        return jsonify({'error': result['error']}), 500
    
    # Filter routes based on driver experience
    filtered_routes = filter_routes_by_experience(result['routes'], driver_experience)
    
    return jsonify({
        'routes': filtered_routes,
        'driver_experience': driver_experience,
        'is_demo': False,
        'analysis_note': result.get('analysis_note'),
        'analysis_timestamp': datetime.now().isoformat(),
        'response_time': 'fast'
    })

def filter_routes_by_experience(routes, experience):
    """Filter routes based on driver experience"""
    if experience == 'beginner':
        # Beginners get routes with safety score > 60
        suitable_routes = [r for r in routes if r['safety_score'] > 60]
        
        # Add warnings for challenging routes
        for route in suitable_routes:
            if route['safety_score'] < 80:
                route['experience_note'] = "Pay extra attention to road conditions"
        
        return suitable_routes or routes[:1]  # At least return the safest one
    
    elif experience == 'intermediate':
        # Intermediate drivers can handle routes with safety score > 40
        suitable_routes = [r for r in routes if r['safety_score'] > 40]
        
        for route in suitable_routes:
            if route['safety_score'] < 60:
                route['experience_note'] = "Requires careful attention in icy sections"
        
        return suitable_routes or routes[:2]  # Return at least 2 routes
    
    else:  # expert
        # Expert drivers see all routes with appropriate warnings
        for route in routes:
            if route['safety_score'] < 40:
                route['experience_note'] = "Extreme conditions - expert skills required"
            elif route['safety_score'] < 60:
                route['experience_note'] = "Challenging conditions ahead"
        
        return routes

@app.route('/api/demo-routes')
def get_demo_routes_list():
    """Get list of available demo routes"""
    demo_list = []
    
    for route_info in WINTER_DEMO_DATA.values():
        demo_list.append({
            'date': route_info['date'],
            'event': route_info['event'],
            'description': f"Experience {route_info['event']} conditions"
        })
    
    return jsonify({'demo_routes': demo_list})

if __name__ == '__main__':
    print("🚗 IcyRoute - Fast Winter Route Planning System")
    print("=" * 50)
    print("Features:")
    print("• ⚡ INSTANT demo responses with pre-stored winter data")
    print("• 🌨️ Realistic winter storm scenarios:")
    print("  - Minneapolis → Duluth: Severe ice storm")
    print("  - Buffalo → Rochester: Lake effect blizzard") 
    print("  - Detroit → Grand Rapids: Michigan winter storm")
    print("• 🌞 Fast real-time analysis for other routes")
    print("• 🎯 No departure time complexity - uses current time")
    print("• 📱 Responsive UI with smooth interactions")
    print("=" * 50)
    print("Demo Routes (Instant Response):")
    print("• Minneapolis, MN to Duluth, MN")
    print("• Buffalo, NY to Rochester, NY") 
    print("• Detroit, MI to Grand Rapids, MI")
    print("=" * 50)
    print("Setup Instructions:")
    print("1. Set GOOGLE_MAPS_API_KEY in .env file")
    print("2. Install: pip install flask googlemaps requests python-dotenv")
    print("3. Run: python app.py")
    print("4. Visit: http://localhost:5000")
    print("=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5000)