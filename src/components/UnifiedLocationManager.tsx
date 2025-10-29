import safeNominatimGeocode from '@/utils/safeGeocoding';

// Other existing imports

// Updated geocodeCity function
const geocodeCity = async (cityName, state) => {
    const safeLocation = await safeNominatimGeocode(cityName, state, 'Brasil');
    if (safeLocation) {
        formData.lat = safeLocation.lat;
        formData.lng = safeLocation.lng;
    }
};

// Existing code continues...