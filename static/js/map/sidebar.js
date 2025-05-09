// sidebar.js (tiếp tục)...

import { calculateIsOpen } from './utils.js';

const sidebar = document.getElementById('sidebar');
const contentDiv = document.getElementById('sidebar-content');

let currentSidebarLatLng = null;
let currentSidebarProperties = null;

function getStatusDisplay(properties) {
    const now = new Date();
    const isOpen = calculateIsOpen(properties, now);

    if (isOpen === true) {
        return '<p><span class="status-badge status-open">Trạng thái: Đang mở cửa</span></p>';
    } else if (isOpen === false) {
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        const openTimeStr = properties?.opening_time;
        const timePattern = /^\d{1,2}:\d{2}$/;
        const currentDay = now.getDay();
        const isWorkingDay = currentDay !== 0;

        if (isWorkingDay && openTimeStr && timePattern.test(openTimeStr)) {
            try {
                const [openHour, openMinute] = openTimeStr.split(':').map(Number);
                if (!isNaN(openHour) && !isNaN(openMinute)) {
                    const openTimeInMinutes = openHour * 60 + openMinute;
                    if (currentTimeInMinutes < openTimeInMinutes) {
                        return '<p><span class="status-badge status-soon">Trạng thái: Chưa mở cửa</span></p>';
                    }
                }
            } catch (e) { /* Ignore parse errors */ }
        }
        return '<p><span class="status-badge status-closed">Trạng thái: Đã đóng cửa</span></p>';
    } else {
        return '<p><span class="status-badge status-unknown">Trạng thái: Không rõ</span></p>';
    }
}

export function setupSidebar(map) {
    const closeBtn = document.getElementById('close-sidebar');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideSidebar);
    } else {
        console.warn("Close sidebar button not found!");
    }

    map.on('fullscreenchange', () => {
        // Kiểm tra lại trạng thái của sidebar sau khi sự kiện fullscreenchange xảy ra
        if (sidebar && sidebar.classList.contains('open')) {
            // Đảm bảo sidebar vẫn hiển thị
            // (Có thể không cần thiết nếu CSS đã xử lý tốt, nhưng để chắc chắn)
            sidebar.style.display = 'block';

            // Bỏ dòng này nếu bạn không muốn sidebar tự động ẩn khi nhấp vào bản đồ trong fullscreen
            // map.once('click', hideSidebar);
        }
    });
}
export function showSidebar(properties, latlng, bankInfo) {
    // --- Bắt đầu hàm showSidebar ---
    if (!sidebar || !contentDiv) {
        console.error("Sidebar elements not found!");
        return;
    }
    // console.log("Dữ liệu properties nhận được:", properties); // Có thể bỏ comment nếu cần kiểm tra

    currentSidebarLatLng = latlng;
    currentSidebarProperties = properties;

    const statusHtml = getStatusDisplay(properties);
    const now = new Date();
    const isOpen = calculateIsOpen(properties, now);

    let openTimeHtml = `<p>Giờ mở cửa: <span class="${isOpen === true ? 'status-open-text' : 'status-closed-text'}">${properties.opening_time || 'Chưa cập nhật'}</span></p>`;
    let closeTimeHtml = `<p>Giờ đóng cửa: <span class="status-closed-text">${properties.closing_time || 'Chưa cập nhật'}</span></p>`;

    if (isOpen === true) {
        closeTimeHtml = `<p>Giờ đóng cửa: ${properties.closing_time || 'Chưa cập nhật'}</p>`;
    }

    // === PHẦN TẠO HTML CHO TÌNH TRẠNG ATM ===
    const hasAtm = properties.tinh_trang;
    let atmStatusHtml = '<span class="atm-status-unknown">Chưa cập nhật</span>';

    if (hasAtm === true) {
        atmStatusHtml = '<span class="atm-status-yes">Có</span>';
    } else if (hasAtm === false) {
        atmStatusHtml = '<span class="atm-status-no">Không</span>';
    }
    // === KẾT THÚC PHẦN TẠO HTML ===

    // Sử dụng biến atmStatusHtml chính xác trong innerHTML
    contentDiv.innerHTML = `
        <strong>${properties.name || 'N/A'}</strong> ${properties.hinh_anh_url ? `<img src="${properties.hinh_anh_url}" alt="${properties.name || 'Hình ảnh'}" style="max-width: 100%; height: auto; margin-top: 5px; margin-bottom: 5px;">` : ''}
        <p>Địa chỉ: ${properties.address || 'N/A'}</p>
        ${openTimeHtml}
        ${closeTimeHtml}
        ${statusHtml}
        <p>ATM: ${atmStatusHtml}</p> 
        <div style="text-align:center; margin-top:10px;"> <button class="leaflet-popup-button route-button">
            <i class="fas fa-directions"></i> Chỉ đường
        </button>
        </div>
    `;

    sidebar.classList.add('open');
    sidebar.classList.remove('closed');
    sidebar.style.display = 'block';

    const btn = contentDiv.querySelector('.route-button');
    if (btn) {
        btn.removeEventListener('click', routeButtonClickHandler);
        btn.addEventListener('click', routeButtonClickHandler);
    } else {
        console.warn("Route button not found inside sidebar content!");
    }
    // --- Kết thúc hàm showSidebar ---
}


function routeButtonClickHandler() {
    if (currentSidebarLatLng && currentSidebarProperties) {
        if (typeof window.findRouteToBank === 'function') {
            window.findRouteToBank(currentSidebarLatLng, currentSidebarProperties.name);
            hideSidebar();
        } else {
            console.error('window.findRouteToBank is not defined or not a function!');
            alert('Lỗi: Chức năng chỉ đường không khả dụng.');
        }
    } else {
        console.warn('Cannot find route: Missing latlng or properties.');
        alert('Không thể xác định địa điểm hoặc vị trí để chỉ đường.');
    }
}

export function hideSidebar() {
    if (sidebar) {
        sidebar.classList.remove('open');
        sidebar.classList.add('closed');
        const handleTransitionEnd = () => {
            sidebar.style.display = 'none';
            sidebar.removeEventListener('transitionend', handleTransitionEnd);
        };
        const style = window.getComputedStyle(sidebar);
        if (style.transitionDuration && style.transitionDuration !== '0s') {
            sidebar.addEventListener('transitionend', handleTransitionEnd);
        } else {
            sidebar.style.display = 'none';
        }
    }
}