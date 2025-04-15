let currentUserLocation = null;
let currentRouteControl = null;

/**
 * Khởi tạo chức năng chỉ đường
 */
export function setupRouteFunction(map) {
    // Cập nhật vị trí người dùng
    map.on('locationfound', (e) => {
        window.currentUserLocation = e.latlng; // Gán vào window
        console.log('Vị trí hiện tại:', window.currentUserLocation);
    });

    /**
     * Tìm đường đến ngân hàng
     * @param {Object} destinationLatLng - {lat, lng}
     * @param {String} bankName - Tên ngân hàng
     */
    window.findRouteToBank = function (destinationLatLng, bankName = 'Ngân hàng được chọn') {
        if (!window.currentUserLocation) { // Sử dụng window.currentUserLocation
            alert('Vui lòng xác định vị trí trước.');
            return;
        }

        // Xóa tuyến cũ nếu có
        if (currentRouteControl) {
            map.removeControl(currentRouteControl);
            currentRouteControl = null;
        }

        // Tạo tuyến mới
        currentRouteControl = L.Routing.control({
            waypoints: [
                L.latLng(window.currentUserLocation), // Sử dụng window.currentUserLocation
                L.latLng(destinationLatLng),
            ],
            routeWhileDragging: false,
            show: true,
            createMarker: function (i, wp, n) {
                const isStart = i === 0;
                const iconHtml = isStart
                    ? '<i class="fas fa-user-circle fa-lg" style="color:blue;"></i>'
                    : '<i class="fas fa-university fa-lg" style="color:darkred;"></i>';
                return L.marker(wp.latLng, {
                    icon: L.divIcon({
                        className: isStart ? 'route-start-icon' : 'route-end-icon',
                        html: iconHtml,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10],
                    }),
                }).bindPopup(isStart ? 'Vị trí của bạn' : bankName);
            },
        }).addTo(map);

        // Đợi panel render rồi thêm nút "Đóng chỉ đường"
        setTimeout(() => {
            const container = document.querySelector('.leaflet-routing-container');
            if (container && !document.getElementById('close-route-btn')) {
                const closeBtn = document.createElement('button');
                closeBtn.id = 'close-route-btn';
                closeBtn.innerHTML = '<i class="fas fa-times-circle"></i> Đóng chỉ đường';
                closeBtn.style.margin = '10px auto';
                closeBtn.style.display = 'block';
                closeBtn.style.padding = '6px 12px';
                closeBtn.style.border = 'none';
                closeBtn.style.background = '#dc3545';
                closeBtn.style.color = '#fff';
                closeBtn.style.borderRadius = '4px';
                closeBtn.style.cursor = 'pointer';

                closeBtn.onclick = () => {
                    if (currentRouteControl) {
                        map.removeControl(currentRouteControl);
                        currentRouteControl = null;
                    }
                };

                container.appendChild(closeBtn);
            }
        }, 500);
    };
}