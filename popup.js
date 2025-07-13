let cities = [];
let selectedCity = null;

// 规范化时区字符串为 UTC±HH:MM 格式
function normalizeUtcString(utcStr) {
  const match = utcStr.match(/^UTC([+-]?)(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) return utcStr;
  let [, sign, hour, minute] = match;
  hour = hour.padStart(2, '0');
  minute = minute ? minute.padStart(2, '0') : '00';
  return `UTC${sign}${hour}:${minute}`;
}

const utcToIanaMap = {
  'UTC-12:00': 'Etc/GMT+12',
  'UTC-11:00': 'Pacific/Pago_Pago',
  'UTC-10:00': 'Pacific/Honolulu',
  'UTC-09:00': 'America/Anchorage',
  'UTC-08:00': 'America/Los_Angeles',
  'UTC-07:00': 'America/Denver',
  'UTC-06:00': 'America/Chicago',
  'UTC-05:00': 'America/New_York',
  'UTC-04:00': 'America/Halifax',
  'UTC-03:00': 'America/Argentina/Buenos_Aires',
  'UTC-02:00': 'America/Noronha',
  'UTC-01:00': 'Atlantic/Azores',
  'UTC+00:00': 'UTC',
  'UTC+01:00': 'Europe/Paris',
  'UTC+02:00': 'Europe/Athens',
  'UTC+03:00': 'Europe/Moscow',
  'UTC+04:00': 'Asia/Dubai',
  'UTC+05:00': 'Asia/Karachi',
  'UTC+06:00': 'Asia/Dhaka',
  'UTC+07:00': 'Asia/Bangkok',
  'UTC+08:00': 'Asia/Shanghai',
  'UTC+09:00': 'Asia/Tokyo',
  'UTC+10:00': 'Australia/Sydney',
  'UTC+11:00': 'Pacific/Noumea',
  'UTC+12:00': 'Pacific/Auckland',
  'UTC+13:00': 'Pacific/Apia',
  'UTC+14:00': 'Pacific/Kiritimati'
};

function toIanaTimezone(tz) {
  const norm = normalizeUtcString(tz);
  console.log('toIanaTimezone input:', tz, 'normalized:', norm);
  let iana = utcToIanaMap[norm];
  console.log('Map lookup result:', iana);
  if (!iana) {
    // Fallback to common timezones if not in map
    if (norm === 'UTC+08:00') iana = 'Asia/Shanghai';
    else if (norm === 'UTC+09:00') iana = 'Asia/Tokyo';
    else if (norm === 'UTC+01:00') iana = 'Europe/Paris';
    else if (norm === 'UTC+10:00') iana = 'Australia/Sydney';
    else if (norm === 'UTC+00:00') iana = 'UTC';
    // --- Change: Fallback to normalized UTC string instead of just 'UTC' ---
    else iana = norm; // Use normalized UTC string as fallback
    console.log('Fallback applied, result:', iana);
  }
  console.log('Final timezone returned:', iana);
  return iana;
}

function updateClock() {
  // 获取当前激活城市
  const activeCity = cities.find(city => city.active);
  let showTime = '';
  let now = new Date();
  if (cities.length === 0) {
    // 没有任何城市，显示本地时间
    showTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } else if (activeCity) {
    try {
      // 使用 Intl.DateTimeFormat 以指定时区显示时间
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: activeCity.timezone
      });
      showTime = formatter.format(now);
    } catch (e) {
      // fallback to local time
      showTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
  } else {
    // 有城市但无激活，显示本地时间
    showTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const clockElem = document.getElementById('clock');
  if (clockElem) {
    clockElem.textContent = showTime;
  }
}

// 动态从 timezone.csv 读取城市和时区

// --- 新增：从 city.csv 动态加载城市和UTC ---
let ALL_CITIES = [];

async function loadCityListFromCSV() {
  const response = await fetch('city.csv');
  const text = await response.text();
  const lines = text.split(/\r?\n/).filter(line => line && !line.startsWith('UTC,City'));
  const cityList = [];
  for (const line of lines) {
    const [utc, city] = line.split(',');
    if (utc && city) {
      cityList.push({ name: city.trim(), utc: utc.trim() });
    }
  }
  return cityList;
}

document.addEventListener('DOMContentLoaded', () => {
  window.addCityBtn = document.getElementById('addCity');
  window.addCityModal = document.getElementById('addCityModal');
  window.citySearch = document.getElementById('citySearch');
  window.citySuggestions = document.getElementById('citySuggestions');
  const closeModal = document.getElementById('closeModal');
  const cancelAdd = document.getElementById('cancelAdd');
  const confirmAdd = document.getElementById('confirmAdd');

  // --- 修改添加城市按钮逻辑 ---
  addCityBtn.onclick = async function() {
    if (cities.length >= 5) {
      showToast('Maximum 5 city limited');
      return;
    }
    if (ALL_CITIES.length === 0) {
      ALL_CITIES = await loadCityListFromCSV();
    }
    citySearch.value = '';
    citySuggestions.innerHTML = '';
    addCityModal.style.display = 'block';
  };

  // --- 联想搜索 ---
  function searchCitiesCSV(query) {
    if (!query) return ALL_CITIES;
    query = query.toLowerCase();
    return ALL_CITIES.filter(city =>
      city.name.toLowerCase().includes(query) ||
      city.utc.toLowerCase().includes(query)
    );
  }

  function showCitySuggestionsCSV(suggestions) {
    citySuggestions.innerHTML = '';
    suggestions.forEach(city => {
      const div = document.createElement('div');
      div.className = 'city-suggestion';
      div.textContent = `${city.name} (${city.utc})`;
      div.addEventListener('click', () => {
        selectedCity = city;
        citySearch.value = city.name;
      });
      citySuggestions.appendChild(div);
    });
  }

  citySearch.oninput = function(e) {
    const suggestions = searchCitiesCSV(e.target.value);
    showCitySuggestionsCSV(suggestions);
  };

  // 关闭弹窗按钮
  closeModal.onclick = function() {
    addCityModal.style.display = 'none';
    citySearch.value = '';
    citySuggestions.innerHTML = '';
    selectedCity = null;
  };
  // 取消按钮
  cancelAdd.onclick = function() {
    addCityModal.style.display = 'none';
    citySearch.value = '';
    citySuggestions.innerHTML = '';
    selectedCity = null;
  };
  // 确定按钮
  confirmAdd.onclick = async function() {
    if (selectedCity) {
      const isFirst = cities.length === 0;
      // --- 统一使用 toIanaTimezone 进行转换 ---
      const ianaTimezone = toIanaTimezone(selectedCity.utc);

      // 检查是否已存在该城市，避免重复添加 (使用转换后的时区进行检查)
      if (!cities.some(c => c.name === selectedCity.name && c.timezone === ianaTimezone)) {
        // 关闭所有城市激活状态
        cities.forEach(c => c.active = false);
        // 新增城市设为激活 (使用转换后的时区)
        cities.push({
          name: selectedCity.name,
          timezone: ianaTimezone, // Store IANA timezone
          active: true,
          utc: selectedCity.utc // Store original UTC offset
        });
        await chrome.storage.sync.set({ cities, activeTimezone: ianaTimezone });
        chrome.runtime.sendMessage({ type: 'ping' });
        renderCityList(); // 立即刷新列表
      } else {
        // 如果已存在，直接激活该城市 (更新存储的时区)
        cities.forEach(c => c.active = (c.name === selectedCity.name && c.timezone === ianaTimezone));
        await chrome.storage.sync.set({ cities, activeTimezone: ianaTimezone });
        chrome.runtime.sendMessage({ type: 'ping' });
        renderCityList();
      }
    }
    addCityModal.style.display = 'none';
    citySearch.value = '';
    selectedCity = null;
  };

  // 加载保存的城市列表
  async function loadCities() {
    const result = await chrome.storage.sync.get('cities');
    cities = result.cities || [];
    renderCityList();
  }

  // 保存城市列表
  async function saveCities() {
    await chrome.storage.sync.set({ cities });
    renderCityList();
  }

  // 渲染城市列表
  function renderCityList() {
    const cityListElem = document.getElementById('cityList');
    cityListElem.innerHTML = '';
    cities.forEach((city, index) => {
      const li = document.createElement('li');
      li.className = 'city-item';
      // Ensure getTimeAndIcon is called to get initial time and icon
      const { timeString, iconSrc: timeIconSrc } = getTimeAndIcon(city.timezone);

      // Determine switch icon based on active status
      const switchIconFileName = city.active ? 'button/on.png' : 'button/off.png';
      const switchIconSrc = chrome.runtime.getURL(switchIconFileName);

      li.innerHTML = `
        <img class="switch-icon" id="switch-icon-${index}" src="${switchIconSrc}" alt="${city.active ? 'On' : 'Off'}" data-index="${index}">
        <div class="city-info">
          <div class="city-name">${city.name}</div>
          <div class="city-timezone">${city.utc || city.timezone}</div>
        </div>
        <div class="city-time-info">
          <img class="time-icon" id="icon-${index}" src="${timeIconSrc}" alt="Time icon">
          <div class="city-current-time" id="time-${index}">${timeString}</div>
        </div>
        <div class="city-actions">
          <img class="btn-delete-icon" data-index="${index}" src="${chrome.runtime.getURL('button/del.png')}" alt="Delete">
        </div>
      `;
      // 切换激活城市 (改为点击开关图标)
      const switchIcon = li.querySelector('.switch-icon');
      switchIcon.addEventListener('click', async (e) => {
        try {
          const clickedIndex = parseInt(e.target.dataset.index, 10);
          console.log('开始切换城市:', cities[clickedIndex].name);

          // Toggle active status for the clicked city, deactivate others
          cities.forEach((c, i) => {
            if (i === clickedIndex) {
              c.active = !c.active; // Toggle active state
            } else {
              c.active = false; // Deactivate others
            }
          });

          await saveCities(); // Save updated cities array

          // 更新存储的活动时区，如果某个城市被激活
          const currentlyActiveCity = cities.find(c => c.active);
          const activeTimezoneToSave = currentlyActiveCity ? toIanaTimezone(currentlyActiveCity.timezone || currentlyActiveCity.utc) : Intl.DateTimeFormat().resolvedOptions().timeZone;

          await chrome.storage.sync.set({ activeTimezone: activeTimezoneToSave });
          console.log('活动时区已保存到storage:', activeTimezoneToSave);

          // 发送更新消息到background
          chrome.runtime.sendMessage({ 
            type: 'updateBadgeByIANA',
            timezone: activeTimezoneToSave
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('发送消息错误:', chrome.runtime.lastError);
            } else {
              console.log('消息发送成功，响应:', response);
            }
          });

          // 重新渲染列表以更新UI
          renderCityList();
          console.log('列表已重新渲染');

        } catch (error) {
          console.error('切换城市时发生错误:', error);
        }
      });
      // 删除城市
      const deleteBtn = li.querySelector('.btn-delete-icon');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(e.target.dataset.index, 10);
        console.log('Deleting city at index:', idx);
        const deletedCity = cities[idx];
        cities.splice(idx, 1);
        saveCities();
        // 如果删除的是当前激活城市，且没有其他激活，重置为本地时区
        const hasActive = cities.some(city => city.active);
        if (!hasActive && deletedCity.active) {
          chrome.runtime.sendMessage({
            type: 'updateBadgeByIANA',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          });
        }
      });
      cityListElem.appendChild(li);
    });

    // Update times every second
    // Clear previous intervals to prevent multiple intervals running
    if (window.timeUpdateInterval) {
      clearInterval(window.timeUpdateInterval);
    }
    window.timeUpdateInterval = setInterval(updateCityTimes, 1000);
  }

  // Function to get time string and sun/moon icon based on timezone
  function getTimeAndIcon(timezone) {
    console.log('getTimeAndIcon called for timezone:', timezone);
    try {
      const now = new Date();
      // Add second to options for parsing hour reliably
      const options = { hour: '2-digit', minute: '2-digit', hour12: false, second: '2-digit', timeZone: timezone };
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const timeStringWithSeconds = formatter.format(now);
      console.log('Formatted time with seconds:', timeStringWithSeconds);

      // Extract hour from the formatted time string
      const parts = timeStringWithSeconds.match(/^(\d{2}):(\d{2}):(\d{2})$/);
      let hour = -1; // Default to an invalid hour
      if (parts && parts[1]) {
        hour = parseInt(parts[1], 10);
      }
      console.log('Parsed hour:', hour);

      // Determine icon based on hour
      const iconFileName = (hour >= 6 && hour < 19) ? 'button/sun.png' : 'button/moon.png';
      const iconSrc = chrome.runtime.getURL(iconFileName);
      console.log('Icon source:', iconSrc);

      // Return time string without seconds for display
      const timeString = timeStringWithSeconds.substring(0, 5);

      return { timeString, iconSrc };
    } catch (e) {
      console.error(`Error getting time for timezone ${timezone}:`, e);
      return { timeString: '--:--', iconSrc: '' }; // Return placeholder on error
    }
  }

  // Function to update times for all displayed cities
  function updateCityTimes() {
    console.log('Updating city times...');
    cities.forEach((city, index) => {
      const timeElement = document.getElementById(`time-${index}`);
      const iconElement = document.getElementById(`icon-${index}`);
      console.log(`Checking elements for index ${index}: timeElement =`, timeElement, ', iconElement =', iconElement);
      if (timeElement && iconElement) {
        const { timeString, iconSrc } = getTimeAndIcon(city.timezone);
        console.log(`Updating index ${index}: time = ${timeString}, icon = ${iconSrc}`);
        timeElement.textContent = timeString;
        iconElement.src = iconSrc;
      }
    });
    updateLocalTimeBox(); // Also update the local time display
  }

  // 新增：顶部本地时间显示
  function updateLocalTimeBox() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localTime = document.getElementById('localTime');
    const localTz = document.getElementById('localTz');
    if (localTime && localTz) {
      localTime.textContent = timeStr;
      localTz.textContent = tz;
    }
  }
  setInterval(updateLocalTimeBox, 1000);
  updateLocalTimeBox();

  // 新增：toast 显示逻辑
  function showToast(msg) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    toast.classList.remove('hide');
    setTimeout(function() {
      toast.classList.remove('show');
      toast.classList.add('hide');
    }, 2000);
  }
  // 默认隐藏toast
  window.addEventListener('DOMContentLoaded', function() {
    var toast = document.getElementById('toast');
    if (toast) toast.classList.add('hide');
  });

  // 补充：页面加载时自动渲染城市列表
  loadCities();

  // Update local time initially and every second
  updateLocalTimeBox();
  setInterval(updateLocalTimeBox, 1000);

  // --- Donate Section Logic ---
  const donateBIcon = document.getElementById('donate-b-icon');
  const donateWIcon = document.getElementById('donate-w-icon');
  const donateZIcon = document.getElementById('donate-z-icon');
  const qrCodeDisplay = document.getElementById('qr-code-display');
  const qrCodeImg = document.getElementById('qr-code-img');
  // Get the new 'p' icon element
  const donatePIcon = document.getElementById('donate-p-icon');

  // Set initial source for donate icons
  if (donateBIcon) donateBIcon.src = chrome.runtime.getURL('donate/b.png');
  if (donateWIcon) donateWIcon.src = chrome.runtime.getURL('donate/w.png');
  if (donateZIcon) donateZIcon.src = chrome.runtime.getURL('donate/z.png');
  // Set initial source for the new 'p' icon
  if (donatePIcon) donatePIcon.src = chrome.runtime.getURL('donate/p.png');

  // Add click listeners to donate icons
  if (donateBIcon) {
    donateBIcon.addEventListener('click', () => {
      qrCodeImg.src = chrome.runtime.getURL('donate/b.png');
      qrCodeDisplay.style.display = 'flex'; // Show modal
    });
  }

  if (donateWIcon) {
    donateWIcon.addEventListener('click', () => {
      qrCodeImg.src = chrome.runtime.getURL('donate/w.png');
      qrCodeDisplay.style.display = 'flex'; // Show modal
    });
  }

  if (donateZIcon) {
    donateZIcon.addEventListener('click', () => {
      qrCodeImg.src = chrome.runtime.getURL('donate/z.png');
      qrCodeDisplay.style.display = 'flex'; // Show modal
    });
  }

  // Add click listener for the new 'p' icon
  if (donatePIcon) {
    donatePIcon.addEventListener('click', () => {
      qrCodeImg.src = chrome.runtime.getURL('donate/p.png');
      qrCodeDisplay.style.display = 'flex'; // Show modal
    });
  }

  // Add click listener to QR code display to hide it
  if (qrCodeDisplay) {
    qrCodeDisplay.addEventListener('click', () => {
      qrCodeDisplay.style.display = 'none'; // Hide modal
      qrCodeImg.src = ''; // Clear image source
    });
  }

});

