// static/js/map/searchControl.js

import { allBankData } from './geojsonLayer.js';
import { showSidebar } from './sidebar.js'; // Import showSidebar từ code mới

// Hàm debounce đơn giản (giữ nguyên từ code cũ/mới)
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

export function setupSearchControl(map) {
    const searchInput = document.getElementById('searchInput');
    const searchResultsList = document.getElementById('searchResults');

    // --- CẤU HÌNH ---
    // !!! QUAN TRỌNG: Thay đổi URL này nếu bạn có OSRM server riêng hoặc dùng dịch vụ khác
    const OSRM_SERVICE_URL = 'https://router.project-osrm.org/route/v1';
    const DEBOUNCE_WAIT_MS = 500; // Thời gian chờ (ms) sau khi ngừng gõ mới tìm kiếm

    if (!searchInput || !searchResultsList) {
        console.error("DEBUG Search: Search input or results list element not found.");
        return; // Không thể tiếp tục nếu thiếu element
    }

    // Kiểm tra xem Leaflet Routing Machine đã được tải chưa
    if (typeof L.Routing === 'undefined' || typeof L.Routing.osrmv1 === 'undefined') {
        console.error("DEBUG Search: Leaflet Routing Machine (L.Routing.osrmv1) is not loaded. Cannot calculate route distances.");
        // Có thể hiển thị lỗi cho người dùng ở đây
        searchResultsList.innerHTML = '<li>Lỗi: Không thể tải thư viện tính khoảng cách.</li>';
        return;
    }

    searchInput.addEventListener('input', debounce(function () {
        const searchTerm = this.value.toLowerCase().trim();
        console.log("DEBUG Search: Input changed, Term =", searchTerm);

        // Ẩn/Xóa kết quả cũ
        searchResultsList.innerHTML = '';
        searchResultsList.style.display = 'none';

        if (searchTerm.length < 2) {
            console.log("DEBUG Search: Term too short.");
            return; // Không tìm nếu quá ngắn
        }

        // --- KIỂM TRA DỮ LIỆU CẦN THIẾT ---
        if (!window.currentUserLocation) {
            console.error("DEBUG Search: currentUserLocation is not available.");
            searchResultsList.innerHTML = '<li>Lỗi: Vui lòng bật định vị để tìm kiếm và xem khoảng cách.</li>';
            searchResultsList.style.display = 'block';
            // alert('Vui lòng bật định vị để xem khoảng cách.'); // Có thể bỏ alert nếu đã hiện lỗi
            return;
        }
        console.log("DEBUG Search: Current location:", window.currentUserLocation);

        if (!allBankData || allBankData.length === 0) {
            console.error("DEBUG Search: allBankData is empty or not loaded yet.");
            searchResultsList.innerHTML = '<li>Lỗi: Dữ liệu ngân hàng chưa sẵn sàng.</li>';
            searchResultsList.style.display = 'block';
            return;
        }
        console.log(`DEBUG Search: Filtering within ${allBankData.length} banks.`);
        // --- KẾT THÚC KIỂM TRA ---

        searchResultsList.innerHTML = '<li><i>Đang tìm và tính khoảng cách...</i></li>'; // Thông báo đang xử lý
        searchResultsList.style.display = 'block';

        // 1. Lọc ngân hàng theo tên
        const filteredBanks = allBankData.filter(bank =>
            bank.properties.name.toLowerCase().includes(searchTerm)
        );
        console.log("DEBUG Search: Filtered Banks Count =", filteredBanks.length);

        if (filteredBanks.length === 0) {
            searchResultsList.innerHTML = '<li>Không tìm thấy ngân hàng nào phù hợp.</li>';
            searchResultsList.style.display = 'block';
            console.log("DEBUG Search: No banks found.");
            return;
        }

        // 2. Tạo các promise để tính toán lộ trình cho từng ngân hàng
        console.log("DEBUG Search: Starting route calculations...");
        const routingPromises = filteredBanks.map(bank => {
            return new Promise((resolve) => { // Không cần reject ở đây, resolve với kết quả (thành công hoặc lỗi)
                const bankLatLng = L.latLng(bank.geometry.coordinates[1], bank.geometry.coordinates[0]);

                // Tạo router OSRM (không cần thêm vào map)
                const router = L.Routing.osrmv1({
                    serviceUrl: OSRM_SERVICE_URL,
                    // Các tùy chọn khác nếu cần (profile: 'driving', 'walking', 'cycling')
                    // profile: 'driving' // Mặc định thường là driving
                });

                // Gọi API tính lộ trình
                router.route(
                    [
                        { latLng: window.currentUserLocation }, // Điểm bắt đầu
                        { latLng: bankLatLng }             // Điểm kết thúc
                    ],
                    (error, routes) => {
                        if (!error && routes && routes.length > 0) {
                            const route = routes[0]; // Lấy lộ trình đầu tiên
                            console.log(`DEBUG Search: Route found for ${bank.properties.name} - Distance: ${route.summary.totalDistance}m`);
                            resolve({
                                ...bank, // Giữ lại thông tin ngân hàng gốc
                                routeDistance: route.summary.totalDistance, // Khoảng cách thực tế (mét)
                                fallbackDistance: null // Không cần fallback nếu thành công
                            });
                        } else {
                            console.error(`DEBUG Search: Routing error for ${bank.properties.name}:`, error);
                            // Nếu lỗi, tính khoảng cách đường chim bay làm dự phòng
                            const fallbackDistance = window.currentUserLocation.distanceTo(bankLatLng);
                            resolve({
                                ...bank,
                                routeDistance: null, // Đánh dấu là không tính được route
                                fallbackDistance: fallbackDistance // Khoảng cách đường chim bay (mét)
                            });
                        }
                    }
                );
            });
        });

        // 3. Chờ tất cả các tính toán lộ trình hoàn tất
        Promise.all(routingPromises).then(banksWithDistances => {
            console.log("DEBUG Search: All route calculations finished.");

            // 4. Sắp xếp kết quả dựa trên khoảng cách
            // Ưu tiên khoảng cách lộ trình (routeDistance), nếu không có thì dùng fallbackDistance
            banksWithDistances.sort((a, b) => {
                // Dùng Infinity nếu cả hai đều null để đẩy xuống cuối
                const distA = a.routeDistance ?? a.fallbackDistance ?? Infinity;
                const distB = b.routeDistance ?? b.fallbackDistance ?? Infinity;
                return distA - distB;
            });

            // 5. Hiển thị kết quả đã sắp xếp
            searchResultsList.innerHTML = ''; // Xóa thông báo "Đang tìm..."

            if (banksWithDistances.length === 0) { // Kiểm tra lại (dù đã check ở trên)
                 searchResultsList.innerHTML = '<li>Không tìm thấy ngân hàng nào phù hợp.</li>';
            } else {
                banksWithDistances.forEach(bank => {
                    console.log("DEBUG Search: Creating list item for:", bank.properties.name);
                    const listItem = document.createElement('li');
                    listItem.classList.add('list-group-item'); // Dùng class Bootstrap nếu có
                    listItem.style.cursor = 'pointer';

                    let distanceText = '';
                    if (bank.routeDistance !== null) {
                        // Hiển thị khoảng cách lộ trình thực tế
                        const distanceKm = (bank.routeDistance / 1000).toFixed(1); // Làm tròn 1 chữ số thập phân
                        distanceText = ` (${distanceKm} km)`; // Bỏ chữ "khoảng"
                    } else if (bank.fallbackDistance !== null) {
                        // Hiển thị khoảng cách đường chim bay nếu tính lộ trình lỗi
                        const fallbackKm = (bank.fallbackDistance / 1000).toFixed(1);
                        distanceText = ` (~${fallbackKm} km)`; // Thêm dấu ~ cho đường chim bay
                    } else {
                         distanceText = ' (Không rõ k/c)'; // Trường hợp cả hai đều lỗi
                    }

                    listItem.textContent = `${bank.properties.name}${distanceText}`;

                    // 6. Gắn sự kiện click (kết hợp từ code mới)
                    listItem.addEventListener('click', () => {
                        console.log("DEBUG Search: Clicked on result:", bank.properties.name);
                        const coords = bank.geometry.coordinates;
                        const bankLatLng = L.latLng(coords[1], coords[0]);

                        // Zoom tới vị trí
                        map.setView(bankLatLng, 16); // Zoom gần hơn một chút

                        // Tìm và kích hoạt marker (giống code mới)
                        let foundMarker = false;
                        map.eachLayer(layer => {
                            if (layer instanceof L.Marker && layer.feature && layer.feature.properties.name === bank.properties.name) {
                               if (map.hasLayer(layer)) {
                                   // Ưu tiên kích hoạt marker click để mở popup/sidebar chuẩn
                                   layer.fire('click');
                                   foundMarker = true;
                                   console.log("DEBUG Search: Fired click on marker:", bank.properties.name);
                               }
                            }
                        });

                         // Fallback: Gọi trực tiếp showSidebar nếu không tìm thấy marker (giống code mới)
                        if (!foundMarker) {
                            console.warn("DEBUG Search: Could not find the corresponding marker. Showing sidebar directly.");
                            // Cần đảm bảo bank.options.bankInfo có tồn tại hoặc xử lý null/undefined
                            const bankInfo = bank.options?.bankInfo || {};
                            showSidebar(bank.properties, bankLatLng, bankInfo);
                        }

                        // *** QUAN TRỌNG: Gọi hàm vẽ chỉ đường thực tế trên bản đồ ***
                        // Hàm này nên được định nghĩa ở đâu đó global hoặc import/pass vào
                        if (window.findRouteToBank) {
                             console.log("DEBUG Search: Calling window.findRouteToBank");
                             window.findRouteToBank(bankLatLng, bank.properties.name);
                        } else {
                             console.warn("DEBUG Search: window.findRouteToBank function is not defined.");
                        }


                        // Xóa kết quả tìm kiếm
                        searchResultsList.innerHTML = '';
                        searchResultsList.style.display = 'none';
                        searchInput.value = ''; // Xóa ô tìm kiếm
                    });

                    searchResultsList.appendChild(listItem);
                });
            }

            // Đảm bảo danh sách hiển thị sau khi có kết quả hoặc thông báo lỗi
            searchResultsList.style.display = 'block';
            console.log("DEBUG Search: Displaying final search results list.");

        }).catch(error => {
            // Xử lý lỗi nếu Promise.all thất bại (hiếm khi xảy ra nếu các promise con đều resolve)
            console.error("DEBUG Search: Error processing routing promises:", error);
            searchResultsList.innerHTML = '<li>Có lỗi xảy ra khi tính toán khoảng cách.</li>';
            searchResultsList.style.display = 'block';
        });

    }, DEBOUNCE_WAIT_MS)); // Sử dụng debounce
}