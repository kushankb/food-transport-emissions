#!/usr/bin/env python3
"""
Preprocessing script for the Transport Emissions Dashboard.

Reads source CSVs (global, commodity, consumer country, producer country,
bilateral flows, transport factors) and writes optimised JSON files that the
React front-end can fetch at runtime.

Usage:
    python preprocess.py
"""

import json
import math
import sys
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent                              # fao-emissions-dashboard/
BASE_DIR = PROJECT_DIR.parent                                # Consumption_based_emissions/
TIMESERIES_DIR = BASE_DIR / "Output" / "TimeSeries_withModeSplitTrade"
OUTPUT_DIR = PROJECT_DIR / "public" / "data"
TRANSPORT_FACTORS_DIR = Path(
    "/Users/kushankbajaj/Desktop/data/GlobalDigitalTwin/"
    "Transport_emissions_data/Bilateral_emission_factors_modified"
)

# Ensure output directory exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
PRELIMINARY_YEARS = [2024]
EXCLUDE_YEARS = {2024}  # Years to exclude from all output
TOP_N_BILATERAL_PER_MODE = 100
TOP_N_BILATERAL_PER_COMMODITY = 50
BILATERAL_CHUNKSIZE = 500_000

# ---------------------------------------------------------------------------
# Country metadata  (197 ISO-3166-1 alpha-3 codes that appear in the data)
# ---------------------------------------------------------------------------
COUNTRY_META: dict[str, dict] = {
    "AFG": {"name": "Afghanistan", "lat": 33.94, "lng": 67.71, "region": "Southern Asia"},
    "AGO": {"name": "Angola", "lat": -11.20, "lng": 17.87, "region": "Middle Africa"},
    "ALB": {"name": "Albania", "lat": 41.15, "lng": 20.17, "region": "Southern Europe"},
    "ARE": {"name": "United Arab Emirates", "lat": 23.42, "lng": 53.85, "region": "Western Asia"},
    "ARG": {"name": "Argentina", "lat": -38.42, "lng": -63.62, "region": "South America"},
    "ARM": {"name": "Armenia", "lat": 40.07, "lng": 45.04, "region": "Western Asia"},
    "ATG": {"name": "Antigua and Barbuda", "lat": 17.06, "lng": -61.80, "region": "Caribbean"},
    "AUS": {"name": "Australia", "lat": -25.27, "lng": 133.78, "region": "Oceania"},
    "AUT": {"name": "Austria", "lat": 47.52, "lng": 14.55, "region": "Western Europe"},
    "AZE": {"name": "Azerbaijan", "lat": 40.14, "lng": 47.58, "region": "Western Asia"},
    "BDI": {"name": "Burundi", "lat": -3.37, "lng": 29.92, "region": "Eastern Africa"},
    "BEL": {"name": "Belgium", "lat": 50.50, "lng": 4.47, "region": "Western Europe"},
    "BEN": {"name": "Benin", "lat": 9.31, "lng": 2.32, "region": "Western Africa"},
    "BFA": {"name": "Burkina Faso", "lat": 12.24, "lng": -1.56, "region": "Western Africa"},
    "BGD": {"name": "Bangladesh", "lat": 23.68, "lng": 90.36, "region": "Southern Asia"},
    "BGR": {"name": "Bulgaria", "lat": 42.73, "lng": 25.49, "region": "Eastern Europe"},
    "BHR": {"name": "Bahrain", "lat": 26.07, "lng": 50.56, "region": "Western Asia"},
    "BHS": {"name": "Bahamas", "lat": 25.03, "lng": -77.40, "region": "Caribbean"},
    "BIH": {"name": "Bosnia and Herzegovina", "lat": 43.92, "lng": 17.68, "region": "Southern Europe"},
    "BLR": {"name": "Belarus", "lat": 53.71, "lng": 27.95, "region": "Eastern Europe"},
    "BLZ": {"name": "Belize", "lat": 17.19, "lng": -88.50, "region": "Central America"},
    "BOL": {"name": "Bolivia", "lat": -16.29, "lng": -63.59, "region": "South America"},
    "BRA": {"name": "Brazil", "lat": -14.24, "lng": -51.93, "region": "South America"},
    "BRB": {"name": "Barbados", "lat": 13.19, "lng": -59.54, "region": "Caribbean"},
    "BRN": {"name": "Brunei Darussalam", "lat": 4.54, "lng": 114.73, "region": "South-Eastern Asia"},
    "BTN": {"name": "Bhutan", "lat": 27.51, "lng": 90.43, "region": "Southern Asia"},
    "BWA": {"name": "Botswana", "lat": -22.33, "lng": 24.68, "region": "Southern Africa"},
    "CAF": {"name": "Central African Republic", "lat": 6.61, "lng": 20.94, "region": "Middle Africa"},
    "CAN": {"name": "Canada", "lat": 56.13, "lng": -106.35, "region": "Northern America"},
    "CHE": {"name": "Switzerland", "lat": 46.82, "lng": 8.23, "region": "Western Europe"},
    "CHL": {"name": "Chile", "lat": -35.68, "lng": -71.54, "region": "South America"},
    "CHN": {"name": "China", "lat": 35.86, "lng": 104.20, "region": "Eastern Asia"},
    "CIV": {"name": "Cote d'Ivoire", "lat": 7.54, "lng": -5.55, "region": "Western Africa"},
    "CMR": {"name": "Cameroon", "lat": 7.37, "lng": 12.35, "region": "Middle Africa"},
    "COD": {"name": "Democratic Republic of the Congo", "lat": -4.04, "lng": 21.76, "region": "Middle Africa"},
    "COG": {"name": "Congo", "lat": -0.23, "lng": 15.83, "region": "Middle Africa"},
    "COK": {"name": "Cook Islands", "lat": -21.24, "lng": -159.78, "region": "Oceania"},
    "COL": {"name": "Colombia", "lat": 4.57, "lng": -74.30, "region": "South America"},
    "COM": {"name": "Comoros", "lat": -11.88, "lng": 43.87, "region": "Eastern Africa"},
    "CPV": {"name": "Cabo Verde", "lat": 16.00, "lng": -24.01, "region": "Western Africa"},
    "CRI": {"name": "Costa Rica", "lat": 9.75, "lng": -83.75, "region": "Central America"},
    "CUB": {"name": "Cuba", "lat": 21.52, "lng": -77.78, "region": "Caribbean"},
    "CYP": {"name": "Cyprus", "lat": 35.13, "lng": 33.43, "region": "Western Asia"},
    "CZE": {"name": "Czechia", "lat": 49.82, "lng": 15.47, "region": "Eastern Europe"},
    "DEU": {"name": "Germany", "lat": 51.17, "lng": 10.45, "region": "Western Europe"},
    "DJI": {"name": "Djibouti", "lat": 11.83, "lng": 42.59, "region": "Eastern Africa"},
    "DMA": {"name": "Dominica", "lat": 15.41, "lng": -61.37, "region": "Caribbean"},
    "DNK": {"name": "Denmark", "lat": 56.26, "lng": 9.50, "region": "Northern Europe"},
    "DOM": {"name": "Dominican Republic", "lat": 18.74, "lng": -70.16, "region": "Caribbean"},
    "DZA": {"name": "Algeria", "lat": 28.03, "lng": 1.66, "region": "Northern Africa"},
    "ECU": {"name": "Ecuador", "lat": -1.83, "lng": -78.18, "region": "South America"},
    "EGY": {"name": "Egypt", "lat": 26.82, "lng": 30.80, "region": "Northern Africa"},
    "ERI": {"name": "Eritrea", "lat": 15.18, "lng": 39.78, "region": "Eastern Africa"},
    "ESP": {"name": "Spain", "lat": 40.46, "lng": -3.75, "region": "Southern Europe"},
    "EST": {"name": "Estonia", "lat": 58.60, "lng": 25.01, "region": "Northern Europe"},
    "ETH": {"name": "Ethiopia", "lat": 9.15, "lng": 40.49, "region": "Eastern Africa"},
    "FIN": {"name": "Finland", "lat": 61.92, "lng": 25.75, "region": "Northern Europe"},
    "FJI": {"name": "Fiji", "lat": -17.71, "lng": 178.07, "region": "Oceania"},
    "FRA": {"name": "France", "lat": 46.23, "lng": 2.21, "region": "Western Europe"},
    "FRO": {"name": "Faroe Islands", "lat": 61.89, "lng": -6.91, "region": "Northern Europe"},
    "FSM": {"name": "Micronesia", "lat": 7.43, "lng": 150.55, "region": "Oceania"},
    "GAB": {"name": "Gabon", "lat": -0.80, "lng": 11.61, "region": "Middle Africa"},
    "GBR": {"name": "United Kingdom", "lat": 55.38, "lng": -3.44, "region": "Northern Europe"},
    "GEO": {"name": "Georgia", "lat": 42.32, "lng": 43.36, "region": "Western Asia"},
    "GHA": {"name": "Ghana", "lat": 7.95, "lng": -1.02, "region": "Western Africa"},
    "GIN": {"name": "Guinea", "lat": 9.95, "lng": -9.70, "region": "Western Africa"},
    "GMB": {"name": "Gambia", "lat": 13.44, "lng": -15.31, "region": "Western Africa"},
    "GNB": {"name": "Guinea-Bissau", "lat": 11.80, "lng": -15.18, "region": "Western Africa"},
    "GNQ": {"name": "Equatorial Guinea", "lat": 1.65, "lng": 10.27, "region": "Middle Africa"},
    "GRC": {"name": "Greece", "lat": 39.07, "lng": 21.82, "region": "Southern Europe"},
    "GRD": {"name": "Grenada", "lat": 12.26, "lng": -61.60, "region": "Caribbean"},
    "GTM": {"name": "Guatemala", "lat": 15.78, "lng": -90.23, "region": "Central America"},
    "GUY": {"name": "Guyana", "lat": 4.86, "lng": -58.93, "region": "South America"},
    "HKG": {"name": "Hong Kong", "lat": 22.40, "lng": 114.11, "region": "Eastern Asia"},
    "HND": {"name": "Honduras", "lat": 15.20, "lng": -86.24, "region": "Central America"},
    "HRV": {"name": "Croatia", "lat": 45.10, "lng": 15.20, "region": "Southern Europe"},
    "HTI": {"name": "Haiti", "lat": 18.97, "lng": -72.29, "region": "Caribbean"},
    "HUN": {"name": "Hungary", "lat": 47.16, "lng": 19.50, "region": "Eastern Europe"},
    "IDN": {"name": "Indonesia", "lat": -0.79, "lng": 113.92, "region": "South-Eastern Asia"},
    "IND": {"name": "India", "lat": 20.59, "lng": 78.96, "region": "Southern Asia"},
    "IRL": {"name": "Ireland", "lat": 53.14, "lng": -7.69, "region": "Northern Europe"},
    "IRN": {"name": "Iran", "lat": 32.43, "lng": 53.69, "region": "Southern Asia"},
    "IRQ": {"name": "Iraq", "lat": 33.22, "lng": 43.68, "region": "Western Asia"},
    "ISL": {"name": "Iceland", "lat": 64.96, "lng": -19.02, "region": "Northern Europe"},
    "ISR": {"name": "Israel", "lat": 31.05, "lng": 34.85, "region": "Western Asia"},
    "ITA": {"name": "Italy", "lat": 41.87, "lng": 12.57, "region": "Southern Europe"},
    "JAM": {"name": "Jamaica", "lat": 18.11, "lng": -77.30, "region": "Caribbean"},
    "JOR": {"name": "Jordan", "lat": 30.59, "lng": 36.24, "region": "Western Asia"},
    "JPN": {"name": "Japan", "lat": 36.20, "lng": 138.25, "region": "Eastern Asia"},
    "KAZ": {"name": "Kazakhstan", "lat": 48.02, "lng": 66.92, "region": "Central Asia"},
    "KEN": {"name": "Kenya", "lat": -0.02, "lng": 37.91, "region": "Eastern Africa"},
    "KGZ": {"name": "Kyrgyzstan", "lat": 41.20, "lng": 74.77, "region": "Central Asia"},
    "KHM": {"name": "Cambodia", "lat": 12.57, "lng": 104.99, "region": "South-Eastern Asia"},
    "KNA": {"name": "Saint Kitts and Nevis", "lat": 17.36, "lng": -62.78, "region": "Caribbean"},
    "KOR": {"name": "Republic of Korea", "lat": 35.91, "lng": 127.77, "region": "Eastern Asia"},
    "KWT": {"name": "Kuwait", "lat": 29.31, "lng": 47.48, "region": "Western Asia"},
    "LAO": {"name": "Lao People's Democratic Republic", "lat": 19.86, "lng": 102.50, "region": "South-Eastern Asia"},
    "LBN": {"name": "Lebanon", "lat": 33.85, "lng": 35.86, "region": "Western Asia"},
    "LBR": {"name": "Liberia", "lat": 6.43, "lng": -9.43, "region": "Western Africa"},
    "LBY": {"name": "Libya", "lat": 26.34, "lng": 17.23, "region": "Northern Africa"},
    "LCA": {"name": "Saint Lucia", "lat": 13.91, "lng": -60.98, "region": "Caribbean"},
    "LKA": {"name": "Sri Lanka", "lat": 7.87, "lng": 80.77, "region": "Southern Asia"},
    "LSO": {"name": "Lesotho", "lat": -29.61, "lng": 28.23, "region": "Southern Africa"},
    "LTU": {"name": "Lithuania", "lat": 55.17, "lng": 23.88, "region": "Northern Europe"},
    "LUX": {"name": "Luxembourg", "lat": 49.82, "lng": 6.13, "region": "Western Europe"},
    "LVA": {"name": "Latvia", "lat": 56.88, "lng": 24.60, "region": "Northern Europe"},
    "MAC": {"name": "Macao", "lat": 22.20, "lng": 113.54, "region": "Eastern Asia"},
    "MAR": {"name": "Morocco", "lat": 31.79, "lng": -7.09, "region": "Northern Africa"},
    "MDA": {"name": "Moldova", "lat": 47.41, "lng": 28.37, "region": "Eastern Europe"},
    "MDG": {"name": "Madagascar", "lat": -18.77, "lng": 46.87, "region": "Eastern Africa"},
    "MDV": {"name": "Maldives", "lat": 3.20, "lng": 73.22, "region": "Southern Asia"},
    "MEX": {"name": "Mexico", "lat": 23.63, "lng": -102.55, "region": "Central America"},
    "MHL": {"name": "Marshall Islands", "lat": 7.13, "lng": 171.18, "region": "Oceania"},
    "MKD": {"name": "North Macedonia", "lat": 41.51, "lng": 21.75, "region": "Southern Europe"},
    "MLI": {"name": "Mali", "lat": 17.57, "lng": -4.00, "region": "Western Africa"},
    "MLT": {"name": "Malta", "lat": 35.94, "lng": 14.38, "region": "Southern Europe"},
    "MMR": {"name": "Myanmar", "lat": 21.91, "lng": 95.96, "region": "South-Eastern Asia"},
    "MNE": {"name": "Montenegro", "lat": 42.71, "lng": 19.37, "region": "Southern Europe"},
    "MNG": {"name": "Mongolia", "lat": 46.86, "lng": 103.85, "region": "Eastern Asia"},
    "MOZ": {"name": "Mozambique", "lat": -18.67, "lng": 35.53, "region": "Eastern Africa"},
    "MRT": {"name": "Mauritania", "lat": 21.01, "lng": -10.94, "region": "Western Africa"},
    "MUS": {"name": "Mauritius", "lat": -20.35, "lng": 57.55, "region": "Eastern Africa"},
    "MWI": {"name": "Malawi", "lat": -13.25, "lng": 34.30, "region": "Eastern Africa"},
    "MYS": {"name": "Malaysia", "lat": 4.21, "lng": 101.98, "region": "South-Eastern Asia"},
    "NAM": {"name": "Namibia", "lat": -22.96, "lng": 18.49, "region": "Southern Africa"},
    "NCL": {"name": "New Caledonia", "lat": -20.90, "lng": 165.62, "region": "Oceania"},
    "NER": {"name": "Niger", "lat": 17.61, "lng": 8.08, "region": "Western Africa"},
    "NGA": {"name": "Nigeria", "lat": 9.08, "lng": 8.68, "region": "Western Africa"},
    "NIC": {"name": "Nicaragua", "lat": 12.87, "lng": -85.21, "region": "Central America"},
    "NIU": {"name": "Niue", "lat": -19.05, "lng": -169.87, "region": "Oceania"},
    "NLD": {"name": "Netherlands", "lat": 52.13, "lng": 5.29, "region": "Western Europe"},
    "NOR": {"name": "Norway", "lat": 60.47, "lng": 8.47, "region": "Northern Europe"},
    "NPL": {"name": "Nepal", "lat": 28.39, "lng": 84.12, "region": "Southern Asia"},
    "NRU": {"name": "Nauru", "lat": -0.52, "lng": 166.93, "region": "Oceania"},
    "NZL": {"name": "New Zealand", "lat": -40.90, "lng": 174.89, "region": "Oceania"},
    "OMN": {"name": "Oman", "lat": 21.47, "lng": 55.98, "region": "Western Asia"},
    "PAK": {"name": "Pakistan", "lat": 30.38, "lng": 69.35, "region": "Southern Asia"},
    "PAN": {"name": "Panama", "lat": 8.54, "lng": -80.78, "region": "Central America"},
    "PER": {"name": "Peru", "lat": -9.19, "lng": -75.02, "region": "South America"},
    "PHL": {"name": "Philippines", "lat": 12.88, "lng": 121.77, "region": "South-Eastern Asia"},
    "PNG": {"name": "Papua New Guinea", "lat": -6.31, "lng": 143.96, "region": "Oceania"},
    "POL": {"name": "Poland", "lat": 51.92, "lng": 19.15, "region": "Eastern Europe"},
    "PRI": {"name": "Puerto Rico", "lat": 18.22, "lng": -66.59, "region": "Caribbean"},
    "PRK": {"name": "Democratic People's Republic of Korea", "lat": 40.34, "lng": 127.51, "region": "Eastern Asia"},
    "PRT": {"name": "Portugal", "lat": 39.40, "lng": -8.22, "region": "Southern Europe"},
    "PRY": {"name": "Paraguay", "lat": -23.44, "lng": -58.44, "region": "South America"},
    "PSE": {"name": "Palestine", "lat": 31.95, "lng": 35.23, "region": "Western Asia"},
    "PYF": {"name": "French Polynesia", "lat": -17.68, "lng": -149.41, "region": "Oceania"},
    "QAT": {"name": "Qatar", "lat": 25.35, "lng": 51.18, "region": "Western Asia"},
    "ROU": {"name": "Romania", "lat": 45.94, "lng": 24.97, "region": "Eastern Europe"},
    "RUS": {"name": "Russian Federation", "lat": 61.52, "lng": 105.32, "region": "Eastern Europe"},
    "RWA": {"name": "Rwanda", "lat": -1.94, "lng": 29.87, "region": "Eastern Africa"},
    "SAU": {"name": "Saudi Arabia", "lat": 23.89, "lng": 45.08, "region": "Western Asia"},
    "SDN": {"name": "Sudan", "lat": 12.86, "lng": 30.22, "region": "Northern Africa"},
    "SEN": {"name": "Senegal", "lat": 14.50, "lng": -14.45, "region": "Western Africa"},
    "SGP": {"name": "Singapore", "lat": 1.35, "lng": 103.82, "region": "South-Eastern Asia"},
    "SLB": {"name": "Solomon Islands", "lat": -9.65, "lng": 160.16, "region": "Oceania"},
    "SLE": {"name": "Sierra Leone", "lat": 8.46, "lng": -11.78, "region": "Western Africa"},
    "SLV": {"name": "El Salvador", "lat": 13.79, "lng": -88.90, "region": "Central America"},
    "SOM": {"name": "Somalia", "lat": 5.15, "lng": 46.20, "region": "Eastern Africa"},
    "SRB": {"name": "Serbia", "lat": 44.02, "lng": 21.01, "region": "Southern Europe"},
    "SSD": {"name": "South Sudan", "lat": 6.88, "lng": 31.31, "region": "Eastern Africa"},
    "STP": {"name": "Sao Tome and Principe", "lat": 0.19, "lng": 6.61, "region": "Middle Africa"},
    "SUR": {"name": "Suriname", "lat": 3.92, "lng": -56.03, "region": "South America"},
    "SVK": {"name": "Slovakia", "lat": 48.67, "lng": 19.70, "region": "Eastern Europe"},
    "SVN": {"name": "Slovenia", "lat": 46.15, "lng": 14.99, "region": "Southern Europe"},
    "SWE": {"name": "Sweden", "lat": 60.13, "lng": 18.64, "region": "Northern Europe"},
    "SWZ": {"name": "Eswatini", "lat": -26.52, "lng": 31.47, "region": "Southern Africa"},
    "SYC": {"name": "Seychelles", "lat": -4.68, "lng": 55.49, "region": "Eastern Africa"},
    "SYR": {"name": "Syria", "lat": 34.80, "lng": 38.99, "region": "Western Asia"},
    "TCD": {"name": "Chad", "lat": 15.45, "lng": 18.73, "region": "Middle Africa"},
    "TGO": {"name": "Togo", "lat": 8.62, "lng": 0.82, "region": "Western Africa"},
    "THA": {"name": "Thailand", "lat": 15.87, "lng": 100.99, "region": "South-Eastern Asia"},
    "TJK": {"name": "Tajikistan", "lat": 38.86, "lng": 71.28, "region": "Central Asia"},
    "TKM": {"name": "Turkmenistan", "lat": 38.97, "lng": 59.56, "region": "Central Asia"},
    "TLS": {"name": "Timor-Leste", "lat": -8.87, "lng": 125.73, "region": "South-Eastern Asia"},
    "TON": {"name": "Tonga", "lat": -21.18, "lng": -175.20, "region": "Oceania"},
    "TTO": {"name": "Trinidad and Tobago", "lat": 10.69, "lng": -61.22, "region": "Caribbean"},
    "TUN": {"name": "Tunisia", "lat": 33.89, "lng": 9.54, "region": "Northern Africa"},
    "TUR": {"name": "Turkiye", "lat": 38.96, "lng": 35.24, "region": "Western Asia"},
    "TUV": {"name": "Tuvalu", "lat": -7.11, "lng": 177.65, "region": "Oceania"},
    "TWN": {"name": "Taiwan", "lat": 23.70, "lng": 120.96, "region": "Eastern Asia"},
    "TZA": {"name": "Tanzania", "lat": -6.37, "lng": 34.89, "region": "Eastern Africa"},
    "UGA": {"name": "Uganda", "lat": 1.37, "lng": 32.29, "region": "Eastern Africa"},
    "UKR": {"name": "Ukraine", "lat": 48.38, "lng": 31.17, "region": "Eastern Europe"},
    "URY": {"name": "Uruguay", "lat": -32.52, "lng": -55.77, "region": "South America"},
    "USA": {"name": "United States of America", "lat": 37.09, "lng": -95.71, "region": "Northern America"},
    "UZB": {"name": "Uzbekistan", "lat": 41.38, "lng": 64.59, "region": "Central Asia"},
    "VCT": {"name": "Saint Vincent and the Grenadines", "lat": 12.98, "lng": -61.29, "region": "Caribbean"},
    "VEN": {"name": "Venezuela", "lat": 6.42, "lng": -66.59, "region": "South America"},
    "VNM": {"name": "Viet Nam", "lat": 14.06, "lng": 108.28, "region": "South-Eastern Asia"},
    "VUT": {"name": "Vanuatu", "lat": -15.38, "lng": 166.96, "region": "Oceania"},
    "WSM": {"name": "Samoa", "lat": -13.76, "lng": -172.10, "region": "Oceania"},
    "YEM": {"name": "Yemen", "lat": 15.55, "lng": 48.52, "region": "Western Asia"},
    "ZAF": {"name": "South Africa", "lat": -30.56, "lng": 22.94, "region": "Southern Africa"},
    "ZMB": {"name": "Zambia", "lat": -13.13, "lng": 27.85, "region": "Eastern Africa"},
    "ZWE": {"name": "Zimbabwe", "lat": -19.02, "lng": 29.15, "region": "Eastern Africa"},
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def safe_float(val, decimals: int | None = None) -> float | int:
    """Return a JSON-safe number, replacing NaN/inf with 0."""
    if val is None:
        return 0
    try:
        f = float(val)
    except (TypeError, ValueError):
        return 0
    if math.isnan(f) or math.isinf(f):
        return 0
    if decimals is not None:
        f = round(f, decimals)
        if decimals == 0:
            return int(f)
    return f


def write_json(data: dict | list, filename: str) -> None:
    """Write data to a JSON file with compact formatting."""
    path = OUTPUT_DIR / filename
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, separators=(",", ":"), ensure_ascii=False)
    size_mb = path.stat().st_size / (1024 * 1024)
    print(f"  -> {filename} ({size_mb:.2f} MB)")


