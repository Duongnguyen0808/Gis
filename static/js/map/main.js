// main.js (hoặc tệp khởi tạo chính của bạn)

import { initMap } from './mapConfig.js';
import { addLocationControl } from './locationControl.js'; // Đảm bảo import addLocationControl
import { setupRouteFunction } from './routeControl.js';
import { loadGeoJSONLayers } from './geojsonLayer.js';
import { setupSidebar } from './sidebar.js';
import { setupSearchControl } from './searchControl.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Khởi tạo bản đồ và chức năng...');

    // 1. Khởi tạo bản đồ
    const map = initMap();

    // 2. Thêm nút điều khiển vị trí (quan trọng: cần gọi trước map.locate để listener được thiết lập)
    addLocationControl(map);

    // 3. Gọi định vị tự động NGAY SAU KHI KHỞI TẠO MAP và ADD CONTROL
    console.log('Đang thử tự động định vị...');
    map.locate({
        setView: true,  // Tự động di chuyển map tới vị trí tìm được
        maxZoom: 16      // Mức zoom tối đa khi tự động di chuyển
    });
    // Lưu ý: Các listener 'locationfound' và 'locationerror' trong addLocationControl
    // sẽ tự động xử lý kết quả của lệnh map.locate() này.

    // 4. Thiết lập các chức năng khác
    setupRouteFunction(map);
    loadGeoJSONLayers(map);
    setupSidebar(map);
    setupSearchControl(map);

    console.log('Khởi tạo hoàn tất.');
});