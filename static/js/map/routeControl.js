// routeControl.js (Phiên bản: Panel tùy chỉnh + Click để zoom vào đoạn đường)

let currentUserLocation = null;
let currentRouteControl = null;
let fullRouteData = null; // *** THÊM: Biến lưu trữ toàn bộ dữ liệu route hiện tại ***
let highlightedSegmentLayer = null; // *** THÊM: Biến lưu trữ layer highlight ***

// --- Hàm formatDistance (Giữ nguyên) ---
function formatDistance(meters) { /* ... code như cũ ... */
    if (meters < 1000) { return `${Math.round(meters)} m`; }
    else { return `${(meters / 1000).toFixed(1)} km`; }
}

// --- Hàm getVietnameseInstruction (Giữ nguyên) ---
function getVietnameseInstruction(step) { /* ... code như cũ, đã sửa ở lần trước ... */
    const type = step.type || ''; const modifier = step.modifier || ''; const road = step.road || step.name || '';
    const bearing = step.bearing; const exit = step.exit; let instruction = '';
    // console.log('[Translate Step] Data:', { type: type, modifier: modifier, road: road, exit: exit, bearing: bearing, _fullStepData: step });
    const directionTranslations = { 'left': 'trái', 'right': 'phải', 'sharp left': 'gấp sang trái', 'sharp right': 'gấp sang phải', 'slight left': 'nhẹ sang trái', 'slight right': 'nhẹ sang phải', 'straight': 'thẳng', 'uturn': 'quay đầu' };
    const translateModifier = (mod) => directionTranslations[mod.toLowerCase()] || mod;
    switch (type) {
        case 'Left': case 'Right': case 'SharpLeft': case 'SharpRight': case 'SlightLeft': case 'SlightRight': case 'Uturn': instruction = `Rẽ ${translateModifier(type)}`; if (road) instruction += ` vào ${road}`; break;
        case 'Turn': instruction = `Rẽ ${translateModifier(modifier)}`; if (road) instruction += ` vào ${road}`; break;
        case 'Depart': case 'Head': let direction = modifier; if (!direction) { if (bearing >= 0 && bearing < 22.5) direction = 'bắc'; else if (bearing >= 22.5 && bearing < 67.5) direction = 'đông bắc'; else if (bearing >= 67.5 && bearing < 112.5) direction = 'đông'; else if (bearing >= 112.5 && bearing < 157.5) direction = 'đông nam'; else if (bearing >= 157.5 && bearing < 202.5) direction = 'nam'; else if (bearing >= 202.5 && bearing < 247.5) direction = 'tây nam'; else if (bearing >= 247.5 && bearing < 292.5) direction = 'tây'; else if (bearing >= 292.5 && bearing < 337.5) direction = 'tây bắc'; else if (bearing >= 337.5) direction = 'bắc'; else direction = ''; } else { const dirTranslationsLog = { 'northwest': 'tây bắc', 'southwest': 'tây nam', 'north': 'bắc', 'south': 'nam', 'east': 'đông', 'west': 'tây', 'northeast': 'đông bắc', 'southeast': 'đông nam' }; direction = dirTranslationsLog[modifier.toLowerCase()] || modifier;} instruction = `Đi về hướng ${direction}`; if (road) instruction += ` vào ${road}`; break;
        case 'Continue': instruction = `Tiếp tục đi ${translateModifier(modifier)}`; if (road) instruction += ` trên ${road}`; break;
        case 'Straight': instruction = `Đi thẳng`; if (road) instruction += ` vào ${road}`; break;
        case 'NewName': case 'new name': instruction = `Đi tiếp vào ${road}`; break;
        case 'Merge': instruction = `Nhập vào ${translateModifier(modifier)}`; if (road) instruction += ` ${road}`; break;
        case 'OnRamp': case 'Ramp': instruction = `Đi vào đường nhánh ${translateModifier(modifier)}`; break;
        case 'OffRamp': instruction = `Ra khỏi đường nhánh ${translateModifier(modifier)}`; if (road) instruction += ` vào ${road}`; break;
        case 'Fork': instruction = `Đi theo nhánh ${translateModifier(modifier)}`; break;
        case 'EndOfRoad': instruction = `Rẽ ${translateModifier(modifier)}`; if (road) instruction += ` vào ${road}`; break;
        case 'Roundabout': case 'Rotary': instruction = `Đi vào vòng xuyến/xoay và ra ở lối thứ ${exit || modifier || 'tiếp theo'}`; break;
        case 'DestinationReached': instruction = `Bạn đã đến nơi`; if (road) instruction += `: ${road}`; break;
        default: instruction = step.text || `${type} ${modifier || ''} ${road || ''}`.trim(); console.warn(`[getVietnameseInstruction] Không xử lý: type="${type}", modifier="${modifier}". Text: "${instruction}"`);
    }
    return instruction;
}


