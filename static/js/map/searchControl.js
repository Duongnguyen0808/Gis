import { allBankData } from './geojsonLayer.js';

export function setupSearchControl(map) {
    const searchInput = document.getElementById('searchInput');
    const searchResultsList = document.getElementById('searchResults');

    if (!searchInput || !searchResultsList) return;

    searchInput.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase().trim();
        searchResultsList.innerHTML = ''; // Xóa kết quả cũ

        if (searchTerm.length < 2) {
            return;
        }

        if (!window.currentUserLocation) {
            alert('Vui lòng bật định vị để xem khoảng cách.');
            return;
        }

        const filteredBanks = allBankData.filter(bank =>
            bank.properties.name.toLowerCase().includes(searchTerm)
        );

        if (filteredBanks.length > 0) {
            const banksWithDistance = filteredBanks.map(bank => {
                const bankLatLng = L.latLng(bank.geometry.coordinates[1], bank.geometry.coordinates[0]);
                const distance = window.currentUserLocation.distanceTo(bankLatLng);
                return { ...bank, distance };
            });

            banksWithDistance.sort((a, b) => a.distance - b.distance);

            banksWithDistance.forEach(bank => {
                const listItem = document.createElement('li');
                const distanceKm = (bank.distance / 1000).toFixed(2);
                listItem.textContent = `${bank.properties.name} (${distanceKm} km)`;
                listItem.addEventListener('click', () => {
                    map.setView([bank.geometry.coordinates[1], bank.geometry.coordinates[0]], 16);

                    // Tìm và kích hoạt marker đỏ ban đầu
                    Object.values(map._layers).forEach(layer => {
                        if (layer instanceof L.Marker) {
                            if (layer.feature && layer.feature.properties.name === bank.properties.name) {
                                layer.fire('click'); // Kích hoạt sự kiện click của marker
                            }
                        }
                    });

                    searchResultsList.innerHTML = '';
                    searchInput.value = '';
                });
                searchResultsList.appendChild(listItem);
            });
        } else {
            const listItem = document.createElement('li');
            listItem.textContent = 'Không tìm thấy ngân hàng nào.';
            searchResultsList.appendChild(listItem);
        }
    });
}