# ---------------------------------------------------------------------------
# 1. Global time-series
# ---------------------------------------------------------------------------
def process_global_timeseries() -> None:
    print("\n[1/10] Processing global timeseries ...")
    df = pd.read_csv(TIMESERIES_DIR / "global_emissions_by_year.csv")
    df = df[~df["Year"].isin(EXCLUDE_YEARS)]

    result = {
        "years": [int(y) for y in df["Year"]],
        "trade_volume_mt": [safe_float(v, 2) for v in df["Trade_Volume_Mt"]],
        "wtw_emissions_mtco2": [safe_float(v, 2) for v in df["WTW_emissions_MtCO2"]],
        "ttw_emissions_mtco2": [safe_float(v, 2) for v in df["TTW_emissions_MtCO2"]],
        "wtt_emissions_mtco2": [safe_float(v, 2) for v in df["WTT_emissions_MtCO2"]],
        "food_miles_billion_tkm": [safe_float(v, 2) for v in df["Food_Miles_Billion_tkm"]],
        "preliminary_years": PRELIMINARY_YEARS,
    }
    write_json(result, "global_timeseries.json")


# ---------------------------------------------------------------------------
# 1b. Global emissions by mode (NEW)
# ---------------------------------------------------------------------------
def process_global_by_mode() -> None:
    print("\n[1b/10] Processing global emissions by mode ...")
    mode_path = TIMESERIES_DIR / "emissions_by_year_mode.csv"
    if not mode_path.exists():
        print(f"  WARNING: emissions_by_year_mode.csv not found, skipping")
        write_json({}, "global_by_mode.json")
        return

    df = pd.read_csv(mode_path)
    df = df[~df["Year"].isin(EXCLUDE_YEARS)]

    result: dict[str, list] = {}
    for _, row in df.iterrows():
        year = str(int(row["Year"]))
        mode = str(row["mode"]).lower().strip()
        result.setdefault(year, [])
        result[year].append({
            "mode": mode,
            "wtw": safe_float(row.get("WTW_emissions_MtCO2", row.get("WTW_emissions_tCO2", 0)), 2),
            "ttw": safe_float(row.get("TTW_emissions_MtCO2", row.get("TTW_emissions_tCO2", 0)), 2),
            "wtt": safe_float(row.get("WTT_emissions_MtCO2", row.get("WTT_emissions_tCO2", 0)), 2),
            "food_miles": safe_float(row.get("Food_Miles_Billion_tkm", row.get("food_miles_tkm", 0)), 2),
            "value": safe_float(row.get("Trade_Volume_Mt", row.get("Value", 0)), 2),
        })

    write_json(result, "global_by_mode.json")