// --- HÀM HIỂN THỊ BẢNG CHỈ ĐƯỜNG (CẬP NHẬT ĐỂ XỬ LÝ CLICK VÀ HIGHLIGHT) ---
/**
 * Hiển thị chi tiết lộ trình và xử lý click để zoom vào đoạn đường.
 * @param {object} route Đối tượng route đầy đủ từ LRM (chứa steps, summary, coordinates).
 * @param {L.Map} map Đối tượng bản đồ Leaflet.
 */
function displayCustomRoute(route, map) {
     console.log('[Display Custom] Bắt đầu tạo HTML, gắn sự kiện và highlight...');
     // Lấy các thành phần cần thiết
     const sidebar = document.getElementById('sidebar');
     const contentDiv = document.getElementById('sidebar-content');
     const mapElement = document.getElementById('map');
     // Trích xuất dữ liệu từ route object
     const steps = route.instructions || (route.legs && route.legs[0] ? route.legs[0].steps : []);
     const summary = route.summary;
     const coordinates = route.coordinates; // *** Lấy mảng tọa độ đầy đủ ***

     if (!sidebar || !contentDiv || !mapElement || !map || !Array.isArray(coordinates)) {
         console.error('[Display Custom] Thiếu phần tử UI, map hoặc route.coordinates!');
         return;
     }
     if (!Array.isArray(steps) || steps.length === 0) {
         console.warn('[Display Custom] Không có steps (instructions) để hiển thị.');
         // Hiển thị thông báo lỗi hoặc tóm tắt thôi cũng được
         contentDiv.innerHTML = `<div class="custom-routing-panel"><p>Không có chi tiết chỉ đường.</p></div>`;
         sidebar.classList.add('open'); sidebar.classList.remove('closed'); sidebar.style.display = 'block'; mapElement.classList.add('sidebar-open');
         return;
     }


     let htmlContent = '<div class="custom-routing-panel">';
     // 1. Tóm tắt (Giữ nguyên)
     if (summary) { const totalTimeMinutes = summary.totalTime ? Math.round(summary.totalTime / 60) : 0; const totalDistanceFormatted = summary.totalDistance ? formatDistance(summary.totalDistance) : 'Không rõ'; htmlContent += `<div class="custom-route-summary"><h4>Tóm tắt lộ trình</h4><p><i class="fas fa-road"></i> ${totalDistanceFormatted}</p><p><i class="far fa-clock"></i> Khoảng ${totalTimeMinutes} phút</p></div>`; }
     // 2. Chi tiết
     htmlContent += `<h5 class="custom-route-instructions-title">Chi tiết chỉ đường:</h5><ol class="custom-route-instructions-list">`;
     steps.forEach((step, index) => {
         const instructionText = getVietnameseInstruction(step);
         const distanceFormatted = step.distance ? formatDistance(step.distance) : '';

         // ** Lấy chỉ số bắt đầu và kết thúc của đoạn đường cho bước này **
         const startIndex = step.index; // Index của điểm bắt đầu trong route.coordinates
         // Index của điểm kết thúc là index của bước tiếp theo, hoặc là điểm cuối cùng của lộ trình
         const endIndex = (index + 1 < steps.length) ? steps[index + 1].index : coordinates.length -1; // Lấy index cuối cùng

         if (instructionText && startIndex !== undefined && endIndex !== undefined) {
             htmlContent += `<li class="custom-route-instruction-item"
                                 data-start-index="${startIndex}"
                                 data-end-index="${endIndex}"
                                 style="cursor: pointer;" >`; // Luôn có cursor pointer
             htmlContent += `<span class="instruction-text">${instructionText}</span>`;
             if (distanceFormatted) { htmlContent += `<span class="instruction-distance">${distanceFormatted}</span>`; }
             htmlContent += `</li>`;
         } else {
             console.warn(`[Display Custom] Bỏ qua bước ${index} do thiếu chỉ dẫn hoặc index.`);
         }
     });
     htmlContent += `</ol>`;
     // 3. Nút Đóng (Giữ nguyên)
     htmlContent += `<div style="text-align:center; margin-top:15px; padding-bottom: 10px;"><button id="close-custom-route-panel" class="leaflet-popup-button" style="background-color: #6c757d; color: white;"><i class="fas fa-times"></i> Đóng Chỉ Đường</button></div>`;
     htmlContent += `</div>`;

     // 4. Hiển thị vào Sidebar
     contentDiv.innerHTML = htmlContent;
     sidebar.classList.add('open'); sidebar.classList.remove('closed'); sidebar.style.display = 'block'; mapElement.classList.add('sidebar-open');

     // 5. ** GẮN SỰ KIỆN CLICK MỚI (ĐỂ ZOOM VÀO ĐOẠN ĐƯỜNG) **
     const instructionItems = contentDiv.querySelectorAll('.custom-route-instruction-item[data-start-index]');
     console.log(`[Display Custom] Tìm thấy ${instructionItems.length} instruction items có data-start-index để gắn click.`);

     instructionItems.forEach((item, itemIndex) => {
         item.addEventListener('click', function(e) {
             e.stopPropagation();
             const startIndex = parseInt(this.dataset.startIndex);
             const endIndex = parseInt(this.dataset.endIndex);
             const zoomPadding = 0.1; // Khoảng đệm khi zoom (vd: 0.1 = 10%)

             console.log(`[Instruction Click] Step ${itemIndex + 1}: Zoom vào đoạn từ index ${startIndex} đến ${endIndex}`);

             if (!isNaN(startIndex) && !isNaN(endIndex) && startIndex <= endIndex && endIndex < coordinates.length) {
                 try {
                     // Lấy các tọa độ LatLng cho đoạn đường này
                     // Cần slice từ startIndex đến endIndex + 1 để bao gồm cả điểm cuối
                     const segmentCoordsRaw = coordinates.slice(startIndex, endIndex + 1);
                     // Chuyển đổi sang L.LatLng (Kiểm tra cấu trúc tọa độ trong coordinates: {lat,lng} hay [lng,lat]?)
                     const segmentLatLngs = segmentCoordsRaw.map(coord => {
                         if (coord && typeof coord.lat === 'number' && typeof coord.lng === 'number') {
                             return L.latLng(coord.lat, coord.lng); // Nếu là object {lat, lng}
                         } else if (Array.isArray(coord) && typeof coord[1] === 'number' && typeof coord[0] === 'number') {
                             return L.latLng(coord[1], coord[0]); // Nếu là array [lng, lat]
                         }
                         console.warn("[Instruction Click] Định dạng tọa độ không xác định:", coord);
                         return null;
                     }).filter(latLng => latLng !== null); // Lọc bỏ các tọa độ null nếu có lỗi

                     if (segmentLatLngs.length >= 2) { // Cần ít nhất 2 điểm để tạo bounds
                         const bounds = L.latLngBounds(segmentLatLngs);
                         map.fitBounds(bounds.pad(zoomPadding)); // Zoom vào đoạn đường với padding

                         // --- Highlight đoạn đường ---
                         // Xóa highlight cũ nếu có
                         if (highlightedSegmentLayer && map.hasLayer(highlightedSegmentLayer)) {
                             map.removeLayer(highlightedSegmentLayer);
                         }
                         // Tạo và thêm layer highlight mới
                         highlightedSegmentLayer = L.polyline(segmentLatLngs, {
                             color: '#FF0000', // Màu đỏ nổi bật
                             weight: 6,       // Dày hơn đường gốc
                             opacity: 0.8
                         }).addTo(map);
                         // --- Hết Highlight ---

                     } else if (segmentLatLngs.length === 1) {
                          // Nếu chỉ có 1 điểm (ví dụ bước cuối cùng), chỉ setView
                          map.setView(segmentLatLngs[0], 18);
                          // Xóa highlight cũ nếu có
                           if (highlightedSegmentLayer && map.hasLayer(highlightedSegmentLayer)) {
                                map.removeLayer(highlightedSegmentLayer);
                                highlightedSegmentLayer = null;
                           }
                     } else {
                          console.warn(`[Instruction Click] Không đủ tọa độ hợp lệ (${segmentLatLngs.length}) cho đoạn từ ${startIndex} đến ${endIndex}.`);
                     }

                     // Highlight dòng chữ trong panel
                     instructionItems.forEach(el => el.classList.remove('selected-instruction'));
                     this.classList.add('selected-instruction');

                 } catch (mapError) {
                      console.error("Lỗi khi xử lý click hoặc zoom bản đồ:", mapError);
                 }
             } else {
                 console.warn(`[Instruction Click] Chỉ số index không hợp lệ: start=${startIndex}, end=${endIndex}`);
             }
         });
     });

     // 6. Gắn sự kiện cho nút đóng panel
     const closeCustomBtn = document.getElementById('close-custom-route-panel');
     if(closeCustomBtn) {
         closeCustomBtn.onclick = () => {
             // Xóa highlight khi đóng panel
             if (highlightedSegmentLayer && map.hasLayer(highlightedSegmentLayer)) {
                  map.removeLayer(highlightedSegmentLayer);
                  highlightedSegmentLayer = null;
             }
             // Đóng sidebar và xóa control
             if (typeof hideSidebar === 'function') { hideSidebar(); }
             else { sidebar.classList.remove('open'); sidebar.classList.add('closed'); sidebar.style.display = 'none'; mapElement.classList.remove('sidebar-open'); }
             if (currentRouteControl) { map.removeControl(currentRouteControl); currentRouteControl = null; console.log('[Custom Panel] Đã xóa LRM control ẩn.'); }
         };
     }
     console.log('[Display Custom] Hoàn tất hiển thị và gắn sự kiện.');
}


