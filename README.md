# 🚗 IcyRoute - Smart Winter Route Planning System

[![Google Maps Platform](https://img.shields.io/badge/Google%20Maps-Platform-4285F4?style=for-the-badge&logo=googlemaps)](https://developers.google.com/maps)
[![Python](https://img.shields.io/badge/Python-3.7+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-2.3.3-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)

**A proof-of-concept application for the Google Maps Platform Awards hackathon that addresses winter driving safety by providing ice-aware route planning.**

## 🎯 Project Overview

IcyRoute helps drivers navigate safely during winter conditions by:
- Analyzing real-time weather data to detect ice risk
- Providing multiple route options with color-coded risk levels
- Filtering routes based on driver experience (beginner/intermediate/expert)
- Displaying interactive maps with visual route comparisons


## 🌟 Key Features

### 🗺️ Interactive Route Visualization
- **Google Maps Integration**: Full interactive map with zoom, pan, and street view
- **Color-Coded Routes**: Routes displayed with different colors based on ice risk levels
- **Multiple Route Options**: Up to 3 alternative routes with detailed comparisons
- **Interactive Controls**: Show/hide routes, focus on specific routes, fit map to bounds

### 🧊 Smart Ice Risk Assessment
- **Weather Analysis**: Real-time temperature, humidity, precipitation, and wind data
- **Risk Calculation**: Proprietary algorithm considering multiple weather factors
- **Geographic Intelligence**: Higher risk assessment for northern latitudes and known problem areas
- **Experience-Based Filtering**: Routes filtered based on driver skill level

### 🎨 Risk Level Color Coding
- 🟢 **Minimal Risk** (Green): Safe driving conditions
- 🟡 **Low Risk** (Yellow): Minor ice possible, caution advised
- 🟠 **Medium Risk** (Orange): Moderate ice risk, experienced drivers
- 🔴 **High Risk** (Red): Dangerous conditions, avoid if possible

## 🏗️ Google Maps Platform APIs Used

This project demonstrates comprehensive integration with Google's ecosystem:

1. **Maps JavaScript API** - Interactive map display and controls
2. **Directions API** - Route calculation and alternatives
3. **Geocoding API** - Address to coordinates conversion
4. **Places API** - Location search and validation
5. **Weather API** - Real-time weather conditions (with simulation fallback)

## 🎯 Hackathon Compliance

✅ **Google Maps Platform Integration**: Uses 5 different Google APIs  
✅ **Original Project**: Built specifically for this hackathon  
✅ **Published Working Software**: Functional web application  
✅ **Real-World Problem**: Addresses winter driving safety - a major cause of accidents

## 🚀 Quick Start

### Prerequisites
- Python 3.7+
- Google Cloud Platform account
- Google Maps Platform API key

### 1. Clone the Repository
```bash
git clone https://github.com/Eashwar-S/Google_maps_platform_hackathon.git
cd Google_maps_platform_hackathon
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Set Up Google Cloud APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the following APIs:
   - **Maps JavaScript API** ⭐ (Essential)
   - **Directions API**
   - **Geocoding API**
   - **Places API**
   - **Weather API** (if available)
4. Create an API key
5. (Optional) Restrict API key to `http://localhost:5000/*`

### 4. Configure Environment Variables
Create a `.env` file in the project root:
```bash
GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

### 5. Run the Application
```bash
python app.py
```

### 6. Access the Web App
Open your browser and navigate to:
```
http://localhost:5000
```

## 📁 Project Structure

```
Google_maps_platform_hackathon/
├── README.md                 # Project documentation
├── requirements.txt          # Python dependencies
├── .env                     # Environment variables (create this)
├── .gitignore              # Git ignore file
├── app.py                  # Main Flask application
└── templates/
    └── index.html          # Web interface template
```

## 🧪 Demo Routes

The application includes pre-configured demo routes in high ice-risk areas:

### 🌨️ Minneapolis, MN → Duluth, MN
- **I-35 corridor** known for severe ice storms
- **Lake effect weather** conditions
- **Historical accident data** shows high winter risk

### 🌨️ Buffalo, NY → Rochester, NY
- **Lake effect snow/ice** region
- **Heavy winter precipitation** patterns
- **Frequent freezing rain** events

### 🌨️ Detroit, MI → Grand Rapids, MI
- **Michigan winter conditions** with temperature fluctuations
- **Frequent freezing rain** and black ice
- **Urban to rural** transition weather patterns


### Route Filtering by Experience Level
- **Beginner**: Only routes with minimal (0-30%) and low (30-60%) ice risk
- **Intermediate**: Routes up to medium risk (60-80%)
- **Expert**: All routes displayed with clear risk warnings

### Weather Data Processing
- **Sampling Interval**: Weather checked every 50km along route
- **Data Sources**: Google Weather API with realistic simulation fallback
- **Real-time Analysis**: Current conditions processed for immediate route planning

## 🎨 User Interface Features

### Interactive Map Controls
- **Show All Routes**: Display all calculated route options
- **Hide All Routes**: Clear map for better visibility
- **Fit to Routes**: Auto-zoom to show all routes optimally
- **Route Selection**: Click any route card to highlight on map

### Responsive Design
- **Desktop Optimized**: Split-screen layout with sidebar controls
- **Mobile Friendly**: Stacked layout for smaller screens
- **Touch Interactions**: Full touch support for mobile devices

### Visual Feedback
- **Loading States**: Spinner and progress indicators
- **Error Handling**: Clear error messages and fallback options
- **Route Highlighting**: Visual feedback for selected routes

## 📊 Data Sources & APIs

### Weather Data Integration
- **Primary**: Google Weather API (when available)
- **Fallback**: Realistic weather simulation for demo purposes
- **Update Frequency**: Real-time data processing
- **Geographic Coverage**: Focus on North American winter regions

### Route Calculation
- **Algorithm**: Google Directions API with multiple alternatives
- **Optimization**: Balanced approach considering time, distance, and safety
- **Real-time Traffic**: Integration with current traffic conditions
- **Alternative Routes**: Up to 3 different path options

## 🚀 Future Enhancements

### Machine Learning Integration
- **Historical Data**: Integrate accident databases with weather patterns
- **Predictive Modeling**: Forecast ice conditions based on weather trends
- **User Feedback**: Learn from user-reported road conditions

### Advanced Features
- **Real-time Traffic**: Enhanced integration with traffic conditions
- **Community Reports**: User-submitted road condition updates
- **Fleet Management**: Commercial vehicle route optimization
- **Mobile Apps**: Native iOS/Android applications

### Enterprise Features
- **API Integration**: RESTful API for third-party integration
- **Fleet Dashboards**: Real-time monitoring for vehicle fleets
- **Emergency Services**: Integration with road maintenance crews
- **Insurance Integration**: Risk assessment for insurance companies

## 🔐 Security & Best Practices

### Environment Variables
```bash
# .env file structure
GOOGLE_MAPS_API_KEY=your_api_key_here
FLASK_ENV=development
FLASK_DEBUG=True
```

### API Key Security
- ✅ Never commit API keys to version control
- ✅ Use environment variables for all sensitive data
- ✅ Implement API key restrictions in Google Cloud Console
- ✅ Add rate limiting for production deployments

### Production Considerations
- ✅ Enable HTTPS for all API communications
- ✅ Implement proper error handling and logging
- ✅ Add user authentication for personalized features
- ✅ Set up monitoring and alerting

## 🛠️ Development Setup

### Local Development
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install development dependencies
pip install -r requirements.txt

# Set up pre-commit hooks (optional)
pre-commit install

# Run in development mode
export FLASK_ENV=development
python app.py
```

## 📋 Dependencies

### Core Requirements
```txt
Flask==2.3.3              # Web framework
googlemaps==4.10.0         # Google Maps API client
requests==2.31.0           # HTTP requests
python-dotenv==1.0.0       # Environment variable management
```

### Optional Dependencies
```txt
gunicorn==20.1.0          # Production WSGI server
pytest==7.4.0            # Testing framework
black==23.3.0             # Code formatting
flake8==6.0.0            # Code linting
```

## 🐛 Troubleshooting

### Common Issues

**"This page didn't load Google Maps correctly"**
- ✅ Verify API key is correct in `.env` file
- ✅ Ensure Maps JavaScript API is enabled
- ✅ Check API key restrictions in Google Cloud Console

**"GOOGLE_MAPS_API_KEY environment variable is required"**
- ✅ Create `.env` file in project root
- ✅ Install `python-dotenv` package
- ✅ Restart the application after creating `.env`

**Routes not displaying on map**
- ✅ Check that Directions API is enabled
- ✅ Verify API key has proper permissions
- ✅ Ensure billing is enabled in Google Cloud Console

**Weather data not loading**
- ✅ Application includes simulation fallback
- ✅ Check browser console for API errors
- ✅ Verify network connectivity

### Getting Help
- 📖 [Google Maps Platform Documentation](https://developers.google.com/maps)
- 🆘 [Google Cloud Support](https://console.cloud.google.com/)
- 💬 [Flask Documentation](https://flask.palletsprojects.com/)
- 🐛 [Report Issues](https://github.com/yourusername/Google_maps_platform_hackathon/issues)

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🏆 Hackathon Submission

**Built for: Google Maps Platform Awards Hackathon 2025**

This project demonstrates:
- ✅ Innovative use of Google Maps Platform APIs
- ✅ Real-world problem solving (winter driving safety)
- ✅ Technical excellence and code quality
- ✅ User experience and interface design
- ✅ Potential for real-world deployment

## 👥 Team

- **Developer**: [Eashwar Sathyamurthy](https://www.linkedin.com/in/eashwar-sathyamurthy/)
- **Project**: Google Maps Platform Hackathon Entry
- **Date**: 2025

## 🙏 Acknowledgments

- Google Maps Platform team for excellent APIs and documentation
- Weather data providers for enabling real-time conditions
- Winter driving safety organizations for problem inspiration
- Open source community for tools and libraries

---

**⭐ If you found this project helpful, please give it a star on GitHub!**

**🚗 Drive safely this winter with IcyRoute!**