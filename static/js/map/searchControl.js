// static/js/map/searchControl.js

// Quan trọng: Đảm bảo allBankData và showSidebar được import hoặc có sẵn trong phạm vi
import { allBankData } from './geojsonLayer.js';
import { showSidebar } from './sidebar.js'; // Import showSidebar

// Hàm debounce đơn giản
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

    // CHỌN HỆ SỐ ƯỚC LƯỢNG TẠI ĐÂY - Điều chỉnh nếu cần
    const ESTIMATION_FACTOR = 1.3;

    if (!searchInput || !searchResultsList) {
        console.error("DEBUG Search: Search input or results list element not found.");
        return; // Không thể tiếp tục nếu thiếu element
    }

    searchInput.addEventListener('input', debounce(function () {
        const searchTerm = this.value.toLowerCase().trim();
        console.log("DEBUG Search: Input changed, Term =", searchTerm); // Log khi gõ

        // Ẩn danh sách kết quả cũ trước khi tìm kiếm mới
        searchResultsList.innerHTML = '';
        searchResultsList.style.display = 'none';

        if (searchTerm.length < 2) {
            console.log("DEBUG Search: Term too short.");
            return; // Không tìm nếu quá ngắn
        }

        // --- KIỂM TRA DỮ LIỆU CẦN THIẾT ---
        if (!window.currentUserLocation) {
            console.error("DEBUG Search: currentUserLocation is not available for searching.");
            searchResultsList.innerHTML = '<li>Lỗi: Vui lòng bật định vị để tìm kiếm và xem khoảng cách.</li>';
            searchResultsList.style.display = 'block'; // Hiển thị lỗi
            return;
        }
        console.log("DEBUG Search: Current location:", window.currentUserLocation);

        // Kiểm tra xem allBankData đã được tải chưa
        if (!allBankData || allBankData.length === 0) {
             console.error("DEBUG Search: allBankData is empty or not loaded yet.");
             searchResultsList.innerHTML = '<li>Lỗi: Dữ liệu ngân hàng chưa sẵn sàng. Vui lòng thử lại sau.</li>';
             searchResultsList.style.display = 'block'; // Hiển thị lỗi
             return;
        }
        console.log(`DEBUG Search: Searching within ${allBankData.length} banks.`);
        // --- KẾT THÚC KIỂM TRA ---

        searchResultsList.innerHTML = '<li><i>Đang tìm kiếm...</i></li>'; // Thông báo đang tìm
        searchResultsList.style.display = 'block'; // Hiện thông báo

        // 1. Lọc ngân hàng theo tên
        const filteredBanks = allBankData.filter(bank =>
            bank.properties.name.toLowerCase().includes(searchTerm)
        );
        console.log("DEBUG Search: Filtered Banks Count =", filteredBanks.length);

        if (filteredBanks.length === 0) {
            searchResultsList.innerHTML = '<li>Không tìm thấy ngân hàng nào phù hợp.</li>';
             searchResultsList.style.display = 'block'; // Đảm bảo hiện thông báo
            console.log("DEBUG Search: No banks found.");
            return;
        }

        // 2. Tính khoảng cách chim bay cho tất cả kết quả lọc được
        const banksWithAirDistance = filteredBanks.map(bank => {
            const bankLatLng = L.latLng(bank.geometry.coordinates[1], bank.geometry.coordinates[0]);
            // Tính khoảng cách từ vị trí hiện tại của người dùng
            const airDistance = window.currentUserLocation ? window.currentUserLocation.distanceTo(bankLatLng) : Infinity;
            return {
                ...bank,
                airDistance: airDistance // Lưu khoảng cách chim bay (mét)
            };
        });

        // 3. Sắp xếp theo khoảng cách chim bay (từ gần đến xa) - Giữ nguyên sắp xếp này
        banksWithAirDistance.sort((a, b) => a.airDistance - b.airDistance);

        // 4. Hiển thị kết quả đã sắp xếp
        searchResultsList.innerHTML = ''; // Xóa thông báo "Đang tìm kiếm..."

        banksWithAirDistance.forEach(bank => {
            console.log("DEBUG Search: Creating list item for:", bank.properties.name);
            const listItem = document.createElement('li');
            listItem.classList.add('list-group-item'); // Dùng class Bootstrap

            let distanceText = '';
            if (bank.airDistance !== Infinity) {
                // *** THAY ĐỔI TÍNH TOÁN KHOẢNG CÁCH ƯỚC LƯỢNG ***
                const estimatedRouteDistanceMeters = bank.airDistance * ESTIMATION_FACTOR; // Nhân với hệ số
                const distanceKm = (estimatedRouteDistanceMeters / 1000).toFixed(1); // Chuyển km, làm tròn
                // Hiển thị: ví dụ " (khoảng 1.5 km)"
                distanceText = ` (khoảng ${distanceKm} km)`;
                // Hoặc nếu muốn ngắn gọn: distanceText = ` (${distanceKm} km)`;
                // ****************************************************

            } else {
                 distanceText = ' (Không rõ k/c)'; // Trường hợp không tính được
            }

            listItem.textContent = `${bank.properties.name}${distanceText}`; // Sử dụng distanceText đã tính
            listItem.style.cursor = 'pointer'; // Thêm con trỏ

            listItem.addEventListener('click', () => {
                console.log("DEBUG Search: Clicked on result:", bank.properties.name);
                const coords = bank.geometry.coordinates;
                const bankLatLng = L.latLng(coords[1], coords[0]);
                map.setView(bankLatLng, 16); // Zoom đến ngân hàng

                // Tìm và kích hoạt popup/sidebar của marker tương ứng (giữ nguyên)
                let foundMarker = false;
                map.eachLayer(layer => {
                     // Kiểm tra xem layer có phải là marker và có feature tương ứng không
                    if (layer instanceof L.Marker && layer.feature && layer.feature.properties.name === bank.properties.name) {
                         // Kiểm tra xem marker có đang được hiển thị trên map không (nếu có quản lý layer)
                        if (map.hasLayer(layer)) {
                             layer.fire('click'); // Kích hoạt sự kiện click của marker để mở sidebar/popup
                             foundMarker = true;
                             console.log("DEBUG Search: Fired click on marker:", bank.properties.name);
                        }
                    }
                });

                // *** FALLBACK: Gọi trực tiếp showSidebar nếu không tìm thấy marker *** (giữ nguyên)
                if (!foundMarker) {
                    console.warn("DEBUG Search: Could not find the corresponding marker on the map for", bank.properties.name, ". Showing sidebar directly.");
                    // Gọi hàm showSidebar trực tiếp với dữ liệu của ngân hàng được click
                    showSidebar(bank.properties, bankLatLng, bank.options?.bankInfo || {});
                }

                // *** QUAN TRỌNG: Vẫn gọi hàm chỉ đường thực tế khi click ***
                // Hàm này sẽ tính và hiển thị đường đi CHÍNH XÁC trên bản đồ
                window.findRouteToBank(bankLatLng, bank.properties.name);


                searchResultsList.innerHTML = ''; // Xóa danh sách kết quả
                searchResultsList.style.display = 'none'; // Ẩn danh sách
                searchInput.value = ''; // Xóa ô tìm kiếm
            });
            searchResultsList.appendChild(listItem);
        });


        // Luôn đảm bảo danh sách được hiển thị nếu có nội dung (kết quả hoặc thông báo lỗi)
        if (searchResultsList.innerHTML !== '') {
             searchResultsList.style.display = 'block';
             console.log("DEBUG Search: Displaying search results list.");
        } else {
             searchResultsList.style.display = 'none'; // Ẩn nếu không có gì cả
             console.log("DEBUG Search: Hiding empty search results list.");
        }

        // --- Không cần gọi OSRM hay routing gì ở đây nữa ---

    }, 300)); // Giữ nguyên debounce
}