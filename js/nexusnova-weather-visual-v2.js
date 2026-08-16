/* NexusNova Weather Visual v2 — animated live weather for Tools and ALL APPS Weather. */
(() => {
  'use strict';
  if(window.__nxWeatherVisualV2) return;
  window.__nxWeatherVisualV2=true;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  function ensureCss(){if(document.querySelector('link[data-nx-weather-v2]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='./css/nexusnova-weather-visual-v2.css?v=20260817';l.dataset.nxWeatherV2='1';document.head.appendChild(l);}
  async function fetchJson(url, timeout = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { cache:'no-store', signal:controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  async function weatherGeocode(city) {
    const query = String(city || '').trim();
    if (!query) throw new Error('Enter a city');
    const data = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`, 9000);
    const item = data?.results?.[0];
    if (!item) throw new Error('City not found');
    return { lat:item.latitude, lon:item.longitude, label:[item.name,item.admin1,item.country].filter(Boolean).join(', ') };
  }

  function weatherPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Location unsupported'));
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat:pos.coords.latitude, lon:pos.coords.longitude, label:'Current location' }),
        reject,
        { enableHighAccuracy:false, timeout:9000, maximumAge:300000 }
      );
    });
  }

  function weatherMeta(code, isDay = 1) {
    const c = Number(code);
    if (c === 0) return { key:isDay?'clear-day':'clear-night', desc:'Clear sky', icon:isDay?'☀':'☾' };
    if (c === 1) return { key:isDay?'clear-day':'clear-night', desc:'Mainly clear', icon:isDay?'☀':'☾' };
    if (c === 2) return { key:isDay?'partly-day':'partly-night', desc:'Partly cloudy', icon:'◒' };
    if (c === 3) return { key:'cloudy', desc:'Overcast', icon:'☁' };
    if (c === 45 || c === 48) return { key:'fog', desc:'Fog', icon:'≋' };
    if (c >= 51 && c <= 57) return { key:'rain', desc:'Drizzle', icon:'⌁' };
    if (c >= 61 && c <= 67) return { key:'rain', desc:c >= 65?'Heavy rain':'Rain', icon:'⌁' };
    if (c >= 71 && c <= 77) return { key:'snow', desc:'Snow', icon:'✣' };
    if (c >= 80 && c <= 82) return { key:'rain', desc:'Rain showers', icon:'⌁' };
    if (c >= 85 && c <= 86) return { key:'snow', desc:'Snow showers', icon:'✣' };
    if (c >= 95) return { key:'storm', desc:'Thunderstorm', icon:'ϟ' };
    return { key:'cloudy', desc:'Weather', icon:'◌' };
  }

  function weatherScene() {
    return `<div class="nxwx-scene-art" aria-hidden="true">
      <div class="nxwx-stars"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="nxwx-sun"><i></i></div><div class="nxwx-moon"></div>
      <div class="nxwx-cloud nxwx-cloud-a"><i></i><b></b></div>
      <div class="nxwx-cloud nxwx-cloud-b"><i></i><b></b></div>
      <div class="nxwx-rain-lines">${Array.from({length:12},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div>
      <div class="nxwx-snow-flakes">${Array.from({length:10},(_,i)=>`<i style="--i:${i}">•</i>`).join('')}</div>
      <div class="nxwx-lightning">ϟ</div>
      <div class="nxwx-fog-lines"><i></i><i></i><i></i></div>
      <div class="nxwx-horizon"><i></i><b></b></div>
    </div>`;
  }

  function hourLabel(iso, timezone) {
    try {
      return new Date(iso).toLocaleTimeString([], { hour:'numeric', timeZone:timezone || undefined });
    } catch (_) {
      return new Date(iso).toLocaleTimeString([], { hour:'numeric' });
    }
  }

  function renderWeather(box, data, loc) {
    const current = data.current || {};
    const meta = weatherMeta(current.weather_code, current.is_day);
    const daily = data.daily || {};
    const hourly = data.hourly || {};
    const foundIndex = (hourly.time || []).findIndex(t => String(t) >= String(current.time || ''));
    const startIndex = Math.max(0, foundIndex < 0 ? 0 : foundIndex);
    const hours = (hourly.time || []).slice(startIndex, startIndex + 8).map((time, offset) => {
      const i = startIndex + offset;
      const hm = weatherMeta(hourly.weather_code?.[i], current.is_day);
      return `<div class="nxwx-hour"><small>${offset===0?'NOW':esc(hourLabel(time, data.timezone))}</small><b>${hm.icon}</b><strong>${Math.round(hourly.temperature_2m?.[i])}°</strong><span>${Math.round(hourly.precipitation_probability?.[i] || 0)}%</span></div>`;
    }).join('');

    const days = (daily.time || []).slice(0,5).map((time,i) => {
      const dm = weatherMeta(daily.weather_code?.[i], 1);
      const label = i === 0 ? 'Today' : new Date(`${time}T12:00:00`).toLocaleDateString([], { weekday:'short' });
      return `<div class="nxwx-day"><span>${esc(label)}</span><b>${dm.icon}</b><strong>${Math.round(daily.temperature_2m_max?.[i])}°</strong><em>${Math.round(daily.temperature_2m_min?.[i])}°</em><small>${Math.round(daily.precipitation_probability_max?.[i] || 0)}% rain</small></div>`;
    }).join('');

    const high = Math.round(daily.temperature_2m_max?.[0]);
    const low = Math.round(daily.temperature_2m_min?.[0]);
    const wind = Math.round(current.wind_speed_10m || 0);
    const humidity = Math.round(current.relative_humidity_2m || 0);
    const rain = Number(current.precipitation || current.rain || current.showers || 0);
    const cloud = Math.round(current.cloud_cover || 0);

    box.innerHTML = `
      <article class="nxwx-card nxwx-${meta.key}">
        <div class="nxwx-sky">
          ${weatherScene()}
          <div class="nxwx-overlay">
            <div class="nxwx-location"><i></i><span>${esc(loc.label)}</span><small>LIVE WEATHER</small></div>
            <div class="nxwx-main-copy">
              <div><strong>${Math.round(current.temperature_2m)}°</strong><span>C</span></div>
              <section><b>${esc(meta.desc)}</b><p>Feels like ${Math.round(current.apparent_temperature)}° • H ${high}° / L ${low}°</p></section>
            </div>
          </div>
        </div>
        <div class="nxwx-metrics">
          <div><span>◌</span><small>HUMIDITY</small><b>${humidity}%</b></div>
          <div><span>↝</span><small>WIND</small><b>${wind} km/h</b></div>
          <div><span>⌁</span><small>PRECIP.</small><b>${rain.toFixed(rain >= 10 ? 0 : 1)} mm</b></div>
          <div><span>☁</span><small>CLOUDS</small><b>${cloud}%</b></div>
        </div>
        <section class="nxwx-strip"><header><b>Next hours</b><span>Live forecast</span></header><div class="nxwx-hours">${hours}</div></section>
        <section class="nxwx-forecast"><header><b>5-day outlook</b><span>Local timezone</span></header><div class="nxwx-days">${days}</div></section>
      </article>`;
  }

  async function loadWeatherTarget(box, status, cityInput, mode = 'auto', storageKey = 'nx_weather_city') {
    if (!box) return;
    box.classList.add('nx-weather-premium-box');
    if (status) status.textContent = 'Connecting to live weather…';
    try {
      let loc;
      const city = String(cityInput?.value || '').trim();
      if (mode === 'city') loc = await weatherGeocode(city);
      else if (mode === 'geo') loc = await weatherPosition();
      else if (city) loc = await weatherGeocode(city);
      else {
        const saved = localStorage.getItem(storageKey);
        loc = saved ? await weatherGeocode(saved) : await weatherPosition();
      }
      if (city && mode === 'city') localStorage.setItem(storageKey, city);
      const params = new URLSearchParams({
        latitude:String(loc.lat), longitude:String(loc.lon), timezone:'auto', forecast_days:'5',
        current:'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',
        hourly:'temperature_2m,weather_code,precipitation_probability',
        daily:'temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,precipitation_probability_max'
      });
      const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, 10000);
      renderWeather(box, data, loc);
      if (status) status.textContent = `Live • updated ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
      return true;
    } catch (error) {
      console.warn('NexusNova premium weather:', error);
      if (status) status.textContent = 'Weather unavailable • enter a city or allow location permission.';
      box.innerHTML = '<div class="nxwx-error"><b>Weather connection unavailable</b><span>Check location permission or search a city, then try again.</span></div>';
      return false;
    }
  }

  async function loadPremiumWeather(mode = 'auto') {
    return loadWeatherTarget($('weatherBox'), $('weatherStatus'), $('weatherCityInput'), mode, 'nx_weather_city');
  }

  async function loadMegaWeather(mode = 'geo') {
    return loadWeatherTarget($('nxMegaWeatherOut'), $('nxMegaWeatherStatus'), $('nxMegaWeatherCity'), mode, 'nx_mega_weather_city');
  }

  function installWeather() {
    const panel = $('tool-weather');
    if (!panel) return false;
    panel.classList.add('nx-weather-premium');
    const heading = panel.querySelector('h3');
    if (heading && heading.dataset.nxWeatherPremium !== '1') {
      heading.dataset.nxWeatherPremium = '1';
      heading.innerHTML = '<span class="nx-weather-title-mark">◒</span><span><small>ATMOSPHERIC VIEW</small>Weather</span>';
    }
    // Final-user-fixes defines the previous renderer late. This is intentionally
    // reasserted here so every existing Weather button keeps the same API name.
    window.nexusLoadWeather = loadPremiumWeather;
    return true;
  }

  function installMegaWeather() {
    const tab = $('tab-mega-weather');
    const card = tab?.querySelector('.card.nxmega-hero,.card');
    let button = $('nxMegaWeatherBtn');
    const out = $('nxMegaWeatherOut');
    if (!tab || !card || !button || !out) return false;
    tab.classList.add('nx-weather-premium','nx-weather-mega-premium');
    card.classList.add('nx-weather-mega-card');
    out.classList.add('nx-weather-premium-box');

    if (card.dataset.nxMegaWeatherPremium !== '1') {
      card.dataset.nxMegaWeatherPremium = '1';
      const h2 = card.querySelector('h2');
      if (h2) h2.innerHTML = '<span class="nx-weather-title-mark">◒</span><span><small>ATMOSPHERIC VIEW</small>Live Weather</span>';

      // Replace the old event-bound button so the legacy one-line renderer cannot
      // race the premium visual report after the same tap.
      const fresh = button.cloneNode(true);
      button.replaceWith(fresh);
      button = fresh;
      button.textContent = 'REFRESH LIVE WEATHER';
      button.addEventListener('click', () => loadMegaWeather('geo'));

      const controls = document.createElement('div');
      controls.className = 'location-tools-row nxwx-mega-controls';
      controls.innerHTML = '<input id="nxMegaWeatherCity" class="tool-input" placeholder="Search city"><button id="nxMegaWeatherCityBtn" class="tool-btn primary" type="button">Search</button><button id="nxMegaWeatherGeoBtn" class="tool-btn" type="button">My Location</button>';
      out.insertAdjacentElement('beforebegin', controls);
      const liveStatus = document.createElement('div');
      liveStatus.id = 'nxMegaWeatherStatus';
      liveStatus.className = 'nxwx-live-status';
      liveStatus.textContent = 'Live weather will load from your location.';
      out.insertAdjacentElement('beforebegin', liveStatus);
      $('nxMegaWeatherCityBtn')?.addEventListener('click', () => loadMegaWeather('city'));
      $('nxMegaWeatherGeoBtn')?.addEventListener('click', () => loadMegaWeather('geo'));
      $('nxMegaWeatherCity')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') loadMegaWeather('city');
      });
    }

    if (tab.classList.contains('active') && tab.dataset.nxWeatherAutoLoaded !== '1') {
      tab.dataset.nxWeatherAutoLoaded = '1';
      setTimeout(() => loadMegaWeather('geo'), 120);
    }
    if (tab.dataset.nxWeatherObserved !== '1') {
      tab.dataset.nxWeatherObserved = '1';
      new MutationObserver(() => {
        if (!tab.classList.contains('active') || tab.dataset.nxWeatherAutoLoaded === '1') return;
        tab.dataset.nxWeatherAutoLoaded = '1';
        loadMegaWeather('geo');
      }).observe(tab, { attributes:true, attributeFilter:['class'] });
    }
    return true;
  }

  function install(){ensureCss();installWeather();installMegaWeather();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,1550),{once:true}); else setTimeout(install,350);
  new MutationObserver(()=>{installWeather();installMegaWeather()}).observe(document.documentElement,{childList:true,subtree:true});
  [2200,4000,7000].forEach(ms=>setTimeout(install,ms));
  window.nexusWeatherVisual=Object.freeze({version:'2.0.0',loadTools:loadPremiumWeather,loadMega:loadMegaWeather});
})();