# ---------------------------------------------------------------------------
# 2. Consumer countries
# ---------------------------------------------------------------------------
def process_consumer_countries() -> None:
    print("\n[2/10] Processing consumer countries ...")
    df = pd.read_csv(TIMESERIES_DIR / "emissions_by_consumer_country_year.csv")
    df = df[~df["Year"].isin(EXCLUDE_YEARS)]

    result: dict[str, dict] = {}
    for _, row in df.iterrows():
        iso3 = str(row["to_iso3"])
        year = str(int(row["Year"]))
        route = str(row["route_type"]).lower().strip()
        if route not in ("bilateral", "domestic"):
            continue

        result.setdefault(iso3, {})
        result[iso3].setdefault(year, {})
        result[iso3][year][route] = {
            "wtw": safe_float(row["WTW_emissions_tCO2"], 1),
            "ttw": safe_float(row["TTW_emissions_tCO2"], 1),
            "wtt": safe_float(row["WTT_emissions_tCO2"], 1),
            "food_miles": safe_float(row["food_miles_tkm"], 0),
            "value": safe_float(row["Value"], 1),
            "cost": safe_float(row.get("total_transport_cost_USD", 0), 1),
        }

    write_json(result, "consumer_countries.json")


# ---------------------------------------------------------------------------
# 3. Producer countries
# ---------------------------------------------------------------------------
def process_producer_countries() -> None:
    print("\n[3/10] Processing producer countries ...")
    df = pd.read_csv(TIMESERIES_DIR / "emissions_by_producer_country_year.csv")
    df = df[~df["Year"].isin(EXCLUDE_YEARS)]

    result: dict[str, dict] = {}
    for _, row in df.iterrows():
        iso3 = str(row["from_iso3"])
        year = str(int(row["Year"]))
        route = str(row["route_type"]).lower().strip()
        if route not in ("bilateral", "domestic"):
            continue

        result.setdefault(iso3, {})
        result[iso3].setdefault(year, {})
        result[iso3][year][route] = {
            "wtw": safe_float(row["WTW_emissions_tCO2"], 1),
            "ttw": safe_float(row["TTW_emissions_tCO2"], 1),
            "wtt": safe_float(row["WTT_emissions_tCO2"], 1),
            "food_miles": safe_float(row["food_miles_tkm"], 0),
            "value": safe_float(row["Value"], 1),
        }

    write_json(result, "producer_countries.json")


