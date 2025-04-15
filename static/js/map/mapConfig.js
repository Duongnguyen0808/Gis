export function initMap() {
    const config = {
        minZoom: 7,
        maxZoom: 18,
        fullscreenControl: true,
        fullscreenControlOptions: {
            position: 'topleft',
        },
    };

    const initialLat = 10.8231;
    const initialLng = 106.6297;

    const map = L.map('map', config).setView([initialLat, initialLng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    return map;
}