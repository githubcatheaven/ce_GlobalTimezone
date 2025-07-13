// background.js

let currentTimezone = 'GMT+00:00'; // 默认时区
let currentIanaTimezone = null; // 新增：记录当前 IANA 时区

function parseGMT(gmtString) {
  const match = gmtString.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const [_, sign, hours, minutes] = match;
  return (sign === '+' ? 1 : -1) * (parseInt(hours) * 60 + parseInt(minutes));
}

function updateBadge() {
  try {
    console.log('开始更新Badge，当前时区:', currentIanaTimezone);
    const now = new Date();
    
    // 防御：如果不是 IANA 标准时区，fallback 到本地时区
    if (!currentIanaTimezone || !/^([A-Za-z_]+\/[A-Za-z_]+|UTC)$/.test(currentIanaTimezone)) {
      console.warn('收到非IANA标准时区，使用本地时间:', currentIanaTimezone);
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;
      chrome.action.setBadgeText({ text: timeStr });
      return;
    }
    
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: currentIanaTimezone
      });
      const timeStr = formatter.format(now);
      console.log('格式化后的时间:', timeStr, '时区:', currentIanaTimezone);
      const [hours, minutes] = timeStr.split(':');
      const formattedTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
      chrome.action.setBadgeText({ text: formattedTime });
      chrome.action.setBadgeBackgroundColor({ color: '#02A7F0' });
      if (chrome.action.setBadgeTextColor) {
        chrome.action.setBadgeTextColor({ color: '#ffffff' });
      }
      console.log('Badge更新完成，显示时间:', formattedTime);
    } catch (e) {
      console.error('格式化时间时发生错误:', e, '时区:', currentIanaTimezone);
      // fallback to local time
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;
      chrome.action.setBadgeText({ text: timeStr });
    }
  } catch (error) {
    console.error('更新Badge时发生错误:', error);
  }
}

// 创建定时更新闹钟
function createAlarm() {
  const now = new Date();
  const nextMinute = new Date(now);
  nextMinute.setMinutes(now.getMinutes() + 1);
  nextMinute.setSeconds(0);
  nextMinute.setMilliseconds(0);

  chrome.alarms.create('updateTime', {
    when: nextMinute.getTime(),
    periodInMinutes: 1
  });
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    console.log('Background收到消息:', message);
    
    if (message.type === 'updateBadgeByIANA') {
      console.log('更新时区为:', message.timezone);
      currentIanaTimezone = message.timezone;
      currentTimezone = null;
      
      // 立即更新badge
      updateBadge();
      console.log('Badge已更新');
      
      // 发送响应
      sendResponse({ success: true, timezone: message.timezone });
    }
  } catch (error) {
    console.error('处理消息时发生错误:', error);
    sendResponse({ success: false, error: error.message });
  }
  return true; // 保持消息通道开放
});

// 新增：支持 IANA 时区字符串的 badge 显示
function updateBadgeByIANA(timezone) {
  currentIanaTimezone = timezone;
  updateBadge();
}

// 监听闹钟事件
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateTime') {
    updateBadge();
  }
});

// 初始化：加载保存的活动城市时区
chrome.storage.sync.get(['cities', 'activeTimezone'], (result) => {
  const cities = result.cities || [];
  const activeTimezone = result.activeTimezone;
  if (activeTimezone) {
    if (/\//.test(activeTimezone)) {
      currentIanaTimezone = activeTimezone;
      currentTimezone = null;
    } else if (/^UTC([+-]?\d+)$/.test(activeTimezone)) {
      // 兼容 UTC+8 这类格式，转为 IANA
      const utcToIanaMap = {
        'UTC-12': 'Etc/GMT+12',
        'UTC-11': 'Pacific/Pago_Pago',
        'UTC-10': 'Pacific/Honolulu',
        'UTC-9': 'America/Anchorage',
        'UTC-8': 'America/Los_Angeles',
        'UTC-7': 'America/Denver',
        'UTC-6': 'America/Chicago',
        'UTC-5': 'America/New_York',
        'UTC-4': 'America/Halifax',
        'UTC-3': 'America/Argentina/Buenos_Aires',
        'UTC-2': 'Etc/GMT+2',
        'UTC-1': 'Etc/GMT+1',
        'UTC+0': 'Etc/GMT',
        'UTC+1': 'Europe/Berlin',
        'UTC+2': 'Europe/Athens',
        'UTC+3': 'Europe/Moscow',
        'UTC+4': 'Asia/Dubai',
        'UTC+5': 'Asia/Karachi',
        'UTC+6': 'Asia/Dhaka',
        'UTC+7': 'Asia/Bangkok',
        'UTC+8': 'Asia/Shanghai',
        'UTC+9': 'Asia/Tokyo',
        'UTC+10': 'Australia/Sydney',
        'UTC+11': 'Pacific/Noumea',
        'UTC+12': 'Pacific/Auckland',
        'UTC+13': 'Pacific/Enderbury',
        'UTC+14': 'Pacific/Kiritimati'
      };
      const iana = utcToIanaMap[activeTimezone] || 'Etc/GMT';
      currentIanaTimezone = iana;
      currentTimezone = null;
    } else {
      currentIanaTimezone = activeTimezone;
      currentTimezone = null;
    }
  } else {
    const activeCity = cities.find(city => city.active);
    if (activeCity) {
      if (/\//.test(activeCity.timezone)) {
        currentIanaTimezone = activeCity.timezone;
        currentTimezone = null;
      } else {
        currentTimezone = activeCity.timezone;
        currentIanaTimezone = null;
      }
    }
  }
  updateBadge();
  createAlarm();
});

// 监听 storage 变化
chrome.storage.onChanged.addListener((changes, area) => {
  console.log('Storage changed:', changes);
  if (area === 'sync' && changes.activeTimezone) {
    const tz = changes.activeTimezone.newValue;
    console.log('Active timezone changed to:', tz);
    if (tz) {
      currentIanaTimezone = tz;
      currentTimezone = null;
      updateBadge();
    }
  }
});