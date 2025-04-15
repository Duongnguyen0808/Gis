/* eslint-disable no-undef */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Khởi tạo bản đồ và chức năng...');

  // === KHỞI TẠO MAP ===
  const config = {
    minZoom: 7,
    maxZoom: 18,
  };
  const initialLat = 10.8231;
  const initialLng = 106.6297;
  const map = L.map('map', config).setView([initialLat, initialLng], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);

  // === BIẾN LƯU TRỮ TRẠNG THÁI ===
  let currentUserLocation = null;
  let currentRouteControl = null;
  let locationMarker = null;
  const activeLayers = {};
  let isSidebarOpen = false;
  let currentMarker = null;

  // === CHỨC NĂNG ĐỊNH VỊ ===
  const LocationControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function (map) {
      const container = L.DomUtil.create(
        'div',
        'leaflet-bar leaflet-control leaflet-control-custom location-button'
      );
      container.style.backgroundColor = 'white';
      container.style.width = '34px';
      container.style.height = '34px';
      container.style.cursor = 'pointer';
      container.title = 'Tìm vị trí của tôi';
      container.innerHTML =
        '<a href="#" role="button" aria-label="Tìm vị trí của tôi" style="font-size: 1.2em; text-align: center; display: block; line-height: 34px; color: #333;"><i class="fas fa-crosshairs"></i></a>';
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(container, 'click', function (ev) {
        L.DomEvent.stopPropagation(ev);
        console.log('Nút tìm vị trí (map.locate) được nhấn.');
        map.locate({ setView: true, maxZoom: 16 });
      });
      return container;
    },
  });
  map.addControl(new LocationControl());

  function onLocationFound(e) {
    console.log('Location found by map.locate(): ', e.latlng);
    currentUserLocation = e.latlng;
    if (locationMarker) {
      map.removeLayer(locationMarker);
    }
    locationMarker = L.marker(e.latlng, {
      icon: L.divIcon({
        className: 'user-location-icon',
        html: '<i class="fas fa-user-circle fa-lg" style="color:blue;"></i>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    })
      .addTo(map)
      .bindPopup('Vị trí của bạn');
  }
  map.on('locationfound', onLocationFound);

  function onLocationError(e) {
    alert('Không thể lấy được vị trí của bạn. Lỗi: ' + e.message);
    console.error('Location error (map.locate): ', e);
    currentUserLocation = null;
  }
  map.on('locationerror', onLocationError);

  // === HÀM TÌM ĐƯỜNG ===
  function findRouteToBank(destinationLatLng, bankName = 'Ngân hàng được chọn') {
    console.log(
      `Yêu cầu tìm đường đến: ${bankName} tại ${destinationLatLng.toString()}`
    );
    if (!currentUserLocation) {
      alert('Vui lòng nhấn nút \'Tìm vị trí của tôi\' trước.');
      return;
    }
    if (typeof L.routing === 'undefined') {
      alert(
        'Lỗi: Chức năng tìm đường không hoạt động do thư viện Leaflet Routing Machine chưa được tải.'
      );
      console.error('Leaflet Routing Machine (L.routing) is undefined.');
      return;
    }
    if (currentRouteControl) {
      map.removeControl(currentRouteControl);
      currentRouteControl = null;
    }
    const startPoint = L.latLng(currentUserLocation);
    const endPoint = L.latLng(destinationLatLng);
    console.log(`Tìm đường từ: ${startPoint.toString()} đến: ${endPoint.toString()}`);
    currentRouteControl = L.routing.control({
      waypoints: [startPoint, endPoint],
      routeWhileDragging: false,
      show: true,
      language: 'en',
      createMarker: function (i, wp, n) {
        let markerIcon = null;
        let popupContent = '';
        if (i === 0) {
          markerIcon = L.divIcon({
            className: 'route-start-icon',
            html: '<i class="fas fa-user-circle fa-lg" style="color:blue;"></i>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          popupContent = 'Vị trí của bạn';
        } else if (i === n - 1) {
          markerIcon = L.divIcon({
            className: 'route-end-icon',
            html: '<i class="fas fa-university fa-lg" style="color:darkred;"></i>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          popupContent = bankName;
        }
        if (markerIcon) {
          return L.marker(wp.latLng, { icon: markerIcon, draggable: false }).bindPopup(popupContent);
        }
        return undefined;
      },
    }).addTo(map);

    const routeContainer = currentRouteControl.getContainer();
    const closeButton = L.DomUtil.create(
      'button',
      'close-route-button',
      routeContainer
    );
    closeButton.innerHTML = 'Đóng Chỉ Đường';
    closeButton.addEventListener('click', () => {
      map.removeControl(currentRouteControl);
      currentRouteControl = null;
    });

    currentRouteControl.on('routingerror', function (error) {
      console.error('Lỗi tìm đường LRM:', error.error);
      alert(
        `Không tìm được đường đi. Lỗi: ${error.error ? error.error.message : 'Lỗi không xác định'
        }`
      );
      if (currentRouteControl) {
        map.removeControl(currentRouteControl);
        currentRouteControl = null;
      }
    });
  }

  // === XỬ LÝ LAYER NGÂN HÀNG ===
  async function fetchData(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Lỗi HTTP ${response.status} khi tải ${url}`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Lỗi khi fetch data:', err);
      alert(`Không thể tải dữ liệu từ ${url}. Lỗi: ${err.message}`);
      return null;
    }
  }

  let geojsonOpts = {
    pointToLayer: function (feature, latlng) {
      const props = feature.properties || {};
      const name = props.name || props.amenity || 'Địa điểm';
      // Đổi tên biến để khớp với tên trong view
      const openingTime = props.opening_time || 'Chưa cập nhật';
      const closingTime = props.closing_time || 'Chưa cập nhật';
      const address = props.address || '';

      const marker = L.marker(latlng, {
        icon: L.icon({
          iconUrl:
            'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl:
            'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        }),
        bankInfo: { // Đổi tên thành bankInfo để rõ ràng hơn
          name: name,
          openingTime: openingTime, // Đổi tên biến
          closingTime: closingTime, // Đổi tên biến
        }
      });

      marker.on('click', function () {
        if (isSidebarOpen && currentMarker === marker) {
          hideSidebar();
          isSidebarOpen = false;
          currentMarker = null;
        } else {
          showSidebar(feature.properties, latlng, marker.options.bankInfo);
          isSidebarOpen = true;
          currentMarker = marker;
        }
      });

      return marker;
    },
  };

  const layersContainer = document.querySelector('.layers');
  if (!layersContainer) console.error("Không tìm thấy phần tử '.layers' trong HTML.");

  const layersButton = 'all layers';

  function generateButton(name) {
    if (!layersContainer) return;
    const id = name === layersButton ? 'all-layers' : name;
    const displayName =
      name === layersButton ? 'Tất cả' : name.charAt(0).toUpperCase() + name.slice(1);
    const templateLayer = `
            <li class="layer-element"> <label for="${id}">
                <input type="checkbox" id="${id}" name="item" class="item" value="${name}" checked>
                <span>${displayName}</span> </label> </li>`;
    layersContainer.insertAdjacentHTML('beforeend', templateLayer);
  }

  generateButton(layersButton);
  const arrayLayers = ['branch'];

  arrayLayers.forEach((branch) => {
    generateButton(branch);
    const dataUrl = `/maps/api/geojson/${branch}/`;
    console.log('Calling URL:', dataUrl);
    fetchData(dataUrl).then((data) => {
      if (data) {
        const layerKey = 'layer_' + branch;
        activeLayers[layerKey] = L.geoJSON(data, geojsonOpts);
        map.addLayer(activeLayers[layerKey]);
        console.log(`Layer '${branch}' đã được thêm.`);
      } else {
        console.warn(`Không thể tạo layer '${branch}'.`);
        const checkbox = document.querySelector(`#${branch}`);
        if (checkbox) checkbox.disabled = true;
      }
    });
  });

  if (layersContainer) {
    layersContainer.addEventListener('click', (e) => {
      if (e.target.matches('input.item[type="checkbox"]')) {
        showHideLayer(e.target);
      }
    });
  }

  function showHideLayer(targetCheckbox) {
    const layerId = targetCheckbox.value;
    const isChecked = targetCheckbox.checked;
    console.log(`Checkbox: ${layerId}, Checked: ${isChecked}`);
    if (layerId === layersButton) {
      arrayLayers.forEach((json) => {
        const layerKey = 'layer_' + json;
        const specificCheckbox = document.querySelector(`#${json}`);
        if (activeLayers[layerKey]) {
          map[isChecked ? 'addLayer' : 'removeLayer'](activeLayers[layerKey]);
          if (specificCheckbox) specificCheckbox.checked = isChecked;
        }
      });
    } else {
      const layerKey = 'layer_' + layerId;
      if (activeLayers[layerKey]) {
        map[isChecked ? 'addLayer' : 'removeLayer'](activeLayers[layerKey]);
        updateAllLayersCheckbox();
        if (isChecked) {
          try {
            const bounds = activeLayers[layerKey].getBounds();
            map.fitBounds(bounds);
          } catch (error) {
            console.error('Error fitting bounds:', error);
          }
        }
      }
    }
  }

  function updateAllLayersCheckbox() {
    const allLayersCheckbox = document.querySelector('#all-layers');
    if (!allLayersCheckbox) return;
    let allChecked = true;
    arrayLayers.forEach((json) => {
      const specificCheckbox = document.querySelector(`#${json}`);
      if (activeLayers['layer_' + json] && specificCheckbox && !specificCheckbox.checked) {
        allChecked = false;
      }
    });
    allLayersCheckbox.checked = allChecked;
  }

  //===SIDEBAR===
  function showSidebar(properties, latlng, bankInfo) {
    const sidebar = document.getElementById('sidebar');
    const sidebarContent = document.getElementById('sidebar-content');
    if (!sidebar || !sidebarContent) {
      console.error('Không tìm thấy sidebar hoặc sidebar-content.');
      return;
    }

    let content = `
            <strong style="font-size: 1.2em;">${bankInfo.name || 'Địa điểm'}</strong><br>
        `;

    if (properties.address) {
      content += `<p>Địa chỉ: ${properties.address}</p>`;
    }
    // Sử dụng tên biến phù hợp với view
    content += `<p>Giờ mở cửa: ${bankInfo.openingTime || 'Chưa cập nhật'}</p>`;
    content += `<p>Giờ đóng cửa: ${bankInfo.closingTime || 'Chưa cập nhật'}</p>`;
    content += `<p>Lãi suất: ${properties.interest_rate || 'Chưa cập nhật'}</p>`;
    content += `
            <div style="text-align: center; margin-top: 8px;">
                <button class="leaflet-popup-button route-button">
                    <i class="fas fa-directions"></i> Chỉ đường
                </button>
            </div>
        `;

    sidebarContent.innerHTML = content;
    sidebar.classList.remove('closed');
    sidebar.style.display = 'block';
    sidebar.classList.add('open');

    const routeBtn = sidebarContent.querySelector('.route-button');
    if (routeBtn) {
      L.DomEvent.off(routeBtn, 'click');
      L.DomEvent.on(routeBtn, 'click', () => {
        console.log(`Nút 'Chỉ đường' cho ${properties.name} được nhấn.`);
        findRouteToBank(latlng, properties.name);
        hideSidebar();
      });
    }
  }

  function hideSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.remove('open');
      sidebar.classList.add('closed');
      setTimeout(() => {
        sidebar.style.display = 'none';
      }, 300);
    }
  }

  const closeSidebarButton = document.getElementById('close-sidebar');
  if (closeSidebarButton) {
    closeSidebarButton.addEventListener('click', hideSidebar);
  }

  console.log('Khởi tạo bản đồ và các chức năng cơ bản hoàn tất.');
});