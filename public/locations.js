(() => {
  const utils = window.LocationUtils;
  if (!utils) return;

  const formatDistance = (km) => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  const currentUrlLocation = new URLSearchParams(window.location.search).get('location');

  async function fetchLocations() {
    const response = await fetch('/api/locations', { credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Không tải được danh sách cơ sở.');
    return Array.isArray(data.locations) ? data.locations : [];
  }

  function buildNearestMessage(target, sourceLabel) {
    const message = document.createElement('div');
    message.className = 'location-suggestion-copy';
    const label = document.createElement('span');
    label.className = 'location-suggestion-label';
    label.textContent = sourceLabel;
    const title = document.createElement('strong');
    title.textContent = target.name;
    const details = document.createElement('small');
    details.textContent = `${target.city} · cách khoảng ${formatDistance(target.distanceKm)} · vị trí mẫu`;
    message.append(label, title, details);
    const button = document.createElement('button');
    button.className = 'location-select-nearest';
    button.type = 'button';
    button.textContent = 'Chọn cơ sở này';
    button.addEventListener('click', () => {
      const select = message.closest('[data-location-picker]')?.querySelector('[data-location-select]');
      if (!select) return;
      select.value = target.id;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    message.appendChild(button);
    return message;
  }

  function initPicker(root, locations) {
    const citySelect = root.querySelector('[data-location-city]');
    const branchSelect = root.querySelector('[data-location-select]');
    const gpsButton = root.querySelector('[data-location-gps]');
    const recommendation = root.querySelector('[data-location-recommendation]');
    if (!citySelect || !branchSelect || !recommendation) return;

    const cityLocations = new Map();
    locations.forEach((location) => {
      if (!cityLocations.has(location.city)) cityLocations.set(location.city, location);
    });
    citySelect.replaceChildren(new Option('Chọn tỉnh/thành gần bạn', ''));
    [...cityLocations.keys()].sort((a, b) => a.localeCompare(b, 'vi')).forEach((city) => {
      citySelect.add(new Option(city, city));
    });
    branchSelect.replaceChildren(new Option('Chọn cơ sở khám', ''));
    locations.forEach((location) => {
      branchSelect.add(new Option(`${location.name} · ${location.city} (mẫu)`, location.id));
    });
    branchSelect.disabled = false;

    const showNearest = (point, sourceLabel) => {
      const nearest = utils.nearestLocation(locations, point);
      recommendation.replaceChildren();
      if (!nearest) {
        recommendation.textContent = 'Chưa xác định được cơ sở gần nhất. Bạn vẫn có thể tự chọn một cơ sở trong danh sách.';
        return;
      }
      recommendation.appendChild(buildNearestMessage(nearest, sourceLabel));
    };

    citySelect.addEventListener('change', () => {
      branchSelect.value = '';
      const location = cityLocations.get(citySelect.value);
      if (location) showNearest({ lat: location.cityLat ?? location.lat, lng: location.cityLng ?? location.lng }, `Gợi ý theo tỉnh/thành ${location.city}`);
      else recommendation.textContent = 'Chọn tỉnh/thành để xem cơ sở mẫu gần nhất. Bạn cũng có thể tự chọn cơ sở trong danh sách.';
    });

    branchSelect.addEventListener('change', () => {
      const location = locations.find((item) => item.id === branchSelect.value);
      if (!location) return;
      if (citySelect.value !== location.city) citySelect.value = location.city;
      recommendation.replaceChildren();
      const selected = document.createElement('div');
      selected.className = 'location-selected-note';
      selected.textContent = `Đã chọn ${location.name} tại ${location.city}. Đây là địa chỉ minh họa, chưa xác nhận.`;
      recommendation.appendChild(selected);
    });

    gpsButton?.addEventListener('click', () => {
      if (!navigator.geolocation) {
        recommendation.textContent = 'Trình duyệt này không hỗ trợ định vị. Hãy chọn tỉnh/thành hoặc cơ sở thủ công.';
        return;
      }
      gpsButton.disabled = true;
      gpsButton.textContent = 'Đang xác định vị trí…';
      recommendation.textContent = 'Trình duyệt sẽ hỏi quyền truy cập vị trí. Tọa độ chỉ dùng trong trình duyệt để tính khoảng cách và không được gửi lên máy chủ.';
      navigator.geolocation.getCurrentPosition((position) => {
        gpsButton.disabled = false;
        gpsButton.textContent = '◎ Dùng vị trí hiện tại';
        showNearest({ lat: position.coords.latitude, lng: position.coords.longitude }, 'Cơ sở mẫu gần vị trí của bạn');
      }, (error) => {
        gpsButton.disabled = false;
        gpsButton.textContent = '◎ Dùng vị trí hiện tại';
        const message = error.code === error.PERMISSION_DENIED
          ? 'Bạn chưa cấp quyền vị trí. Hãy chọn tỉnh/thành hoặc cơ sở thủ công.'
          : 'Không lấy được vị trí hiện tại. Hãy chọn tỉnh/thành hoặc cơ sở thủ công.';
        recommendation.textContent = message;
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    });

    if (currentUrlLocation && locations.some((location) => location.id === currentUrlLocation)) {
      branchSelect.value = currentUrlLocation;
      branchSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function renderLocations(locations) {
    const list = document.querySelector('[data-location-list]');
    const map = document.querySelector('[data-vietnam-map]');
    if (!list || !map) return;
    list.replaceChildren();
    map.querySelectorAll('.location-map-marker').forEach((marker) => marker.remove());

    locations.forEach((location, index) => {
      const card = document.createElement('article');
      card.className = 'location-card';
      card.id = `location-${location.id}`;
      card.dataset.locationId = location.id;
      const number = document.createElement('span');
      number.className = 'location-card-number';
      number.textContent = String(index + 1).padStart(2, '0');
      const title = document.createElement('h3');
      title.textContent = location.name;
      const city = document.createElement('p');
      city.className = 'location-card-city';
      city.textContent = location.city;
      const address = document.createElement('p');
      address.className = 'location-card-address';
      address.textContent = location.address;
      const disclaimer = document.createElement('span');
      disclaimer.className = 'location-sample-tag';
      disclaimer.textContent = 'Mẫu · chưa xác nhận';
      const actions = document.createElement('div');
      actions.className = 'location-card-actions';
      const book = document.createElement('a');
      book.href = `/booking?location=${encodeURIComponent(location.id)}`;
      book.className = 'button button-primary';
      book.textContent = 'Đặt lịch tại đây →';
      const markerLink = document.createElement('button');
      markerLink.type = 'button';
      markerLink.className = 'location-map-link';
      markerLink.textContent = 'Xem trên bản đồ';
      markerLink.addEventListener('click', () => focusLocation(location.id));
      actions.append(book, markerLink);
      card.append(number, title, city, address, disclaimer, actions);
      list.appendChild(card);

      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'location-map-marker';
      marker.style.left = `${location.mapX}%`;
      marker.style.top = `${location.mapY}%`;
      marker.title = `${location.name} — địa điểm mẫu`;
      marker.setAttribute('aria-label', `Xem ${location.name}, địa điểm mẫu`);
      marker.textContent = String(index + 1);
      marker.addEventListener('click', () => focusLocation(location.id));
      map.appendChild(marker);
    });
  }

  function focusLocation(id) {
    const card = document.querySelector(`[data-location-id="${CSS.escape(id)}"]`);
    if (!card) return;
    document.querySelectorAll('.location-card.is-active').forEach((item) => item.classList.remove('is-active'));
    card.classList.add('is-active');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  fetchLocations().then((locations) => {
    document.querySelectorAll('[data-location-picker]').forEach((root) => initPicker(root, locations));
    renderLocations(locations);
  }).catch((error) => {
    document.querySelectorAll('[data-location-recommendation]').forEach((node) => {
      node.textContent = `${error.message} Vui lòng thử tải lại trang.`;
    });
    const list = document.querySelector('[data-location-list]');
    if (list) list.textContent = error.message;
  });
})();