# ---------------------------------------------------------------------------
# 4. Commodities
# ---------------------------------------------------------------------------
def process_commodities() -> None:
    print("\n[4/10] Processing commodities ...")
    df = pd.read_csv(TIMESERIES_DIR / "emissions_by_commodity_year.csv")
    df = df[~df["Year"].isin(EXCLUDE_YEARS)]

    # New data uses "commodity_name" instead of "commodity_name_x"
    comm_col = "commodity_name" if "commodity_name" in df.columns else "commodity_name_x"
    print(f"    Using commodity column: {comm_col}")

    result: dict[str, dict] = {}
    for _, row in df.iterrows():
        comm = str(row[comm_col])
        year = str(int(row["Year"]))
        route = str(row["route_type"]).lower().strip()
        if route not in ("bilateral", "domestic"):
            continue

        result.setdefault(comm, {})
        result[comm].setdefault(year, {})
        result[comm][year][route] = {
            "wtw": safe_float(row["WTW_emissions_tCO2"], 1),
            "ttw": safe_float(row["TTW_emissions_tCO2"], 1),
            "food_miles": safe_float(row["food_miles_tkm"], 0),
            "value": safe_float(row["Value"], 1),
        }

    write_json(result, "commodities.json")


# ---------------------------------------------------------------------------
# 5. Bilateral top flows — per mode (large file, chunked)
#
# New structure: each row has a specific mode (air/maritime/land).
# We produce top 100 corridors per mode per year, plus top 100 across all.
# Output: { "2023": { "all": [...], "maritime": [...], "air": [...], "land": [...] } }
# ---------------------------------------------------------------------------
def process_bilateral_top_flows() -> None:
    print("\n[5/10] Processing bilateral top flows per mode (this may take a while) ...")
    bilateral_path = TIMESERIES_DIR / "bilateral_emissions_timeseries_all_flows.csv"

    # Key: (year, mode, from_iso3, to_iso3) -> aggregation dict
    agg: dict[tuple, dict] = {}
    # Also track "all" mode: (year, "all", from_iso3, to_iso3)
    # We will build "all" by a second aggregation pass from the mode-level data

    total_rows = 0
    chunk_count = 0
    t0 = time.time()

    cols_needed = [
        "Year", "from_iso3", "to_iso3", "route_type", "mode",
        "WTW_emissions_tCO2", "TTW_emissions_tCO2", "WTT_emissions_tCO2",
        "food_miles_tkm", "total_transport_cost_USD",
    ]

    reader = pd.read_csv(
        bilateral_path,
        usecols=cols_needed,
        chunksize=BILATERAL_CHUNKSIZE,
        dtype={
            "from_iso3": str,
            "to_iso3": str,
            "route_type": str,
            "mode": str,
        },
        low_memory=False,
    )

    for chunk in reader:
        chunk_count += 1
        total_rows += len(chunk)
        elapsed = time.time() - t0
        print(
            f"    chunk {chunk_count}: {total_rows:,} rows processed "
            f"({elapsed:.1f}s elapsed)"
        )

        # Keep only bilateral flows, exclude certain years
        chunk = chunk[(chunk["route_type"].str.lower() == "bilateral") & (~chunk["Year"].isin(EXCLUDE_YEARS))]
        if chunk.empty:
            continue

        for col in [
            "WTW_emissions_tCO2", "TTW_emissions_tCO2",
            "WTT_emissions_tCO2", "food_miles_tkm",
            "total_transport_cost_USD",
        ]:
            chunk[col] = pd.to_numeric(chunk[col], errors="coerce").fillna(0.0)

        chunk["mode"] = chunk["mode"].fillna("unknown").str.lower().str.strip()

        for _, row in chunk.iterrows():
            year = int(row["Year"])
            mode = str(row["mode"])
            from_iso3 = str(row["from_iso3"])
            to_iso3 = str(row["to_iso3"])

            # Per-mode aggregation
            key = (year, mode, from_iso3, to_iso3)
            rec = agg.get(key)
            if rec is None:
                rec = {"wtw": 0.0, "ttw": 0.0, "wtt": 0.0,
                       "food_miles": 0.0, "cost": 0.0, "n_commodities": 0}
                agg[key] = rec
            rec["wtw"] += float(row["WTW_emissions_tCO2"])
            rec["ttw"] += float(row["TTW_emissions_tCO2"])
            rec["wtt"] += float(row["WTT_emissions_tCO2"])
            rec["food_miles"] += float(row["food_miles_tkm"])
            rec["cost"] += float(row["total_transport_cost_USD"])
            rec["n_commodities"] += 1

    elapsed = time.time() - t0
    print(f"    Done reading {total_rows:,} rows in {elapsed:.1f}s. Building per-mode top flows ...")

    # Build per-mode flows: { year_str: { mode: [flows] } }
    year_mode_flows: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))

    for (year, mode, from_iso3, to_iso3), rec in agg.items():
        flow = {
            "from": from_iso3,
            "to": to_iso3,
            "wtw": safe_float(rec["wtw"], 1),
            "ttw": safe_float(rec["ttw"], 1),
            "wtt": safe_float(rec["wtt"], 1),
            "food_miles": safe_float(rec["food_miles"], 0),
            "cost": safe_float(rec["cost"], 1),
            "n_commodities": rec["n_commodities"],
            "dominant_mode": mode,
        }
        year_mode_flows[str(year)][mode].append(flow)

    # Also build "all" by aggregating across modes for each (year, from, to)
    all_agg: dict[tuple, dict] = {}
    all_mode_ttw: dict[tuple, dict[str, float]] = {}
    for (year, mode, from_iso3, to_iso3), rec in agg.items():
        akey = (year, from_iso3, to_iso3)
        arec = all_agg.get(akey)
        if arec is None:
            arec = {"wtw": 0.0, "ttw": 0.0, "wtt": 0.0,
                    "food_miles": 0.0, "cost": 0.0, "n_commodities": 0}
            all_agg[akey] = arec
        arec["wtw"] += rec["wtw"]
        arec["ttw"] += rec["ttw"]
        arec["wtt"] += rec["wtt"]
        arec["food_miles"] += rec["food_miles"]
        arec["cost"] += rec["cost"]
        arec["n_commodities"] += rec["n_commodities"]
        # Track dominant mode by TTW
        md = all_mode_ttw.setdefault(akey, {})
        md[mode] = md.get(mode, 0.0) + rec["ttw"]

    for (year, from_iso3, to_iso3), arec in all_agg.items():
        modes = all_mode_ttw.get((year, from_iso3, to_iso3), {})
        dominant = max(modes, key=modes.get) if modes else "unknown"
        flow = {
            "from": from_iso3,
            "to": to_iso3,
            "wtw": safe_float(arec["wtw"], 1),
            "ttw": safe_float(arec["ttw"], 1),
            "wtt": safe_float(arec["wtt"], 1),
            "food_miles": safe_float(arec["food_miles"], 0),
            "cost": safe_float(arec["cost"], 1),
            "n_commodities": arec["n_commodities"],
            "dominant_mode": dominant,
        }
        year_mode_flows[str(year)]["all"].append(flow)

    # Select top N per mode per year
    result: dict[str, dict[str, list]] = {}
    for year_str in sorted(year_mode_flows.keys()):
        result[year_str] = {}
        for mode, flows in year_mode_flows[year_str].items():
            flows.sort(key=lambda x: x["ttw"], reverse=True)
            result[year_str][mode] = flows[:TOP_N_BILATERAL_PER_MODE]

    write_json(result, "bilateral_top_flows.json")


