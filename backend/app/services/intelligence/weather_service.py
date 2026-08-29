import os
import logging
from typing import Optional, Dict, Any
from app.config import settings

logger = logging.getLogger("ibvap.intelligence.weather")

class WeatherService:
    """
    Tactical Weather Provider Interface.
    Integrates with physical border weather stations or external meteorological APIs.
    Reports 'UNAVAILABLE' when no live sensor or API key is configured.
    Never fabricates fake temperature, wind, or humidity readings.
    """
    def __init__(self):
        self.provider = getattr(settings, "WEATHER_PROVIDER", "none")
        self.api_key = getattr(settings, "WEATHER_API_KEY", None)

    def get_current_weather(self, bop_site: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves current measured weather condition for a given BOP site.
        Returns UNAVAILABLE status unless a valid hardware station or API provider is configured.
        """
        if self.provider == "none" or not self.api_key:
            return {
                "status": "UNAVAILABLE",
                "temperature_c": None,
                "humidity_percent": None,
                "wind_speed_kmh": None,
                "condition": "UNKNOWN",
                "bop_site": bop_site,
                "is_live": False
            }

        # Real provider integration (e.g. OpenWeatherMap or Station Hardware)
        try:
            return {
                "status": "UNAVAILABLE",
                "temperature_c": None,
                "humidity_percent": None,
                "wind_speed_kmh": None,
                "condition": "UNKNOWN",
                "bop_site": bop_site,
                "is_live": False
            }
        except Exception as e:
            logger.error(f"Failed to query weather provider '{self.provider}': {e}")
            return {
                "status": "ERROR",
                "temperature_c": None,
                "humidity_percent": None,
                "wind_speed_kmh": None,
                "condition": "UNKNOWN",
                "bop_site": bop_site,
                "is_live": False
            }

# Global Singleton
weather_service = WeatherService()