// --- Hàm setup chính ---
export function setupRouteFunction(map) {
    map.on('locationfound', (e) => { window.currentUserLocation = e.latlng; /* ... log ... */ });
    map.on('locationerror', (e) => { console.error('[Route] Lỗi định vị:', e.message); });

    window.findRouteToBank = function (destinationLatLng, bankName = 'Ngân hàng được chọn') {
        if (!window.currentUserLocation) { /* ... alert ... */ return; }
        // Xóa control và highlight cũ trước khi tìm đường mới
        if (currentRouteControl) { map.removeControl(currentRouteControl); currentRouteControl = null; }
        if (highlightedSegmentLayer && map.hasLayer(highlightedSegmentLayer)) { map.removeLayer(highlightedSegmentLayer); highlightedSegmentLayer = null;}


        console.log(`[Route] Bắt đầu tìm đường (panel tùy chỉnh + zoom) từ ${window.currentUserLocation} đến ${bankName}`);
        try {
            currentRouteControl = L.Routing.control({
                waypoints: [ L.latLng(window.currentUserLocation), L.latLng(destinationLatLng) ],
                show: false, // <-- Vẫn ẩn panel
                routeWhileDragging: false,
                // Yêu cầu trả về tọa độ đầy đủ và các bước
                router: L.Routing.osrmv1({
                    serviceUrl: 'https://router.project-osrm.org/route/v1',
                    profile: 'driving',
                    steps: true,
                    coordinates: true, // Thử yêu cầu rõ ràng coordinates
                    overview: 'full', // Lấy 'full' để đảm bảo có đủ tọa độ
                    annotations: false // Tắt annotations không cần thiết
                 }),
                createMarker: function (i, wp, n) { /* ... code createMarker như cũ ... */ const isStart = i === 0; const iconHtml = isStart ? '<i class="fas fa-user-circle fa-lg" style="color:blue;"></i>' : '<i class="fas fa-university fa-lg" style="color:darkred;"></i>'; return L.marker(wp.latLng, { icon: L.divIcon({ className: isStart ? 'route-start-icon' : 'route-end-icon', html: iconHtml, iconSize: [24, 24], iconAnchor: [12, 12], }), draggable: false }).bindPopup(isStart ? 'Vị trí của bạn' : bankName); },
                // ** QUAN TRỌNG: Thêm tùy chọn để LRM vẽ đường đi gốc **
                routeLine: function(route, options) {
                    // Vẽ đường màu xanh dương mặc định
                     return L.polyline(route.coordinates, { color: '#03f', weight: 5, opacity: 0.6 });
                 },
                 // Hoặc dùng lineOptions đơn giản hơn:
                 // lineOptions: {
                 //     styles: [{color: 'blue', opacity: 0.6, weight: 6}]
                 // }

            }).addTo(map);

             console.log('[Route] Đã thêm control LRM ẩn và yêu cầu vẽ đường.');

             currentRouteControl.on('routesfound', function(e) {
                 console.log('[Route] Sự kiện routesfound -> chuẩn bị dữ liệu...');
                 if (e.routes && e.routes.length > 0) {
                     const route = e.routes[0];
                      // *** LƯU LẠI DỮ LIỆU ROUTE ĐẦY ĐỦ ***
                      fullRouteData = route; // Lưu lại để dùng trong event click

                     const steps = route.instructions || (route.legs && route.legs[0] ? route.legs[0].steps : []);
                     const summary = route.summary;

                     if (Array.isArray(steps) && steps.length > 0 && Array.isArray(route.coordinates)) {
                         // Truyền toàn bộ route và map vào hàm hiển thị
                         displayCustomRoute(route, map);
                     } else {
                         alert('Không có chi tiết chỉ đường hoặc tọa độ.');
                         console.error('[Route] Dữ liệu steps hoặc coordinates không hợp lệ.');
                    }
                 } else { /* ... xử lý không có route ... */ }
             });

             currentRouteControl.on('routingerror', function(e){ /* ... xử lý lỗi routing ... */ });

        } catch (error) { /* ... xử lý lỗi tạo control ... */ }
    };
}

