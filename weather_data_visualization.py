#!/usr/bin/env python3
"""
Weather Data Export Script
Loads cached weather .pkl files and exports to Excel format with timestamps
"""

import pickle
import pandas as pd
import os
from datetime import datetime
import argparse

def load_and_export_weather_data(pkl_file_path, output_excel_path=None):
    """
    Load weather data from .pkl file and export to Excel
    
    Args:
        pkl_file_path (str): Path to the .pkl file
        output_excel_path (str): Output Excel file path (optional)
    """
    try:
        # Load the pickle file
        print(f"Loading weather data from: {pkl_file_path}")
        with open(pkl_file_path, 'rb') as f:
            weather_data = pickle.load(f)
        
        print(f"Loaded {len(weather_data)} weather stations")
        
        # Process all weather stations into a single DataFrame
        all_records = []
        
        for station_idx, station_data in enumerate(weather_data):
            if isinstance(station_data, dict) and 'location' in station_data:
                location = station_data['location']
                weather_df = station_data  # This should be the DataFrame
                
                # Find the DataFrame in the station data
                df = None
                for key, value in station_data.items():
                    if isinstance(value, pd.DataFrame):
                        df = value.copy()
                        break
                
                if df is not None:
                    # Add location information to each row
                    df['station_id'] = station_idx
                    df['latitude'] = location['lat']
                    df['longitude'] = location['lng']
                    
                    # Reorder columns for better readability
                    column_order = [
                        'station_id', 'date', 'latitude', 'longitude',
                        'temperature_mean', 'temperature_max', 'temperature_min',
                        'precipitation_sum', 'snowfall_sum', 'rain_sum',
                        'humidity_max', 'humidity_min',
                        'wind_speed_max', 'wind_speed_mean'
                    ]
                    
                    # Only include columns that exist
                    available_columns = [col for col in column_order if col in df.columns]
                    df = df[available_columns]
                    
                    all_records.append(df)
                else:
                    print(f"Warning: No DataFrame found in station {station_idx}")
        
        if not all_records:
            print("Error: No valid weather data found in the pickle file")
            return
        
        # Combine all records
        combined_df = pd.concat(all_records, ignore_index=True)
        
        # Sort by station and date
        combined_df = combined_df.sort_values(['station_id', 'date'])
        
        # Generate output filename if not provided
        if output_excel_path is None:
            base_name = os.path.splitext(os.path.basename(pkl_file_path))[0]
            output_excel_path = f"{base_name}_weather_export.xlsx"
        
        # Export to Excel with multiple sheets
        print(f"Exporting to Excel: {output_excel_path}")
        
        with pd.ExcelWriter(output_excel_path, engine='openpyxl') as writer:
            # Main data sheet
            combined_df.to_excel(writer, sheet_name='Weather_Data', index=False)
            
            # Summary sheet
            summary_data = {
                'Export_Info': [
                    f"Source File: {pkl_file_path}",
                    f"Export Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                    f"Total Records: {len(combined_df)}",
                    f"Weather Stations: {combined_df['station_id'].nunique()}",
                    f"Date Range: {combined_df['date'].min()} to {combined_df['date'].max()}",
                    f"Temperature Range: {combined_df['temperature_mean'].min():.1f}°C to {combined_df['temperature_mean'].max():.1f}°C",
                    f"Max Precipitation: {combined_df['precipitation_sum'].max():.1f}mm",
                    f"Max Snowfall: {combined_df['snowfall_sum'].max():.1f}mm"
                ]
            }
            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, sheet_name='Summary', index=False)
            
            # Statistics by station
            station_stats = combined_df.groupby('station_id').agg({
                'latitude': 'first',
                'longitude': 'first',
                'temperature_mean': ['mean', 'min', 'max'],
                'precipitation_sum': ['mean', 'max'],
                'snowfall_sum': ['mean', 'max'],
                'date': 'count'
            }).round(2)
            
            # Flatten column names
            station_stats.columns = ['_'.join(col).strip() for col in station_stats.columns.values]
            station_stats = station_stats.reset_index()
            
            station_stats.to_excel(writer, sheet_name='Station_Statistics', index=False)
        
        print(f"✅ Successfully exported weather data to {output_excel_path}")
        print(f"📊 Records exported: {len(combined_df)}")
        print(f"🌡️ Temperature range: {combined_df['temperature_mean'].min():.1f}°C to {combined_df['temperature_mean'].max():.1f}°C")
        print(f"❄️ Max snowfall: {combined_df['snowfall_sum'].max():.1f}mm")
        print(f"🌧️ Max precipitation: {combined_df['precipitation_sum'].max():.1f}mm")
        
    except Exception as e:
        print(f"❌ Error processing weather data: {e}")
        import traceback
        traceback.print_exc()

