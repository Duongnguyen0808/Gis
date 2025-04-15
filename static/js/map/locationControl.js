let locationMarker = null;

export function addLocationControl(map) {
    const LocationControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function () {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom location-button');
            container.style.cssText = 'background:white;width:34px;height:34px;cursor:pointer';
            container.innerHTML = '<a href="#" aria-label="Tìm vị trí của tôi" style="line-height:34px;text-align:center;display:block;"><i class="fas fa-crosshairs"></i></a>';
            L.DomEvent.on(container, 'click', function (ev) {
                L.DomEvent.stopPropagation(ev);
                map.locate({ setView: true, maxZoom: 16 });
            });
            return container;
        },
    });

    map.addControl(new LocationControl());

    map.on('locationfound', function (e) {
        if (locationMarker) map.removeLayer(locationMarker);
        locationMarker = L.marker(e.latlng, {
            icon: L.divIcon({
                className: 'user-location-icon',
                html: '<i class="fas fa-user-circle fa-lg" style="color:blue;"></i>',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            }),
        }).addTo(map).bindPopup('Vị trí của bạn');
    });

    map.on('locationerror', function (e) {
        alert('Không thể lấy vị trí: ' + e.message);
        console.error(e);
    });
}