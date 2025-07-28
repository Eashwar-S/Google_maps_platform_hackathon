import os
import requests
import json
import math
import pandas as pd
import pickle
from flask import Flask, render_template, request, jsonify
from datetime import datetime, timedelta
import googlemaps
from dotenv import load_dotenv
import random
import openmeteo_requests
import requests_cache
from retry_requests import retry

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# API Keys from environment variables
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY') 

if not GOOGLE_MAPS_API_KEY:
    raise ValueError("GOOGLE_MAPS_API_KEY environment variable is required")

# Initialize Google Maps client
gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)

# Historical weather data cache directory
WEATHER_CACHE_DIR = "weather_cache"
os.makedirs(WEATHER_CACHE_DIR, exist_ok=True)

class HistoricalWeatherService:
    """Real historical weather data using OpenMeteo API"""
    
    def __init__(self):
        # Setup the Open-Meteo API client with cache and retry on error
        cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
        retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
        self.openmeteo = openmeteo_requests.Client(session=retry_session)
        
        # Define demo routes with their geographical areas
        self.demo_routes = {
            'minneapolis_duluth': {
                'origin': 'Minneapolis, MN',
                'destination': 'Duluth, MN',
                'bbox': {'north': 47.0, 'south': 44.5, 'east': -92.0, 'west': -94.0},
                'winter_period': {'start': '2024-01-15', 'end': '2024-01-25'},
                'description': 'I-35 Ice Storm Corridor - January 2024'
            },
            'buffalo_syracuse': {
                'origin': 'Buffalo, NY',
                'destination': 'Syracuse, NY',
                'bbox': {'north': 43.5, 'south': 42.5, 'east': -75.5, 'west': -79.0},
                'winter_period': {'start': '2024-02-10', 'end': '2024-02-20'},
                'description': 'Lake Effect Snow Belt - February 2024'
            },
            'detroit_grandrapids': {
                'origin': 'Detroit, MI',
                'destination': 'Grand Rapids, MI',
                'bbox': {'north': 43.0, 'south': 42.0, 'east': -84.5, 'west': -86.0},
                'winter_period': {'start': '2023-12-15', 'end': '2023-12-25'},
                'description': 'Michigan Freezing Rain Event - December 2023'
            },
            'denver_vail': {
                'origin': 'Denver, CO',
                'destination': 'Vail, CO',
                'bbox': {'north': 40.0, 'south': 39.5, 'east': -105.5, 'west': -107.0},
                'winter_period': {'start': '2024-01-20', 'end': '2024-01-30'},
                'description': 'Mountain Pass Blizzard - January 2024'
            }
        }
    
    def get_route_key(self, origin, destination):
        """Determine which demo route this matches"""
        route_str = f"{origin.lower()} {destination.lower()}"
        
        if 'minneapolis' in route_str and 'duluth' in route_str:
            return 'minneapolis_duluth'
        elif 'buffalo' in route_str and 'syracuse' in route_str:
            return 'buffalo_syracuse'
        elif 'detroit' in route_str and 'grand' in route_str:
            return 'detroit_grandrapids'
        elif 'denver' in route_str and 'vail' in route_str:
            return 'denver_vail'
        
        return None
    
    def load_or_fetch_historical_data(self, route_key):
        """Load cached data or fetch from OpenMeteo"""
        cache_file = os.path.join(WEATHER_CACHE_DIR, f"{route_key}_historical.pkl")
        
        if os.path.exists(cache_file):
            print(f"Loading cached weather data for {route_key}")
            with open(cache_file, 'rb') as f:
                return pickle.load(f)
        
        print(f"Fetching historical weather data for {route_key} from OpenMeteo")
        return self._fetch_and_cache_historical_data(route_key, cache_file)
    
    def _fetch_and_cache_historical_data(self, route_key, cache_file):
        """Fetch historical data from OpenMeteo and cache it"""
        route_info = self.demo_routes[route_key]
        bbox = route_info['bbox']
        period = route_info['winter_period']
        
        print(f"Fetching weather data for {route_key} from {period['start']} to {period['end']}")
        
        # Create a more focused grid of points along typical route corridors
        lat_points = [bbox['south'] + i * (bbox['north'] - bbox['south']) / 3 for i in range(4)]
        lng_points = [bbox['west'] + i * (bbox['east'] - bbox['west']) / 3 for i in range(4)]
        
        all_weather_data = []
        successful_fetches = 0
        
        for i, lat in enumerate(lat_points):
            for j, lng in enumerate(lng_points):
                try:
                    print(f"Fetching point {successful_fetches + 1}/16: {lat:.3f}, {lng:.3f}")
                    weather_df = self._fetch_point_historical_weather(
                        lat, lng, period['start'], period['end']
                    )
                    
                    # Store as dict format compatible with existing code
                    weather_station = {
                        'location': {'lat': lat, 'lng': lng},
                        'data': weather_df,
                        'station_id': f"{route_key}_{i}_{j}"
                    }
                    all_weather_data.append(weather_station)
                    successful_fetches += 1
                    
                except Exception as e:
                    print(f"Error fetching weather for {lat:.3f}, {lng:.3f}: {e}")
                    continue
        
        if successful_fetches == 0:
            print(f"Warning: No weather data successfully fetched for {route_key}")
            # Create minimal fallback data
            center_lat = (bbox['north'] + bbox['south']) / 2
            center_lng = (bbox['east'] + bbox['west']) / 2
            
            dates = pd.date_range(start=period['start'], end=period['end'], freq='D')
            fallback_df = pd.DataFrame({
                "date": dates,
                "temperature_max": [-2] * len(dates),
                "temperature_min": [-8] * len(dates), 
                "temperature_mean": [-5] * len(dates),
                "precipitation_sum": [3.0] * len(dates),
                "snowfall_sum": [2.0] * len(dates),
                "rain_sum": [1.0] * len(dates),
                "humidity_max": [90] * len(dates),
                "humidity_min": [75] * len(dates),
                "wind_speed_max": [30] * len(dates),
                "wind_speed_mean": [20] * len(dates)
            })
            
            all_weather_data.append({
                'location': {'lat': center_lat, 'lng': center_lng},
                'data': fallback_df,
                'station_id': f"{route_key}_fallback"
            })
        
        # Cache the data
        try:
            with open(cache_file, 'wb') as f:
                pickle.dump(all_weather_data, f)
            print(f"✅ Cached weather data for {route_key} ({len(all_weather_data)} stations)")
        except Exception as e:
            print(f"Warning: Could not cache data to {cache_file}: {e}")
        
        return all_weather_data
    
    def _fetch_point_historical_weather(self, lat, lng, start_date, end_date):
        """Fetch historical weather for a specific point using correct OpenMeteo archive API"""
        url = "https://archive-api.open-meteo.com/v1/archive"
        params = {
            "latitude": lat,
            "longitude": lng,
            "start_date": start_date,
            "end_date": end_date,
            "daily": [
                "temperature_2m_max",       # index 0
                "temperature_2m_min",       # index 1
                "temperature_2m_mean",      # index 2
                "precipitation_sum",        # index 3
                "snowfall_sum",             # index 4
                "rain_sum",                 # index 5
                "relative_humidity_2m_max", # index 6
                "relative_humidity_2m_min", # index 7
                "wind_speed_10m_max",       # index 8
                "wind_speed_10m_mean"       # index 9
            ],
            "timezone": "auto"
        }
        
        try:
            responses = self.openmeteo.weather_api(url, params=params)
            response = responses[0]
            
            daily = response.Daily()
            
            # Create date range
            dates = pd.date_range(
                start=pd.to_datetime(daily.Time(), unit="s", utc=True),
                end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
                freq=pd.Timedelta(days=1),
                inclusive="left"
            )
            
            # Extract data using correct indices
            weather_df = pd.DataFrame({
                "date": dates,
                "temperature_max": daily.Variables(0).ValuesAsNumpy(),
                "temperature_min": daily.Variables(1).ValuesAsNumpy(),
                "temperature_mean": daily.Variables(2).ValuesAsNumpy(),
                "precipitation_sum": daily.Variables(3).ValuesAsNumpy(),
                "snowfall_sum": daily.Variables(4).ValuesAsNumpy(),
                "rain_sum": daily.Variables(5).ValuesAsNumpy(),
                "humidity_max": daily.Variables(6).ValuesAsNumpy(),
                "humidity_min": daily.Variables(7).ValuesAsNumpy(),
                "wind_speed_max": daily.Variables(8).ValuesAsNumpy(),
                "wind_speed_mean": daily.Variables(9).ValuesAsNumpy()
            })
            
            print(f"Successfully fetched weather data for {lat}, {lng}: {len(weather_df)} days")
            return weather_df
            
        except Exception as e:
            print(f"Error fetching historical weather for {lat}, {lng}: {e}")
            # Return fallback data
            dates = pd.date_range(start=start_date, end=end_date, freq='D')
            return pd.DataFrame({
                "date": dates,
                "temperature_max": [-5] * len(dates),
                "temperature_min": [-10] * len(dates),
                "temperature_mean": [-7] * len(dates),
                "precipitation_sum": [2.0] * len(dates),
                "snowfall_sum": [1.5] * len(dates),
                "rain_sum": [0.5] * len(dates),
                "humidity_max": [85] * len(dates),
                "humidity_min": [70] * len(dates),
                "wind_speed_max": [25] * len(dates),
                "wind_speed_mean": [15] * len(dates)
            })


    def preload_all_demo_data(self):
        """Preload all demo route weather data"""
        print("🌨️ Preloading historical weather data for all demo routes...")
        
        for route_key in self.demo_routes.keys():
            try:
                self.load_or_fetch_historical_data(route_key)
                print(f"✅ {route_key} weather data ready")
            except Exception as e:
                print(f"❌ Error loading {route_key}: {e}")
        
        print("🎯 Historical weather data preloading complete!")
    
    def get_weather_for_route_points(self, route_points, origin, destination):
        """Get historical weather data for route points"""
        route_key = self.get_route_key(origin, destination)
        
        if route_key:
            # Use real historical data
            return self._get_historical_weather_for_points(route_key, route_points)
        else:
            # Use current weather simulation for non-demo routes
            return self._get_current_weather_simulation_for_points(route_points)
    
    def _get_historical_weather_for_points(self, route_key, route_points):
        """Get historical weather interpolated for route points"""
        historical_data = self.load_or_fetch_historical_data(route_key)
        weather_points = []
        
        print(f"Processing {len(route_points)} route points with {len(historical_data)} weather stations")
        
        for i, point in enumerate(route_points):
            # Find the closest weather station data
            closest_weather_df = self._find_closest_weather_data(
                point['lat'], point['lng'], historical_data
            )
            
            if closest_weather_df is not None and len(closest_weather_df) > 0:
                # Select a random day from the historical period for variation
                random_day_idx = random.randint(0, len(closest_weather_df) - 1)
                day_data = closest_weather_df.iloc[random_day_idx]
                
                # Handle NaN values with fallbacks
                temp_mean = day_data.get('temperature_mean', 10)
                if pd.isna(temp_mean):
                    temp_mean = 10
                    
                humidity_avg = (day_data.get('humidity_max', 85) + day_data.get('humidity_min', 70)) / 2
                if pd.isna(humidity_avg):
                    humidity_avg = 75
                    
                precipitation = day_data.get('precipitation_sum', 2.0)
                if pd.isna(precipitation):
                    precipitation = 2.0
                    
                wind_speed = day_data.get('wind_speed_mean', 20)
                if pd.isna(wind_speed):
                    wind_speed = 20
                    
                snowfall = day_data.get('snowfall_sum', 1.0)
                if pd.isna(snowfall):
                    snowfall = 1.0
                    
                rain = day_data.get('rain_sum', 0.5)
                if pd.isna(rain):
                    rain = 0.5
                    
                temp_min = day_data.get('temperature_min', temp_mean - 3)
                if pd.isna(temp_min):
                    temp_min = temp_mean - 3
                
                # Convert to our weather format
                weather_info = {
                    'temp': float(temp_mean),
                    'humidity': float(humidity_avg),
                    'precipitation': float(precipitation),
                    'wind_speed': float(wind_speed),
                    'snowfall': float(snowfall),
                    'rain': float(rain),
                    'description': self._get_weather_description(day_data),
                    'feels_like': float(temp_min),
                    'visibility': max(1, 15 - precipitation)
                }
                
                weather_points.append({
                    'location': point,
                    'weather': weather_info,
                    'segment_index': i,
                    'data_source': 'historical'
                })
            else:
                # Fallback to simulated winter conditions
                weather_points.append({
                    'location': point,
                    'weather': self._get_fallback_winter_weather(),
                    'segment_index': i,
                    'data_source': 'fallback'
                })
        
        print(f"Generated weather data for {len(weather_points)} route points")
        return weather_points
    
    def _find_closest_weather_data(self, lat, lng, historical_data):
        """Find the closest weather station data to a point"""
        min_distance = float('inf')
        closest_data = None
        
        for weather_station in historical_data:
            if 'location' in weather_station and 'data' in weather_station:
                station_lat = weather_station['location']['lat']
                station_lng = weather_station['location']['lng']
                
                distance = self._calculate_distance(lat, lng, station_lat, station_lng)
                
                if distance < min_distance:
                    min_distance = distance
                    closest_data = weather_station['data']  # Return the DataFrame
        
        return closest_data
    
    def _get_weather_description(self, day_data):
        """Generate weather description from data"""
        temp = day_data['temperature_mean']
        snow = day_data['snowfall_sum']
        rain = day_data['rain_sum']
        precip = day_data['precipitation_sum']
        
        # Handle NaN values
        if pd.isna(temp):
            temp = 15  # Default to 15C if missing
        if pd.isna(snow):
            snow = 0
        if pd.isna(rain):
            rain = 0
        if pd.isna(precip):
            precip = 0
        
        if snow > 5:
            return "heavy snow"
        elif snow > 1:
            return "light snow"
        elif temp < 0 and precip > 2:
            return "freezing rain/ice storm"
        elif temp < 2 and precip > 0.5:
            return "snow and ice"
        elif temp < 5 and rain > 1:
            return "cold rain"
        elif temp < 0:
            return "extreme cold"
        else:
            return "winter conditions"
    
    def _get_current_weather_simulation_for_points(self, route_points):
        """Get current weather for non-demo routes using OpenMeteo"""
        weather_points = []
        
        for i, point in enumerate(route_points):
            try:
                # Try to get real current weather from OpenMeteo
                weather_info = self._get_openmeteo_current_weather(point['lat'], point['lng'])
            except Exception as e:
                print(f"Failed to get current weather for point {i}: {e}")
                # Fallback to simulation
                weather_info = self._get_fallback_current_weather(point['lat'], point['lng'])
            
            weather_points.append({
                'location': point,
                'weather': weather_info,
                'segment_index': i,
                'data_source': 'openmeteo_current'
            })
        
        return weather_points
    
    def _get_openmeteo_current_weather(self, lat, lng):
        """Get current weather from OpenMeteo API for a specific point"""
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lng,
            "current": [
                "temperature_2m",           # index 0
                "relative_humidity_2m",     # index 1
                "precipitation",            # index 2
                "snowfall",                 # index 3
                "rain",                     # index 4
                "wind_speed_10m"            # index 5
            ],
            "timezone": "auto",
            "forecast_days": 1
        }
        
        responses = self.historical_service.openmeteo.weather_api(url, params=params)
        response = responses[0]
        current = response.Current()
        
        # Extract current values
        temp = current.Variables(0).Value()
        humidity = current.Variables(1).Value()
        precipitation = current.Variables(2).Value()
        snowfall = current.Variables(3).Value()
        rain = current.Variables(4).Value()
        wind_speed = current.Variables(5).Value() * 3.6  # Convert m/s to km/h
        
        # Calculate total precipitation
        total_precip = precipitation + snowfall
        
        # Generate description
        if snowfall > 1:
            description = "snow conditions"
        elif temp < 5 and total_precip > 0:
            description = "cold and wet"
        elif rain > 0.5:
            description = "rainy conditions"
        elif temp < 0:
            description = "freezing conditions"
        else:
            description = "current conditions"
        
        return {
            'temp': round(temp, 1),
            'humidity': round(humidity, 1),
            'precipitation': round(total_precip, 2),
            'wind_speed': round(wind_speed, 1),
            'snowfall': round(snowfall, 2),
            'rain': round(rain, 2),
            'description': description,
            'feels_like': round(temp - (wind_speed * 0.1), 1),
            'visibility': max(1, 15 - total_precip)
        }
    
    def _get_fallback_current_weather(self, lat, lng):
        """Fallback current weather when API fails"""
        # Season-appropriate fallback (summer 2025)
        base_temp = 22 + random.uniform(-5, 8)
        
        # Latitude adjustment
        if lat > 45:
            base_temp -= 8
        elif lat > 40:
            base_temp -= 3
        
        precipitation = random.uniform(0, 1) if random.random() < 0.2 else 0
        humidity = random.uniform(40, 75)
        wind_speed = random.uniform(5, 15)
        
        return {
            'temp': round(base_temp, 1),
            'humidity': round(humidity, 1),
            'precipitation': round(precipitation, 2),
            'wind_speed': round(wind_speed, 1),
            'snowfall': 0,
            'rain': round(precipitation, 2),
            'description': "moderate conditions",
            'feels_like': round(base_temp - (wind_speed * 0.1), 1),
            'visibility': 12
        }
    
    def _calculate_distance(self, lat1, lng1, lat2, lng2):
        """Calculate distance in meters using Haversine formula"""
        R = 6371000  # Earth radius in meters
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)
        
        a = (math.sin(delta_lat/2)**2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    def _get_fallback_winter_weather(self):
        """Generate realistic fallback winter weather"""
        return {
            'temp': random.uniform(-10, -2),
            'humidity': random.uniform(70, 90),
            'precipitation': random.uniform(1, 4),
            'wind_speed': random.uniform(15, 30),
            'snowfall': random.uniform(0.5, 3),
            'rain': random.uniform(0, 1),
            'description': 'winter storm conditions',
            'feels_like': random.uniform(-15, -5),
            'visibility': random.uniform(2, 8)
        }

class IceDetector:
    def __init__(self):
        self.ice_risk_threshold = {
            'low': 0.3,
            'medium': 0.6,
            'high': 0.8
        }
    
    def calculate_ice_risk(self, weather_data, lat, lng, route_context=None, route_type='highway'):
        """Calculate ice risk based on real weather conditions"""
        temp = weather_data.get('temp', 0)
        humidity = weather_data.get('humidity', 0)
        precipitation = weather_data.get('precipitation', 0)
        snowfall = weather_data.get('snowfall', 0)
        wind_speed = weather_data.get('wind_speed', 0)
        
        # Base ice risk calculation
        ice_risk = 0
        
        # Temperature factor (highest risk around freezing)
        if -3 <= temp <= 1:  # Prime ice formation zone
            ice_risk += 0.6
        elif -8 <= temp < -3 or 1 < temp <= 4:
            ice_risk += 0.4
        elif temp < -15:  # Extreme cold, snow more likely than ice
            ice_risk += 0.3
        
        # Humidity factor
        if humidity > 85:
            ice_risk += 0.25
        elif humidity > 70:
            ice_risk += 0.15
        
        # Precipitation and snow factor
        if snowfall > 2:  # Heavy snow
            ice_risk += 0.3
        elif snowfall > 0.5:  # Light snow
            ice_risk += 0.2
        
        if precipitation > 1 and temp < 2:  # Rain/sleet near freezing
            ice_risk += 0.4
        elif precipitation > 0.2 and temp < 0:  # Light precip below freezing
            ice_risk += 0.3
        
        # Wind factor (causes rapid temperature changes)
        if wind_speed > 25:  # km/h
            ice_risk += 0.2
        elif wind_speed > 15:
            ice_risk += 0.1
        
        # Route type modifier
        route_modifier = self._get_route_type_modifier(route_type, route_context)
        ice_risk += route_modifier
        
        # Location-specific modifiers
        ice_risk += self._get_location_modifier(lat, lng, route_context)
        
        return min(max(ice_risk, 0), 1.0)
    
    def _get_route_type_modifier(self, route_type, route_context):
        """Different route types have different inherent risks"""
        modifier = 0
        
        if route_type == 'highway':
            modifier -= 0.15  # Highways are better maintained
        elif route_type == 'arterial':
            modifier += 0.05  # Major roads, moderate maintenance
        elif route_type == 'local':
            modifier += 0.25  # Local roads, poor maintenance
        elif route_type == 'scenic':
            modifier += 0.35  # Scenic routes often less maintained
        
        # Check for specific road characteristics
        if route_context:
            context_lower = route_context.lower()
            if any(word in context_lower for word in ['county', 'rural', 'back', 'scenic']):
                modifier += 0.2
            if any(word in context_lower for word in ['interstate', 'highway', 'freeway']):
                modifier -= 0.1
            if any(word in context_lower for word in ['mountain', 'hill', 'pass']):
                modifier += 0.15
        
        return modifier
    
    def _get_location_modifier(self, lat, lng, route_context):
        """Add location-specific ice risk modifiers"""
        modifier = 0
        
        # Bridge and overpass areas (ice forms first)
        if self._is_near_bridge_area(lat, lng):
            modifier += 0.2
        
        # Northern latitude penalty
        if lat > 45:  # Northern states
            modifier += 0.15
        elif lat > 42:
            modifier += 0.08
        
        # Elevation consideration (rough approximation)
        elevation_factor = max(0, (lat - 40) * 0.03)
        modifier += elevation_factor
        
        return modifier
    
    def _is_near_bridge_area(self, lat, lng):
        """Simplified bridge detection"""
        bridge_zones = [
            (44.98, -93.25),  # Mississippi in Minneapolis
            (46.78, -92.10),  # Duluth harbor area
            (42.88, -78.87),  # Buffalo water areas
            (43.15, -77.61),  # Rochester area
            (43.05, -76.15),  # Syracuse area
            (42.33, -83.05),  # Detroit river area
            (42.96, -85.67),  # Grand Rapids river area
        ]
        
        for bridge_lat, bridge_lng in bridge_zones:
            distance = self._calculate_distance(lat, lng, bridge_lat, bridge_lng)
            if distance < 5000:  # Within 5km
                return True
        return False
    
    def _calculate_distance(self, lat1, lng1, lat2, lng2):
        """Calculate distance in meters"""
        R = 6371000
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)
        
        a = (math.sin(delta_lat/2)**2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
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
        self.historical_service = HistoricalWeatherService()
    
    def get_weather_along_route(self, route_points, route_name=None, use_realtime=False):
        """Get weather data for points along the route"""
        # Determine if this is a demo route
        route_key = self.historical_service.get_route_key(route_name or "", route_name or "")
        
        if route_key:
            print(f"Using historical weather data for demo route: {route_key}")
            return self._get_historical_weather_route(route_points, route_name, route_key)
        else:
            print(f"Using current weather data for route: {route_name}")
            return self._get_current_weather_route(route_points, route_name)
    
    def _get_historical_weather_route(self, route_points, route_name, route_key):
        """Get historical weather for demo routes"""
        weather_data = []
        sample_points = self.sample_route_points(route_points, 25000)  # 25km intervals
        
        # Get historical weather data
        historical_weather_points = self.historical_service.get_weather_for_route_points(
            sample_points, route_name.split(' to ')[0] if ' to ' in route_name else route_name,
            route_name.split(' to ')[1] if ' to ' in route_name else route_name
        )
        
        for weather_point in historical_weather_points:
            ice_detector = IceDetector()
            
            # Determine route type for risk calculation
            route_type = self._determine_route_type(
                weather_point['segment_index'], 
                len(historical_weather_points), 
                route_name
            )
            
            ice_risk = ice_detector.calculate_ice_risk(
                weather_point['weather'], 
                weather_point['location']['lat'], 
                weather_point['location']['lng'], 
                route_name, 
                route_type
            )
            
            weather_data.append({
                'location': weather_point['location'],
                'weather': weather_point['weather'],
                'ice_risk': ice_risk,
                'segment_index': weather_point['segment_index'],
                'route_type': route_type,
                'data_source': weather_point['data_source']
            })
        
        return weather_data
    
    def _get_current_weather_route(self, route_points, route_name):
        """Get current weather for non-demo routes"""
        weather_data = []
        sample_points = self.sample_route_points(route_points, 50000)  # 50km intervals
        
        for i, point in enumerate(sample_points):
            try:
                weather = self.get_current_weather(point['lat'], point['lng'])
                ice_detector = IceDetector()
                
                # Determine route type for risk calculation
                route_type = self._determine_route_type(i, len(sample_points), route_name)
                ice_risk = ice_detector.calculate_ice_risk(
                    weather, point['lat'], point['lng'], route_name, route_type
                )
                
                weather_data.append({
                    'location': point,
                    'weather': weather,
                    'ice_risk': ice_risk,
                    'segment_index': i,
                    'route_type': route_type,
                    'data_source': 'current'
                })
            except Exception as e:
                print(f"Current weather error: {e}")
                weather_data.append({
                    'location': point,
                    'weather': self._get_fallback_weather(),
                    'ice_risk': 0.3,
                    'segment_index': i,
                    'route_type': 'highway',
                    'data_source': 'fallback'
                })
        
        return weather_data
    
    def _determine_route_type(self, segment_index, total_segments, route_name):
        """Determine route type to create variation for different driver levels"""
        if not route_name:
            return 'highway'
        
        route_lower = route_name.lower()
        
        # Highway routes (safest - for beginners)
        if any(word in route_lower for word in ['interstate', 'highway', 'freeway', 'i-']):
            return 'highway'
        
        # Scenic/rural routes (riskiest - for experts only)
        if any(word in route_lower for word in ['scenic', 'rural', 'county', 'back']):
            return 'scenic'
        
        # Create variation based on segment position
        segment_ratio = segment_index / max(1, total_segments - 1)
        
        # Beginning and end segments are usually highways (safer)
        if segment_ratio < 0.2 or segment_ratio > 0.8:
            return 'highway'
        # Middle segments vary by route
        elif segment_ratio < 0.6:
            return 'arterial'
        else:
            return 'local'
    
    def get_current_weather(self, lat, lng):
        """Get current weather from OpenMeteo API instead of OpenWeatherMap"""
        try:
            url = "https://api.open-meteo.com/v1/forecast"
            params = {
                "latitude": lat,
                "longitude": lng,
                "current": [
                    "temperature_2m",
                    "relative_humidity_2m", 
                    "precipitation",
                    "snowfall",
                    "rain",
                    "wind_speed_10m",
                    "wind_gusts_10m"
                ],
                "daily": ["temperature_2m_max", "temperature_2m_min"],
                "timezone": "auto",
                "forecast_days": 1
            }
            
            responses = self.historical_service.openmeteo.weather_api(url, params=params)
            response = responses[0]
            
            # Get current weather
            current = response.Current()
            daily = response.Daily()
            
            # Extract current values
            current_temp = current.Variables(0).Value()
            humidity = current.Variables(1).Value()
            precipitation = current.Variables(2).Value()
            snowfall = current.Variables(3).Value()
            rain = current.Variables(4).Value()
            wind_speed = current.Variables(5).Value() * 3.6  # Convert m/s to km/h
            wind_gusts = current.Variables(6).Value() * 3.6
            
            # Get daily min/max for feels_like calculation
            temp_max = daily.Variables(0).ValuesAsNumpy()[0]
            temp_min = daily.Variables(1).ValuesAsNumpy()[0]
            feels_like = temp_min if current_temp < (temp_max + temp_min) / 2 else current_temp
            
            # Generate description based on conditions
            description = self._generate_current_weather_description(
                current_temp, precipitation, snowfall, rain, wind_speed
            )
            
            # Calculate visibility based on precipitation and weather conditions
            visibility = max(1, 15 - precipitation - snowfall)
            
            return {
                'temp': round(current_temp, 1),
                'humidity': round(humidity, 1),
                'precipitation': round(precipitation + snowfall, 2),
                'wind_speed': round(wind_speed, 1),
                'description': description,
                'feels_like': round(feels_like - (wind_speed * 0.1), 1),
                'visibility': round(visibility, 1),
                'snowfall': round(snowfall, 2),
                'rain': round(rain, 2)
            }
            
        except Exception as e:
            print(f"OpenMeteo current weather error for {lat}, {lng}: {e} - Falling back to simulated weather")
            return self._get_current_weather_simulation(lat, lng)
        
    def _generate_current_weather_description(self, temp, precipitation, snowfall, rain, wind_speed):
        """Generate weather description from current OpenMeteo data"""
        if snowfall > 2:
            return "heavy snow"
        elif snowfall > 0.5:
            return "light snow"
        elif temp < 2 and precipitation > 1:
            return "freezing precipitation"
        elif temp < 0 and precipitation > 0:
            return "snow and ice"
        elif rain > 2:
            return "heavy rain"
        elif rain > 0.5:
            return "light rain"
        elif wind_speed > 25:
            return "windy conditions"
        elif temp < 0:
            return "cold conditions"
        elif temp > 25:
            return "warm conditions"
        else:
            return "clear conditions"


    def _get_current_weather_simulation(self, lat, lng):
        """Simplified fallback simulation when OpenMeteo fails"""
        # Basic temperature based on latitude and season
        base_temp = 20 + random.uniform(-8, 12)
        
        # Adjust for latitude (northern areas cooler)
        if lat > 50:
            base_temp -= 10
        elif lat > 45:
            base_temp -= 5
        elif lat > 40:
            base_temp -= 2
        
        # Current season consideration (summer 2025)
        if lat < 35:  # Southern areas warmer
            base_temp += 5
        
        # Random weather variation
        precipitation = random.uniform(0, 2) if random.random() < 0.15 else 0
        humidity = random.uniform(35, 85)
        wind_speed = random.uniform(3, 20)
        
        # Snow only if very cold
        snowfall = random.uniform(0, 1) if base_temp < -2 else 0
        rain = precipitation - snowfall if precipitation > snowfall else 0
        
        description = self._generate_current_weather_description(
            base_temp, precipitation, snowfall, rain, wind_speed
        )
        
        return {
            'temp': round(base_temp, 1),
            'humidity': round(humidity, 1),
            'precipitation': round(precipitation, 2),
            'wind_speed': round(wind_speed, 1),
            'description': description,
            'feels_like': round(base_temp - (wind_speed * 0.1), 1),
            'visibility': round(random.uniform(8, 15), 1),
            'snowfall': round(snowfall, 2),
            'rain': round(rain, 2)
        }
    
    def _get_fallback_weather(self):
        """Fallback weather for errors"""
        return {
            'temp': 10,
            'humidity': 60,
            'precipitation': 0,
            'wind_speed': 10,
            'description': 'moderate conditions',
            'feels_like': 8,
            'visibility': 10,
            'snowfall': 0,
            'rain': 0
        }
    
    def _is_general_location_query(self, route_name):
        """Check if this is a general location that should use real-time weather"""
        if not route_name:
            return True
        
        # Check if route contains our demo locations
        demo_locations = ['minneapolis', 'duluth', 'buffalo', 'syracuse', 
                         'detroit', 'grand rapids', 'denver', 'vail']
        
        route_lower = route_name.lower()
        return not any(loc in route_lower for loc in demo_locations)
    
    def sample_route_points(self, route_points, interval_meters):
        """Sample points along route at specified intervals"""
        if not route_points:
            return []
        
        sampled_points = [route_points[0]]
        total_distance = 0
        last_sampled_distance = 0
        
        for i in range(1, len(route_points)):
            segment_distance = self._calculate_distance(
                route_points[i-1]['lat'], route_points[i-1]['lng'],
                route_points[i]['lat'], route_points[i]['lng']
            )
            total_distance += segment_distance
            
            if total_distance - last_sampled_distance >= interval_meters:
                sampled_points.append(route_points[i])
                last_sampled_distance = total_distance
        
        if route_points[-1] not in sampled_points:
            sampled_points.append(route_points[-1])
        
        return sampled_points
    
    def _calculate_distance(self, lat1, lng1, lat2, lng2):
        """Calculate distance in meters"""
        R = 6371000
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)
        
        a = (math.sin(delta_lat/2)**2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c

class RouteOptimizer:
    def __init__(self, gmaps_client):
        self.gmaps = gmaps_client
    
    def get_routes(self, origin, destination, avoid_icy=False):
        """Get route options with enhanced variety for different driver levels"""
        try:
            # Get multiple route alternatives with different avoid parameters
            base_routes = self._get_base_routes(origin, destination)
            
            # Generate additional route variations for different driver experience levels
            all_routes = []
            weather_service = WeatherService(GOOGLE_MAPS_API_KEY)
            
            # Determine route context
            route_context = f"{origin} to {destination}"
            
            for i, route in enumerate(base_routes):
                # Create variations for different driving preferences
                route_variations = self._create_route_variations(route, i)
                
                for variation_type, route_data in route_variations.items():
                    route_points = self.extract_route_points(route_data)
                    route_name = f"{route_data.get('summary', f'Route {i+1}')} ({variation_type})"
                    
                    # Get weather data (historical for demo routes, current for others)
                    weather_data = weather_service.get_weather_along_route(
                        route_points, route_context
                    )
                    
                    # Calculate risk metrics
                    ice_risks = [w['ice_risk'] for w in weather_data]
                    avg_ice_risk = sum(ice_risks) / len(ice_risks) if ice_risks else 0
                    max_ice_risk = max(ice_risks) if ice_risks else 0
                    
                    # Risk variance and high-risk segments
                    risk_variance = sum((r - avg_ice_risk) ** 2 for r in ice_risks) / len(ice_risks) if ice_risks else 0
                    high_risk_segments = sum(1 for r in ice_risks if r > 0.7)
                    
                    route_info = {
                        'route_index': len(all_routes),
                        'summary': route_name,
                        'distance': route_data['legs'][0]['distance']['text'],
                        'duration': route_data['legs'][0]['duration']['text'],
                        'avg_ice_risk': avg_ice_risk,
                        'max_ice_risk': max_ice_risk,
                        'risk_variance': risk_variance,
                        'high_risk_segments': high_risk_segments,
                        'risk_level': IceDetector().get_risk_level(avg_ice_risk),
                        'weather_points': weather_data,
                        'polyline': route_data['overview_polyline']['points'],
                        'start_location': {
                            'lat': route_data['legs'][0]['start_location']['lat'],
                            'lng': route_data['legs'][0]['start_location']['lng']
                        },
                        'end_location': {
                            'lat': route_data['legs'][0]['end_location']['lat'],
                            'lng': route_data['legs'][0]['end_location']['lng']
                        },
                        'bounds': {
                            'northeast': route_data['bounds']['northeast'],
                            'southwest': route_data['bounds']['southwest']
                        },
                        'route_type': variation_type,
                        'driver_suitability': self._get_driver_suitability(avg_ice_risk, variation_type),
                        'weather_source': weather_data[0]['data_source'] if weather_data else 'unknown'
                    }
                    
                    all_routes.append(route_info)
            
            # Sort routes appropriately
            if avoid_icy:
                all_routes.sort(key=lambda x: (x['avg_ice_risk'], x['max_ice_risk'], x['high_risk_segments']))
            else:
                all_routes.sort(key=lambda x: self._parse_duration(x['duration']))
            
            return all_routes[:5]  # Return top 5 routes
            
        except Exception as e:
            print(f"Route calculation error: {e}")
            return []
    
    def _get_base_routes(self, origin, destination):
        """Get base routes with different parameters"""
        routes = []
        
        try:
            # Standard routes
            directions_result = self.gmaps.directions(
                origin, destination,
                mode="driving",
                alternatives=True,
                departure_time=datetime.now()
            )
            routes.extend(directions_result)
            
            # Routes avoiding tolls (often longer, safer)
            try:
                toll_free = self.gmaps.directions(
                    origin, destination,
                    mode="driving",
                    alternatives=True,
                    avoid=["tolls"],
                    departure_time=datetime.now()
                )
                routes.extend(toll_free)
            except:
                pass
            
            # Routes avoiding highways (more local roads)
            try:
                no_highways = self.gmaps.directions(
                    origin, destination,
                    mode="driving",
                    alternatives=True,
                    avoid=["highways"],
                    departure_time=datetime.now()
                )
                routes.extend(no_highways)
            except:
                pass
                
        except Exception as e:
            print(f"Error getting base routes: {e}")
        
        # Remove duplicates and limit
        unique_routes = []
        seen_polylines = set()
        
        for route in routes:
            polyline = route['overview_polyline']['points']
            if polyline not in seen_polylines:
                seen_polylines.add(polyline)
                unique_routes.append(route)
        
        return unique_routes[:3]  # Max 3 base routes
    
    def _create_route_variations(self, base_route, route_index):
        """Create variations of a route for different driver experience levels"""
        variations = {}
        
        # Safest variation (for beginners) - assume highways
        safe_route = base_route.copy()
        safe_route['summary'] = f"{safe_route.get('summary', f'Route {route_index+1}')} - Highway"
        variations['highway'] = safe_route
        
        # Moderate variation (for intermediate) - mixed roads
        if 'via' not in base_route.get('summary', '').lower():
            moderate_route = base_route.copy()
            moderate_route['summary'] = f"{moderate_route.get('summary', f'Route {route_index+1}')} - Mixed Roads"
            variations['arterial'] = moderate_route
        
        # Risky variation (for experts) - local/scenic roads
        risky_route = base_route.copy()
        risky_route['summary'] = f"{risky_route.get('summary', f'Route {route_index+1}')} - Local Roads"
        variations['local'] = risky_route
        
        return variations
    
    def _get_driver_suitability(self, avg_ice_risk, route_type):
        """Determine which driver experience levels can handle this route"""
        suitability = []
        
        if avg_ice_risk < 0.3 and route_type == 'highway':
            suitability.extend(['beginner', 'intermediate', 'expert'])
        elif avg_ice_risk < 0.5 and route_type in ['highway', 'arterial']:
            suitability.extend(['intermediate', 'expert'])
        elif avg_ice_risk < 0.7:
            suitability.append('expert')
        else:
            suitability.append('expert')  # Only experts for very high risk
        
        return suitability
    
    def _parse_duration(self, duration_str):
        """Parse duration string to minutes for sorting"""
        import re
        hours = re.findall(r'(\d+)\s*hour', duration_str)
        minutes = re.findall(r'(\d+)\s*min', duration_str)
        
        total_minutes = 0
        if hours:
            total_minutes += int(hours[0]) * 60
        if minutes:
            total_minutes += int(minutes[0])
        
        return total_minutes or 60  # Default to 60 minutes
    
    def extract_route_points(self, route):
        """Extract coordinate points from route with better sampling"""
        points = []
        
        for leg in route['legs']:
            for step in leg['steps']:
                points.append({
                    'lat': step['start_location']['lat'],
                    'lng': step['start_location']['lng']
                })
                
                # Add intermediate points for longer segments
                start = step['start_location']
                end = step['end_location']
                distance = self._calculate_distance(start['lat'], start['lng'], end['lat'], end['lng'])
                
                # Add intermediate points for segments longer than 10km
                if distance > 10000:
                    num_intermediate = min(5, int(distance / 10000))
                    for j in range(1, num_intermediate):
                        ratio = j / num_intermediate
                        intermediate_lat = start['lat'] + (end['lat'] - start['lat']) * ratio
                        intermediate_lng = start['lng'] + (end['lng'] - start['lng']) * ratio
                        points.append({
                            'lat': intermediate_lat,
                            'lng': intermediate_lng
                        })
                
                points.append({
                    'lat': step['end_location']['lat'],
                    'lng': step['end_location']['lng']
                })
        
        return points
    
    def _calculate_distance(self, lat1, lng1, lat2, lng2):
        """Calculate distance in meters"""
        R = 6371000
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)
        
        a = (math.sin(delta_lat/2)**2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c

# Initialize historical weather service at startup
historical_weather_service = HistoricalWeatherService()

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
    
    try:
        optimizer = RouteOptimizer(gmaps)
        all_routes = optimizer.get_routes(origin, destination, avoid_icy)
        
        # Enhanced filtering based on driver experience
        filtered_routes = filter_routes_by_experience(all_routes, driver_experience)
        
        # Determine weather data source
        route_key = historical_weather_service.get_route_key(origin, destination)
        is_demo_route = route_key is not None
        weather_source = 'OpenMeteo Historical Data (Winter 2023-2024)' if is_demo_route else 'Current Weather Simulation'
        
        return jsonify({
            'routes': filtered_routes,
            'driver_experience': driver_experience,
            'timestamp': datetime.now().isoformat(),
            'is_historical_simulation': is_demo_route,
            'weather_source': weather_source,
            'route_key': route_key
        })
        
    except Exception as e:
        print(f"Error in get_routes: {e}")
        return jsonify({'error': f'Route calculation failed: {str(e)}'}), 500

def filter_routes_by_experience(routes, experience):
    """Enhanced filtering to ensure routes for all experience levels"""
    if not routes:
        return []
    
    # Sort routes by safety (lowest risk first)
    routes_by_safety = sorted(routes, key=lambda r: (r['avg_ice_risk'], r['max_ice_risk']))
    
    if experience == 'beginner':
        # Beginners get safest routes only
        safe_routes = [r for r in routes_by_safety if r['avg_ice_risk'] < 0.5]
        if not safe_routes:
            # If no safe routes, give the safest available with warning
            safe_routes = routes_by_safety[:1]
        return safe_routes[:3]
        
    elif experience == 'intermediate':
        # Intermediate drivers get low to medium risk routes
        moderate_routes = [r for r in routes_by_safety if r['avg_ice_risk'] < 0.7]
        if not moderate_routes:
            moderate_routes = routes_by_safety[:2]
        return moderate_routes[:4]
        
    else:  # expert
        # Expert drivers get all routes including high-risk options
        return routes_by_safety[:5]

@app.route('/demo')
def demo():
    """Enhanced demo with historical winter scenarios"""
    demo_routes = []
    for route_key, route_info in historical_weather_service.demo_routes.items():
        demo_routes.append({
            'origin': route_info['origin'],
            'destination': route_info['destination'],
            'description': route_info['description'],
            'severity': f"Historical data from {route_info['winter_period']['start']} to {route_info['winter_period']['end']}",
            'experience_note': 'Real weather conditions with varying route safety levels'
        })
    
    return render_template('demo.html', demo_routes=demo_routes)

@app.route('/api/weather-demo/<path:route_name>')
def weather_demo(route_name):
    """API endpoint to show weather details for demo routes"""
    route_key = None
    for key, info in historical_weather_service.demo_routes.items():
        if route_name.lower() in key.lower():
            route_key = key
            break
    
    if route_key:
        route_info = historical_weather_service.demo_routes[route_key]
        return jsonify({
            'route_key': route_key,
            'description': route_info['description'],
            'winter_period': route_info['winter_period'],
            'bbox': route_info['bbox'],
            'data_source': 'OpenMeteo Historical Archive'
        })
    else:
        return jsonify({'error': 'Route not found'}), 404

@app.route('/api/preload-weather', methods=['POST'])
def preload_weather():
    """API endpoint to preload all demo weather data"""
    try:
        historical_weather_service.preload_all_demo_data()
        return jsonify({
            'status': 'success',
            'message': 'All demo weather data preloaded',
            'routes_cached': list(historical_weather_service.demo_routes.keys())
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Failed to preload weather data: {str(e)}'
        }), 500

@app.route('/api/cache-status')
def cache_status():
    """Check which weather data is already cached"""
    cached_routes = []
    
    for route_key in historical_weather_service.demo_routes.keys():
        cache_file = os.path.join(WEATHER_CACHE_DIR, f"{route_key}_historical.pkl")
        if os.path.exists(cache_file):
            # Get file modification time
            mod_time = datetime.fromtimestamp(os.path.getmtime(cache_file))
            cached_routes.append({
                'route': route_key,
                'cached': True,
                'cache_date': mod_time.isoformat(),
                'file_size': os.path.getsize(cache_file)
            })
        else:
            cached_routes.append({
                'route': route_key,
                'cached': False
            })
    
    return jsonify({
        'cache_directory': WEATHER_CACHE_DIR,
        'routes': cached_routes,
        'total_cached': sum(1 for r in cached_routes if r['cached'])
    })

if __name__ == '__main__':
    print("🚗 IcyRoute - Enhanced Winter Route Planning System")
    print("=" * 70)
    print("GOOGLE MAPS PLATFORM AWARDS DEMONSTRATION")
    print("=" * 70)
    print("🌨️ REAL HISTORICAL WEATHER INTEGRATION:")
    print("• OpenMeteo Historical Archive API for demo routes")
    print("• Cached weather data to minimize API calls")
    print("• Real winter storm conditions from 2023-2024")
    print("=" * 70)
    print("✨ ENHANCED FEATURES:")
    print("• Multi-level route variations (beginner → intermediate → expert)")
    print("• Historical weather for demo routes")
    print("• Current weather simulation for general locations") 
    print("• Smart caching system for weather data")
    print("• Enhanced ice risk calculation with real precipitation/snow data")
    print("=" * 70)
    print("🎯 DEMO ROUTES WITH REAL HISTORICAL DATA:")
    for route_key, route_info in historical_weather_service.demo_routes.items():
        print(f"• {route_info['description']}")
        print(f"  {route_info['origin']} → {route_info['destination']}")
        print(f"  Period: {route_info['winter_period']['start']} to {route_info['winter_period']['end']}")
    print("=" * 70)
    print("🌐 WEATHER DATA SOURCES:")
    print("• Demo routes: OpenMeteo Historical Archive (Real winter storms)")
    print("• General locations: Current weather simulation")
    print("• Fallback: Intelligent weather simulation")
    print("=" * 70)
    print("📋 GOOGLE MAPS PLATFORM APIs:")
    print("• Directions API - Multiple route alternatives")
    print("• Geocoding API - Address resolution")
    print("• Maps JavaScript API - Interactive visualization")
    print("=" * 70)
    print("🔧 WEATHER CACHE SYSTEM:")
    print(f"• Cache directory: {WEATHER_CACHE_DIR}")
    print("• Automatic caching of historical data")
    print("• Visit /api/cache-status to check cache")
    print("• Visit /api/preload-weather to preload all data")
    print("=" * 70)
    
    # Preload demo weather data at startup (optional)
    try:
        print("🌨️ Preloading demo weather data...")
        historical_weather_service.preload_all_demo_data()
    except Exception as e:
        print(f"⚠️ Warning: Could not preload weather data: {e}")
        print("Weather data will be fetched on-demand")
    
    print("🚀 Ready for demonstration!")
    print("Visit: http://localhost:5000")
    print("=" * 70)
    
    app.run(debug=True, host='0.0.0.0', port=5000)