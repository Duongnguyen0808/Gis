import { initMap } from './mapConfig.js';
import { addLocationControl } from './locationControl.js';
import { setupRouteFunction } from './routeControl.js';
import { loadGeoJSONLayers } from './geojsonLayer.js';
import { setupSidebar } from './sidebar.js';
import { setupSearchControl } from './searchControl.js'; // Import

document.addEventListener('DOMContentLoaded', () => {
    console.log('Khởi tạo bản đồ và chức năng...');

    const map = initMap();
    addLocationControl(map);
    setupRouteFunction(map);
    loadGeoJSONLayers(map);
    setupSidebar(map);
    setupSearchControl(map); // Gọi hàm thiết lập tìm kiếm

    console.log('Khởi tạo hoàn tất.');
});