def export_all_cached_weather_data(cache_directory="weather_cache", output_directory="weather_exports"):
    """
    Export all cached weather .pkl files to Excel format
    
    Args:
        cache_directory (str): Directory containing .pkl files
        output_directory (str): Directory to save Excel files
    """
    if not os.path.exists(cache_directory):
        print(f"❌ Cache directory not found: {cache_directory}")
        return
    
    # Create output directory
    os.makedirs(output_directory, exist_ok=True)
    
    # Find all .pkl files
    pkl_files = [f for f in os.listdir(cache_directory) if f.endswith('.pkl')]
    
    if not pkl_files:
        print(f"❌ No .pkl files found in {cache_directory}")
        return
    
    print(f"🔍 Found {len(pkl_files)} weather cache files")
    
    for pkl_file in pkl_files:
        pkl_path = os.path.join(cache_directory, pkl_file)
        excel_name = pkl_file.replace('.pkl', '_weather_data.xlsx')
        excel_path = os.path.join(output_directory, excel_name)
        
        print(f"\n📁 Processing: {pkl_file}")
        load_and_export_weather_data(pkl_path, excel_path)

def main():
    parser = argparse.ArgumentParser(description='Export IcyRoute weather cache data to Excel')
    parser.add_argument('--file', '-f', help='Specific .pkl file to export')
    parser.add_argument('--output', '-o', help='Output Excel file path')
    parser.add_argument('--cache-dir', '-c', default='weather_cache', help='Weather cache directory')
    parser.add_argument('--export-dir', '-e', default='weather_exports', help='Export directory for Excel files')
    parser.add_argument('--all', '-a', action='store_true', help='Export all cached weather files')
    
    args = parser.parse_args()
    
    if args.all:
        # Export all cached files
        export_all_cached_weather_data(args.cache_dir, args.export_dir)
    elif args.file:
        # Export specific file
        load_and_export_weather_data(args.file, args.output)
    else:
        # Interactive mode
        print("🌨️ IcyRoute Weather Data Export Tool")
        print("=" * 50)
        
        # List available cache files
        cache_dir = args.cache_dir
        if os.path.exists(cache_dir):
            pkl_files = [f for f in os.listdir(cache_dir) if f.endswith('.pkl')]
            if pkl_files:
                print("📁 Available weather cache files:")
                for i, file in enumerate(pkl_files, 1):
                    print(f"  {i}. {file}")
                
                try:
                    choice = input(f"\nSelect file (1-{len(pkl_files)}) or 'all' for all files: ").strip()
                    
                    if choice.lower() == 'all':
                        export_all_cached_weather_data(cache_dir, args.export_dir)
                    else:
                        idx = int(choice) - 1
                        if 0 <= idx < len(pkl_files):
                            selected_file = os.path.join(cache_dir, pkl_files[idx])
                            load_and_export_weather_data(selected_file)
                        else:
                            print("❌ Invalid selection")
                except (ValueError, KeyboardInterrupt):
                    print("\n👋 Export cancelled")
            else:
                print(f"❌ No .pkl files found in {cache_dir}")
        else:
            print(f"❌ Cache directory not found: {cache_dir}")
            print("💡 Run your IcyRoute app first to generate weather cache files")

if __name__ == "__main__":
    main()