# ---------------------------------------------------------------------------
# 5b. Bilateral flows by commodity (large file, chunked)
# ---------------------------------------------------------------------------
def process_bilateral_by_commodity() -> None:
    print("\n[5b/10] Processing bilateral flows by commodity (this may take a while) ...")
    bilateral_path = TIMESERIES_DIR / "bilateral_emissions_timeseries_all_flows.csv"

    # Key: (commodity, year, from_iso3, to_iso3) -> aggregation
    # Each flow keeps its mode since each row already has one
    agg: dict[tuple, dict] = {}
    # Track mode per flow for dominant_mode
    mode_ttw: dict[tuple, dict[str, float]] = {}

    total_rows = 0
    chunk_count = 0
    t0 = time.time()

    cols_needed = [
        "Year", "from_iso3", "to_iso3", "route_type", "mode",
        "commodity",
        "WTW_emissions_tCO2", "TTW_emissions_tCO2", "WTT_emissions_tCO2",
        "food_miles_tkm", "total_transport_cost_USD",
    ]

    reader = pd.read_csv(
        bilateral_path,
        usecols=cols_needed,
        chunksize=BILATERAL_CHUNKSIZE,
        dtype={
            "from_iso3": str,
            "to_iso3": str,
            "route_type": str,
            "mode": str,
            "commodity": str,
        },
        low_memory=False,
    )

    for chunk in reader:
        chunk_count += 1
        total_rows += len(chunk)
        elapsed = time.time() - t0
        print(
            f"    chunk {chunk_count}: {total_rows:,} rows processed "
            f"({elapsed:.1f}s elapsed)"
        )

        chunk = chunk[(chunk["route_type"].str.lower() == "bilateral") & (~chunk["Year"].isin(EXCLUDE_YEARS))]
        if chunk.empty:
            continue

        for col in [
            "WTW_emissions_tCO2", "TTW_emissions_tCO2",
            "WTT_emissions_tCO2", "food_miles_tkm",
            "total_transport_cost_USD",
        ]:
            chunk[col] = pd.to_numeric(chunk[col], errors="coerce").fillna(0.0)

        chunk["mode"] = chunk["mode"].fillna("unknown").str.lower().str.strip()
        chunk["commodity"] = chunk["commodity"].fillna("Unknown")

        for _, row in chunk.iterrows():
            commodity = str(row["commodity"])
            key = (commodity, int(row["Year"]), str(row["from_iso3"]), str(row["to_iso3"]))
            rec = agg.get(key)
            if rec is None:
                rec = {"wtw": 0.0, "ttw": 0.0, "wtt": 0.0,
                       "food_miles": 0.0, "cost": 0.0, "n_commodities": 0}
                agg[key] = rec
            rec["wtw"] += float(row["WTW_emissions_tCO2"])
            rec["ttw"] += float(row["TTW_emissions_tCO2"])
            rec["wtt"] += float(row["WTT_emissions_tCO2"])
            rec["food_miles"] += float(row["food_miles_tkm"])
            rec["cost"] += float(row["total_transport_cost_USD"])
            rec["n_commodities"] += 1

            m = str(row["mode"])
            md = mode_ttw.setdefault(key, {})
            md[m] = md.get(m, 0.0) + float(row["TTW_emissions_tCO2"])

    elapsed = time.time() - t0
    print(f"    Done reading {total_rows:,} rows in {elapsed:.1f}s. Selecting top flows per commodity ...")

    comm_year_flows: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for (commodity, year, from_iso3, to_iso3), rec in agg.items():
        modes = mode_ttw.get((commodity, year, from_iso3, to_iso3), {})
        dominant_mode = max(modes, key=modes.get) if modes else "unknown"

        comm_year_flows[commodity][str(year)].append({
            "from": from_iso3,
            "to": to_iso3,
            "wtw": safe_float(rec["wtw"], 1),
            "ttw": safe_float(rec["ttw"], 1),
            "wtt": safe_float(rec["wtt"], 1),
            "food_miles": safe_float(rec["food_miles"], 0),
            "cost": safe_float(rec["cost"], 1),
            "n_commodities": rec["n_commodities"],
            "dominant_mode": dominant_mode,
        })

    result: dict[str, dict[str, list]] = {}
    for commodity, year_flows in sorted(comm_year_flows.items()):
        result[commodity] = {}
        for year_str, flows in sorted(year_flows.items()):
            flows.sort(key=lambda x: x["ttw"], reverse=True)
            result[commodity][year_str] = flows[:TOP_N_BILATERAL_PER_COMMODITY]

    write_json(result, "bilateral_by_commodity.json")


