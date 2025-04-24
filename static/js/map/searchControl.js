import { allBankData } from './geojsonLayer.js';

export function setupSearchControl(map) {
    const searchInput = document.getElementById('searchInput');
    const searchResultsList = document.getElementById('searchResults');

    if (!searchInput || !searchResultsList) return;

    // Nên thêm Debounce/Throttle để hạn chế số lần gọi API khi người dùng gõ nhanh
    searchInput.addEventListener('input', debounce(function () { // Giả sử có hàm debounce
        const searchTerm = this.value.toLowerCase().trim();
        searchResultsList.innerHTML = '<li><i>Đang tìm và tính khoảng cách...</i></li>'; // Thông báo đang xử lý

        if (searchTerm.length < 2) {
            searchResultsList.innerHTML = '';
            return;
        }

        if (!window.currentUserLocation) {
            searchResultsList.innerHTML = '<li>Vui lòng bật định vị để xem khoảng cách.</li>';
            alert('Vui lòng bật định vị để xem khoảng cách.');
            return;
        }

        const filteredBanks = allBankData.filter(bank =>
            bank.properties.name.toLowerCase().includes(searchTerm)
        );

        if (filteredBanks.length === 0) {
             searchResultsList.innerHTML = '<li>Không tìm thấy ngân hàng nào.</li>';
             return;
        }

        // Mảng chứa các promises tính toán lộ trình
        const routingPromises = filteredBanks.map(bank => {
            return new Promise((resolve, reject) => {
                const bankLatLng = L.latLng(bank.geometry.coordinates[1], bank.geometry.coordinates[0]);

                // Tạo một bộ điều khiển định tuyến tạm thời (không hiển thị trên bản đồ)
                // Lưu ý: Cần đảm bảo router và formatter được cấu hình đúng
                // hoặc sử dụng L.Routing.osrmv1 trực tiếp nếu bạn dùng OSRM
                const router = L.Routing.osrmv1({
                    serviceUrl: 'https://router.project-osrm.org/route/v1' // URL dịch vụ OSRM demo
                    // Hoặc dịch vụ khác bạn đang dùng
                });

                router.route([{ latLng: window.currentUserLocation }, { latLng: bankLatLng }], (error, routes) => {
                    if (!error && routes && routes.length > 0) {
                        const route = routes[0]; // Lấy lộ trình đầu tiên
                        resolve({
                            ...bank,
                            routeDistance: route.summary.totalDistance // Lấy tổng khoảng cách (mét)
                        });
                    } else {
                        console.error(`Lỗi tính lộ trình cho ${bank.properties.name}:`, error);
                        // Trả về khoảng cách đường chim bay làm dự phòng hoặc giá trị đặc biệt
                        resolve({
                             ...bank,
                             routeDistance: null, // Hoặc window.currentUserLocation.distanceTo(bankLatLng)
                             fallbackDistance: window.currentUserLocation.distanceTo(bankLatLng) // Lưu lại khoảng cách đường chim bay
                         });
                        // reject(error); // Hoặc reject nếu muốn bỏ qua kết quả lỗi
                    }
                });
            });
        });

        // Chờ tất cả các tính toán hoàn tất
        Promise.all(routingPromises).then(banksWithRouteDistance => {
            // Sắp xếp lại dựa trên khoảng cách tuyến đường (nếu có) hoặc fallback
            banksWithRouteDistance.sort((a, b) => {
                 const distA = a.routeDistance ?? a.fallbackDistance ?? Infinity;
                 const distB = b.routeDistance ?? b.fallbackDistance ?? Infinity;
                 return distA - distB;
            });


            searchResultsList.innerHTML = ''; // Xóa thông báo "Đang tìm..."

            banksWithRouteDistance.forEach(bank => {
                const listItem = document.createElement('li');
                listItem.classList.add('list-group-item'); // Thêm class Bootstrap nếu dùng

                let distanceText = '';
                if (bank.routeDistance !== null) {
                    const distanceKm = (bank.routeDistance / 1000).toFixed(2);
                    distanceText = ` (${distanceKm} km)`;
                } else if (bank.fallbackDistance !== null) {
                     // Hiển thị fallback nếu tính route lỗi
                     const fallbackKm = (bank.fallbackDistance / 1000).toFixed(1);
                     distanceText = ` (~${fallbackKm} km đường chim bay)`;
                }


                listItem.textContent = `${bank.properties.name}${distanceText}`;
                listItem.addEventListener('click', () => {
                    map.setView([bank.geometry.coordinates[1], bank.geometry.coordinates[0]], 16);
                    // Kích hoạt marker (đoạn mã cũ của bạn)
                     Object.values(map._layers).forEach(layer => {
                         if (layer instanceof L.Marker && layer.feature && layer.feature.properties.name === bank.properties.name) {
                             layer.fire('click');
                         }
                     });
                    searchResultsList.innerHTML = '';
                    searchInput.value = '';
                });
                searchResultsList.appendChild(listItem);
            });

        }).catch(error => {
             console.error("Lỗi khi xử lý các lộ trình:", error);
             searchResultsList.innerHTML = '<li>Có lỗi xảy ra khi tính khoảng cách.</li>';
        });

    }, 500)); // Ví dụ debounce 500ms
}

// Hàm debounce đơn giản (bạn có thể dùng thư viện như lodash hoặc tự viết tốt hơn)
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}