// UTC偏移到IANA时区映射（常用城市，可自行扩展）
const UTC_TO_IANA = {
  'UTC-12:00': 'Etc/GMT+12',
  'UTC-11:00': 'Pacific/Pago_Pago',
  'UTC-10:00': 'Pacific/Honolulu',
  'UTC-09:00': 'America/Anchorage',
  'UTC-08:00': 'America/Los_Angeles',
  'UTC-07:00': 'America/Denver',
  'UTC-06:00': 'America/Chicago',
  'UTC-05:00': 'America/New_York',
  'UTC-04:00': 'America/Halifax',
  'UTC-03:00': 'America/Argentina/Buenos_Aires',
  'UTC-02:00': 'Etc/GMT+2',
  'UTC-01:00': 'Etc/GMT+1',
  'UTC+00:00': 'Etc/GMT',
  'UTC+01:00': 'Europe/Berlin',
  'UTC+02:00': 'Europe/Athens',
  'UTC+03:00': 'Europe/Moscow',
  'UTC+03:30': 'Asia/Tehran',
  'UTC+04:00': 'Asia/Dubai',
  'UTC+04:30': 'Asia/Kabul',
  'UTC+05:00': 'Asia/Karachi',
  'UTC+05:30': 'Asia/Kolkata',
  'UTC+05:45': 'Asia/Kathmandu',
  'UTC+06:00': 'Asia/Dhaka',
  'UTC+06:30': 'Asia/Yangon',
  'UTC+07:00': 'Asia/Bangkok',
  'UTC+08:00': 'Asia/Shanghai',
  'UTC+09:00': 'Asia/Tokyo',
  'UTC+09:30': 'Australia/Darwin',
  'UTC+10:00': 'Australia/Sydney',
  'UTC+11:00': 'Pacific/Noumea',
  'UTC+12:00': 'Pacific/Auckland',
  'UTC+13:00': 'Pacific/Tongatapu',
  'UTC+14:00': 'Pacific/Kiritimati'
};