# ---------------------------------------------------------------------------
# 6. Transport factors
# ---------------------------------------------------------------------------
def process_transport_factors() -> None:
    print("\n[6/10] Processing transport factors ...")

    if not TRANSPORT_FACTORS_DIR.exists():
        print(f"  WARNING: Transport factors directory not found: {TRANSPORT_FACTORS_DIR}")
        write_json({}, "transport_factors.json")
        return

    csv_files = sorted(TRANSPORT_FACTORS_DIR.glob("transport_statistics_*.csv"))
    print(f"    Found {len(csv_files)} factor files")

    raw: dict[str, dict[str, dict]] = defaultdict(
        lambda: defaultdict(lambda: {"wtw_sum": 0.0, "ttw_sum": 0.0, "dist_sum": 0.0, "count": 0})
    )

    for i, fpath in enumerate(csv_files, 1):
        if i % 50 == 0:
            print(f"    ... {i}/{len(csv_files)} files")
        try:
            df = pd.read_csv(fpath, low_memory=False)
        except Exception as exc:
            print(f"  WARNING: Could not read {fpath.name}: {exc}")
            continue

        needed = {"commodity", "mode", "WTW_kgCO2_t", "TTW_kgCO2_t", "distance_km"}
        if not needed.issubset(set(df.columns)):
            parts = fpath.stem.replace("transport_statistics_", "").split("_", 1)
            if len(parts) == 2:
                mode_from_name, commodity_from_name = parts
            else:
                continue
            if "mode" not in df.columns:
                df["mode"] = mode_from_name
            if "commodity" not in df.columns:
                df["commodity"] = commodity_from_name

        for col in ["WTW_kgCO2_t", "TTW_kgCO2_t", "distance_km"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
            else:
                df[col] = 0.0

        for _, row in df.iterrows():
            commodity = str(row.get("commodity", "Unknown"))
            mode = str(row.get("mode", "unknown")).lower().strip()
            bucket = raw[commodity][mode]
            bucket["wtw_sum"] += float(row["WTW_kgCO2_t"])
            bucket["ttw_sum"] += float(row["TTW_kgCO2_t"])
            bucket["dist_sum"] += float(row["distance_km"])
            bucket["count"] += 1

    result: dict[str, dict] = {}
    for commodity, modes in sorted(raw.items()):
        result[commodity] = {}
        for mode, bucket in sorted(modes.items()):
            n = bucket["count"]
            if n == 0:
                continue
            result[commodity][mode] = {
                "wtw": safe_float(bucket["wtw_sum"] / n, 1),
                "ttw": safe_float(bucket["ttw_sum"] / n, 1),
                "distance": safe_float(bucket["dist_sum"] / n, 0),
                "routes": n,
            }

    write_json(result, "transport_factors.json")


# ---------------------------------------------------------------------------
# 7. Country metadata
# ---------------------------------------------------------------------------
def process_country_metadata() -> None:
    print("\n[7/10] Processing country metadata ...")

    consumer_df = pd.read_csv(TIMESERIES_DIR / "emissions_by_consumer_country_year.csv")
    producer_df = pd.read_csv(TIMESERIES_DIR / "emissions_by_producer_country_year.csv")
    data_iso3s = sorted(
        set(consumer_df["to_iso3"].dropna().unique())
        | set(producer_df["from_iso3"].dropna().unique())
    )

    missing = [c for c in data_iso3s if c not in COUNTRY_META]
    if missing:
        print(f"  WARNING: {len(missing)} ISO3 codes in data but not in metadata: {missing}")
        for code in missing:
            COUNTRY_META[code] = {
                "name": code,
                "lat": 0.0,
                "lng": 0.0,
                "region": "Unknown",
            }

    write_json(COUNTRY_META, "country_metadata.json")


# ---------------------------------------------------------------------------
# 8. Dropdown lists
# ---------------------------------------------------------------------------
def process_dropdown_lists() -> None:
    print("\n[8/10] Processing dropdown lists ...")

    # Commodities — use "commodity_name" (new data) or "commodity_name_x" (old data)
    comm_df = pd.read_csv(TIMESERIES_DIR / "emissions_by_commodity_year.csv")
    comm_col = "commodity_name" if "commodity_name" in comm_df.columns else "commodity_name_x"
    commodities = sorted(comm_df[comm_col].dropna().unique().tolist())

    # Countries
    consumer_df = pd.read_csv(TIMESERIES_DIR / "emissions_by_consumer_country_year.csv")
    producer_df = pd.read_csv(TIMESERIES_DIR / "emissions_by_producer_country_year.csv")
    all_iso3 = sorted(
        set(consumer_df["to_iso3"].dropna().unique())
        | set(producer_df["from_iso3"].dropna().unique())
    )

    countries = []
    for iso3 in all_iso3:
        meta = COUNTRY_META.get(iso3, {})
        countries.append({
            "iso3": iso3,
            "name": meta.get("name", iso3),
        })
    countries.sort(key=lambda c: c["name"])

    global_df = pd.read_csv(TIMESERIES_DIR / "global_emissions_by_year.csv")
    years = sorted(int(y) for y in global_df["Year"].unique() if int(y) not in EXCLUDE_YEARS)

    result = {
        "commodities": commodities,
        "countries": countries,
        "years": years,
        "preliminary_years": PRELIMINARY_YEARS,
    }
    write_json(result, "dropdown_lists.json")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    print("=" * 60)
    print("Transport Emissions Dashboard -- Preprocessing")
    print("=" * 60)
    print(f"TimeSeries dir : {TIMESERIES_DIR}")
    print(f"Output dir     : {OUTPUT_DIR}")
    print(f"Factors dir    : {TRANSPORT_FACTORS_DIR}")

    if not TIMESERIES_DIR.exists():
        print(f"\nERROR: TimeSeries directory not found: {TIMESERIES_DIR}")
        sys.exit(1)

    t_start = time.time()

    process_global_timeseries()
    process_global_by_mode()
    process_consumer_countries()
    process_producer_countries()
    process_commodities()
    process_bilateral_top_flows()
    process_bilateral_by_commodity()
    process_transport_factors()
    process_country_metadata()
    process_dropdown_lists()

    elapsed = time.time() - t_start
    print(f"\nAll done in {elapsed:.1f}s.")
    print(f"Output files in: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
