import { fetchData } from './utils.js';
import { showSidebar } from './sidebar.js';

const arrayLayers = ['branch'];
const layersButton = 'all layers';
const activeLayers = {};
let allBankData = []; // Thêm biến này

export function loadGeoJSONLayers(map) {
    const layersContainer = document.querySelector('.layers');
if (!layersContainer) return;
// Đảm bảo .layers được thêm vào trong container của bản đồ
document.querySelector('#map').appendChild(layersContainer);

    function generateButton(name) {
        const id = name === layersButton ? 'all-layers' : name;
        const label =
            name === layersButton ? 'Tất cả' : name.charAt(0).toUpperCase() + name.slice(1);
        const html = `<li class="layer-element"><label><input type="checkbox" id="${id}" class="item" value="${name}" checked><span>${label}</span></label></li>`;
        layersContainer.insertAdjacentHTML('beforeend', html);
    }

    generateButton(layersButton);
    arrayLayers.forEach((layer) => {
        generateButton(layer);

        fetchData(`/maps/api/geojson/${layer}/`)
            .then((data) => {
                if (data && data.features && data.features.length > 0) {
                    console.log(`✅ Loaded ${data.features.length} features from ${layer}`);

                    // Lưu trữ tất cả dữ liệu ngân hàng
                    allBankData = allBankData.concat(data.features);

                    const geoLayer = L.geoJSON(data, {
                        pointToLayer: (feature, latlng) => {
                            const props = feature.properties || {};
                            const marker = L.marker(latlng, {
                                icon: L.icon({
                                    iconUrl:
                                        'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                                    shadowUrl:
                                        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                    iconSize: [25, 41],
                                    iconAnchor: [12, 41],
                                }),
                                bankInfo: {
                                    name: props.name,
                                    openingTime: props.opening_time,
                                    closingTime: props.closing_time,
                                },
                            });

                            marker.feature = feature; // Lưu trữ feature cho sau này

                            marker.on('click', () => {
                                showSidebar(props, latlng, marker.options.bankInfo);
                            });

                            return marker;
                        },
                    });

                    const key = 'layer_' + layer;
                    activeLayers[key] = geoLayer;
                    map.addLayer(geoLayer);

                    if (geoLayer.getBounds && geoLayer.getBounds().isValid()) {
                        map.fitBounds(geoLayer.getBounds());
                    }
                } else {
                    console.warn(`⚠️ Không có dữ liệu hợp lệ từ ${layer}`);
                }
            })
            .catch((err) => {
                console.error(`❌ Lỗi khi tải dữ liệu từ ${layer}:`, err);
            });
    });

    layersContainer.addEventListener('click', (e) => {
        if (!e.target.matches('input.item')) return;

        const checked = e.target.checked;
        const layerId = e.target.value;

        if (layerId === layersButton) {
            arrayLayers.forEach((id) => {
                const cb = document.querySelector(`#${id}`);
                if (cb) cb.checked = checked;

                const layer = activeLayers['layer_' + id];
                if (layer) {
                    if (checked) {
                        map.addLayer(layer);
                        if (layer.getBounds && layer.getBounds().isValid()) {
                            map.fitBounds(layer.getBounds());
                        }
                    } else {
                        map.removeLayer(layer);
                    }
                }
            });
        } else {
            const layer = activeLayers['layer_' + layerId];
            if (layer) {
                if (checked) {
                    map.addLayer(layer);
                    if (layer.getBounds && layer.getBounds().isValid()) {
                        map.fitBounds(layer.getBounds());
                    }
                } else {
                    map.removeLayer(layer);
                }
            }
        }
    });

    map.on('fullscreenchange', () => {
        console.log('📺 Fullscreen toggled:', map.isFullscreen());
        setTimeout(() => {
            map.invalidateSize();
            console.log('Map size invalidated.');
        }, 100);

        Object.values(activeLayers).forEach((layer) => {
            if (layer && layer.eachLayer) {
                layer.eachLayer((marker) => {
                    if (marker instanceof L.Marker) {
                        marker.off('click').on('click', () => {
                            const props = marker.feature.properties;
                            const latlng = marker.getLatLng();
                            showSidebar(props, latlng, marker.options.bankInfo);
                        });
                    }
                });
            }
        });
    });
}

// Export biến allBankData
export { allBankData };