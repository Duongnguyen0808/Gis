const sidebar = document.getElementById('sidebar');
const contentDiv = document.getElementById('sidebar-content');

let currentSidebarLatLng = null;
let currentSidebarProperties = null;

export function setupSidebar(map) {
  const closeBtn = document.getElementById('close-sidebar');
  if (closeBtn) closeBtn.addEventListener('click', hideSidebar);

  map.on('fullscreenchange', () => {
    if (sidebar && sidebar.classList.contains('open')) {
      map.once('click', hideSidebar);
    }
  });
}

export function showSidebar(properties, latlng, bankInfo) {
  if (!sidebar || !contentDiv) return;

  currentSidebarLatLng = latlng;
  currentSidebarProperties = properties;

  contentDiv.innerHTML = `
  <strong>${bankInfo.name}</strong>
  ${properties.hinh_anh_url ? `<img src="${properties.hinh_anh_url}" alt="${bankInfo.name}" style="max-width: 100%; height: auto;">` : ''}
  <p>Địa chỉ: ${properties.address || 'N/A'}</p>
  <p>Giờ mở cửa: ${bankInfo.openingTime || 'Chưa cập nhật'}</p>
  <p>Giờ đóng cửa: ${bankInfo.closingTime || 'Chưa cập nhật'}</p>
  <p>Lãi suất: ${properties.lai_suat || 'Chưa cập nhật'}</p>
  <div style="text-align:center;margin-top:8px;">
      <button class="leaflet-popup-button route-button">
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
  }
}

function routeButtonClickHandler() {
  if (currentSidebarLatLng && currentSidebarProperties) {
    // Cần đảm bảo window.findRouteToBank được định nghĩa ở nơi khác và có thể truy cập
    window.findRouteToBank(currentSidebarLatLng, currentSidebarProperties.name);
    hideSidebar();
  } else {
    console.warn('Không có thông tin địa điểm để chỉ đường.');
    alert('Không thể xác định địa điểm để chỉ đường.');
  }
}

export function hideSidebar() {
  if (sidebar) {
    sidebar.classList.remove('open');
    sidebar.classList.add('closed');
    setTimeout(() => {
      sidebar.style.display = 'none';
    }, 300);
  }
}