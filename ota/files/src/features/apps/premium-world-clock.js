import { escapeHtml, loadJson, saveJson } from '../../core/local-store.js';

function node(html, className = '') {
  const root = document.createElement('div');
  root.className = `nx-app-body nx-premium-instruments ${className}`.trim();
  root.innerHTML = html;
  return root;
}

const CLOCK_KEY = 'nexus_world_clocks_v3';
const COUNTRIES = [["AD",["Europe/Andorra"]],["AE",["Asia/Dubai"]],["AF",["Asia/Kabul"]],["AG",["America/Antigua"]],["AI",["America/Anguilla"]],["AL",["Europe/Tirane"]],["AM",["Asia/Yerevan"]],["AO",["Africa/Luanda"]],["AQ",["Antarctica/McMurdo","Antarctica/Casey","Antarctica/Davis","Antarctica/DumontDUrville","Antarctica/Mawson","Antarctica/Palmer","Antarctica/Rothera","Antarctica/Syowa","Antarctica/Troll","Antarctica/Vostok"]],["AR",["America/Argentina/Buenos_Aires","America/Argentina/Cordoba","America/Argentina/Salta","America/Argentina/Jujuy","America/Argentina/Tucuman","America/Argentina/Catamarca","America/Argentina/La_Rioja","America/Argentina/San_Juan","America/Argentina/Mendoza","America/Argentina/San_Luis","America/Argentina/Rio_Gallegos","America/Argentina/Ushuaia"]],["AS",["Pacific/Pago_Pago"]],["AT",["Europe/Vienna"]],["AU",["Australia/Lord_Howe","Antarctica/Macquarie","Australia/Hobart","Australia/Melbourne","Australia/Sydney","Australia/Broken_Hill","Australia/Brisbane","Australia/Lindeman","Australia/Adelaide","Australia/Darwin","Australia/Perth","Australia/Eucla"]],["AW",["America/Aruba"]],["AX",["Europe/Mariehamn"]],["AZ",["Asia/Baku"]],["BA",["Europe/Sarajevo"]],["BB",["America/Barbados"]],["BD",["Asia/Dhaka"]],["BE",["Europe/Brussels"]],["BF",["Africa/Ouagadougou"]],["BG",["Europe/Sofia"]],["BH",["Asia/Bahrain"]],["BI",["Africa/Bujumbura"]],["BJ",["Africa/Porto-Novo"]],["BL",["America/St_Barthelemy"]],["BM",["Atlantic/Bermuda"]],["BN",["Asia/Brunei"]],["BO",["America/La_Paz"]],["BQ",["America/Kralendijk"]],["BR",["America/Noronha","America/Belem","America/Fortaleza","America/Recife","America/Araguaina","America/Maceio","America/Bahia","America/Sao_Paulo","America/Campo_Grande","America/Cuiaba","America/Santarem","America/Porto_Velho","America/Boa_Vista","America/Manaus","America/Eirunepe","America/Rio_Branco"]],["BS",["America/Nassau"]],["BT",["Asia/Thimphu"]],["BV",["UTC"]],["BW",["Africa/Gaborone"]],["BY",["Europe/Minsk"]],["BZ",["America/Belize"]],["CA",["America/St_Johns","America/Halifax","America/Glace_Bay","America/Moncton","America/Goose_Bay","America/Blanc-Sablon","America/Toronto","America/Iqaluit","America/Atikokan","America/Winnipeg","America/Resolute","America/Rankin_Inlet","America/Regina","America/Swift_Current","America/Edmonton","America/Cambridge_Bay","America/Inuvik","America/Vancouver","America/Creston","America/Dawson_Creek","America/Fort_Nelson","America/Whitehorse","America/Dawson"]],["CC",["Indian/Cocos"]],["CD",["Africa/Kinshasa","Africa/Lubumbashi"]],["CF",["Africa/Bangui"]],["CG",["Africa/Brazzaville"]],["CH",["Europe/Zurich"]],["CI",["Africa/Abidjan"]],["CK",["Pacific/Rarotonga"]],["CL",["America/Santiago","America/Coyhaique","America/Punta_Arenas","Pacific/Easter"]],["CM",["Africa/Douala"]],["CN",["Asia/Shanghai","Asia/Urumqi"]],["CO",["America/Bogota"]],["CR",["America/Costa_Rica"]],["CU",["America/Havana"]],["CV",["Atlantic/Cape_Verde"]],["CW",["America/Curacao"]],["CX",["Indian/Christmas"]],["CY",["Asia/Nicosia","Asia/Famagusta"]],["CZ",["Europe/Prague"]],["DE",["Europe/Berlin","Europe/Busingen"]],["DJ",["Africa/Djibouti"]],["DK",["Europe/Copenhagen"]],["DM",["America/Dominica"]],["DO",["America/Santo_Domingo"]],["DZ",["Africa/Algiers"]],["EC",["America/Guayaquil","Pacific/Galapagos"]],["EE",["Europe/Tallinn"]],["EG",["Africa/Cairo"]],["EH",["Africa/El_Aaiun"]],["ER",["Africa/Asmara"]],["ES",["Europe/Madrid","Africa/Ceuta","Atlantic/Canary"]],["ET",["Africa/Addis_Ababa"]],["FI",["Europe/Helsinki"]],["FJ",["Pacific/Fiji"]],["FK",["Atlantic/Stanley"]],["FM",["Pacific/Chuuk","Pacific/Pohnpei","Pacific/Kosrae"]],["FO",["Atlantic/Faroe"]],["FR",["Europe/Paris"]],["GA",["Africa/Libreville"]],["GB",["Europe/London"]],["GD",["America/Grenada"]],["GE",["Asia/Tbilisi"]],["GF",["America/Cayenne"]],["GG",["Europe/Guernsey"]],["GH",["Africa/Accra"]],["GI",["Europe/Gibraltar"]],["GL",["America/Nuuk","America/Danmarkshavn","America/Scoresbysund","America/Thule"]],["GM",["Africa/Banjul"]],["GN",["Africa/Conakry"]],["GP",["America/Guadeloupe"]],["GQ",["Africa/Malabo"]],["GR",["Europe/Athens"]],["GS",["Atlantic/South_Georgia"]],["GT",["America/Guatemala"]],["GU",["Pacific/Guam"]],["GW",["Africa/Bissau"]],["GY",["America/Guyana"]],["HK",["Asia/Hong_Kong"]],["HM",["UTC"]],["HN",["America/Tegucigalpa"]],["HR",["Europe/Zagreb"]],["HT",["America/Port-au-Prince"]],["HU",["Europe/Budapest"]],["ID",["Asia/Jakarta","Asia/Pontianak","Asia/Makassar","Asia/Jayapura"]],["IE",["Europe/Dublin"]],["IL",["Asia/Jerusalem"]],["IM",["Europe/Isle_of_Man"]],["IN",["Asia/Kolkata"]],["IO",["Indian/Chagos"]],["IQ",["Asia/Baghdad"]],["IR",["Asia/Tehran"]],["IS",["Atlantic/Reykjavik"]],["IT",["Europe/Rome"]],["JE",["Europe/Jersey"]],["JM",["America/Jamaica"]],["JO",["Asia/Amman"]],["JP",["Asia/Tokyo"]],["KE",["Africa/Nairobi"]],["KG",["Asia/Bishkek"]],["KH",["Asia/Phnom_Penh"]],["KI",["Pacific/Tarawa","Pacific/Kanton","Pacific/Kiritimati"]],["KM",["Indian/Comoro"]],["KN",["America/St_Kitts"]],["KP",["Asia/Pyongyang"]],["KR",["Asia/Seoul"]],["KW",["Asia/Kuwait"]],["KY",["America/Cayman"]],["KZ",["Asia/Almaty","Asia/Qyzylorda","Asia/Qostanay","Asia/Aqtobe","Asia/Aqtau","Asia/Atyrau","Asia/Oral"]],["LA",["Asia/Vientiane"]],["LB",["Asia/Beirut"]],["LC",["America/St_Lucia"]],["LI",["Europe/Vaduz"]],["LK",["Asia/Colombo"]],["LR",["Africa/Monrovia"]],["LS",["Africa/Maseru"]],["LT",["Europe/Vilnius"]],["LU",["Europe/Luxembourg"]],["LV",["Europe/Riga"]],["LY",["Africa/Tripoli"]],["MA",["Africa/Casablanca"]],["MC",["Europe/Monaco"]],["MD",["Europe/Chisinau"]],["ME",["Europe/Podgorica"]],["MF",["America/Marigot"]],["MG",["Indian/Antananarivo"]],["MH",["Pacific/Majuro","Pacific/Kwajalein"]],["MK",["Europe/Skopje"]],["ML",["Africa/Bamako"]],["MM",["Asia/Yangon"]],["MN",["Asia/Ulaanbaatar","Asia/Hovd"]],["MO",["Asia/Macau"]],["MP",["Pacific/Saipan"]],["MQ",["America/Martinique"]],["MR",["Africa/Nouakchott"]],["MS",["America/Montserrat"]],["MT",["Europe/Malta"]],["MU",["Indian/Mauritius"]],["MV",["Indian/Maldives"]],["MW",["Africa/Blantyre"]],["MX",["America/Mexico_City","America/Cancun","America/Merida","America/Monterrey","America/Matamoros","America/Chihuahua","America/Ciudad_Juarez","America/Ojinaga","America/Mazatlan","America/Bahia_Banderas","America/Hermosillo","America/Tijuana"]],["MY",["Asia/Kuala_Lumpur","Asia/Kuching"]],["MZ",["Africa/Maputo"]],["NA",["Africa/Windhoek"]],["NC",["Pacific/Noumea"]],["NE",["Africa/Niamey"]],["NF",["Pacific/Norfolk"]],["NG",["Africa/Lagos"]],["NI",["America/Managua"]],["NL",["Europe/Amsterdam"]],["NO",["Europe/Oslo"]],["NP",["Asia/Kathmandu"]],["NR",["Pacific/Nauru"]],["NU",["Pacific/Niue"]],["NZ",["Pacific/Auckland","Pacific/Chatham"]],["OM",["Asia/Muscat"]],["PA",["America/Panama"]],["PE",["America/Lima"]],["PF",["Pacific/Tahiti","Pacific/Marquesas","Pacific/Gambier"]],["PG",["Pacific/Port_Moresby","Pacific/Bougainville"]],["PH",["Asia/Manila"]],["PK",["Asia/Karachi"]],["PL",["Europe/Warsaw"]],["PM",["America/Miquelon"]],["PN",["Pacific/Pitcairn"]],["PR",["America/Puerto_Rico"]],["PS",["Asia/Gaza","Asia/Hebron"]],["PT",["Europe/Lisbon","Atlantic/Madeira","Atlantic/Azores"]],["PW",["Pacific/Palau"]],["PY",["America/Asuncion"]],["QA",["Asia/Qatar"]],["RE",["Indian/Reunion"]],["RO",["Europe/Bucharest"]],["RS",["Europe/Belgrade"]],["RU",["Europe/Kaliningrad","Europe/Moscow","Europe/Kirov","Europe/Volgograd","Europe/Astrakhan","Europe/Saratov","Europe/Ulyanovsk","Europe/Samara","Asia/Yekaterinburg","Asia/Omsk","Asia/Novosibirsk","Asia/Barnaul","Asia/Tomsk","Asia/Novokuznetsk","Asia/Krasnoyarsk","Asia/Irkutsk","Asia/Chita","Asia/Yakutsk","Asia/Khandyga","Asia/Vladivostok","Asia/Ust-Nera","Asia/Magadan","Asia/Sakhalin","Asia/Srednekolymsk","Asia/Kamchatka","Asia/Anadyr"]],["RW",["Africa/Kigali"]],["SA",["Asia/Riyadh"]],["SB",["Pacific/Guadalcanal"]],["SC",["Indian/Mahe"]],["SD",["Africa/Khartoum"]],["SE",["Europe/Stockholm"]],["SG",["Asia/Singapore"]],["SH",["Atlantic/St_Helena"]],["SI",["Europe/Ljubljana"]],["SJ",["Arctic/Longyearbyen"]],["SK",["Europe/Bratislava"]],["SL",["Africa/Freetown"]],["SM",["Europe/San_Marino"]],["SN",["Africa/Dakar"]],["SO",["Africa/Mogadishu"]],["SR",["America/Paramaribo"]],["SS",["Africa/Juba"]],["ST",["Africa/Sao_Tome"]],["SV",["America/El_Salvador"]],["SX",["America/Lower_Princes"]],["SY",["Asia/Damascus"]],["SZ",["Africa/Mbabane"]],["TC",["America/Grand_Turk"]],["TD",["Africa/Ndjamena"]],["TF",["Indian/Kerguelen"]],["TG",["Africa/Lome"]],["TH",["Asia/Bangkok"]],["TJ",["Asia/Dushanbe"]],["TK",["Pacific/Fakaofo"]],["TL",["Asia/Dili"]],["TM",["Asia/Ashgabat"]],["TN",["Africa/Tunis"]],["TO",["Pacific/Tongatapu"]],["TR",["Europe/Istanbul"]],["TT",["America/Port_of_Spain"]],["TV",["Pacific/Funafuti"]],["TW",["Asia/Taipei"]],["TZ",["Africa/Dar_es_Salaam"]],["UA",["Europe/Simferopol","Europe/Kyiv"]],["UG",["Africa/Kampala"]],["UM",["Pacific/Midway","Pacific/Wake"]],["US",["America/New_York","America/Detroit","America/Kentucky/Louisville","America/Kentucky/Monticello","America/Indiana/Indianapolis","America/Indiana/Vincennes","America/Indiana/Winamac","America/Indiana/Marengo","America/Indiana/Petersburg","America/Indiana/Vevay","America/Chicago","America/Indiana/Tell_City","America/Indiana/Knox","America/Menominee","America/North_Dakota/Center","America/North_Dakota/New_Salem","America/North_Dakota/Beulah","America/Denver","America/Boise","America/Phoenix","America/Los_Angeles","America/Anchorage","America/Juneau","America/Sitka","America/Metlakatla","America/Yakutat","America/Nome","America/Adak","Pacific/Honolulu"]],["UY",["America/Montevideo"]],["UZ",["Asia/Samarkand","Asia/Tashkent"]],["VA",["Europe/Vatican"]],["VC",["America/St_Vincent"]],["VE",["America/Caracas"]],["VG",["America/Tortola"]],["VI",["America/St_Thomas"]],["VN",["Asia/Ho_Chi_Minh"]],["VU",["Pacific/Efate"]],["WF",["Pacific/Wallis"]],["WS",["Pacific/Apia"]],["YE",["Asia/Aden"]],["YT",["Indian/Mayotte"]],["ZA",["Africa/Johannesburg"]],["ZM",["Africa/Lusaka"]],["ZW",["Africa/Harare"]]];
const DEFAULT_CLOCKS = [
  { code:'PK', label:'Pakistan', zone:'Asia/Karachi' },
  { code:'AE', label:'United Arab Emirates', zone:'Asia/Dubai' },
  { code:'GB', label:'United Kingdom', zone:'Europe/London' },
  { code:'US', label:'United States', zone:'America/New_York' },
  { code:'JP', label:'Japan', zone:'Asia/Tokyo' }
];

function flag(code) {
  return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(char => 127397 + char.charCodeAt(0))) : '🌐';
}

function displayName(code) {
  try { return new Intl.DisplayNames([navigator.language || 'en'], { type:'region' }).of(code) || code; }
  catch { return code; }
}

function cityLabel(zone) {
  if (zone === 'UTC') return 'UTC';
  const part = String(zone).split('/').pop() || zone;
  return part.replaceAll('_',' ');
}

function timeZoneAbbr(zone) {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZone:zone, timeZoneName:'short' }).formatToParts(new Date());
    return parts.find(part => part.type === 'timeZoneName')?.value || zone;
  } catch { return zone; }
}

function readClocks() {
  const saved = loadJson(CLOCK_KEY, null);
  if (Array.isArray(saved)) return saved.filter(item => item?.zone).slice(0, 24);
  return DEFAULT_CLOCKS.map(item => ({ ...item }));
}

function writeClocks(clocks) { saveJson(CLOCK_KEY, clocks.slice(0,24)); }

export function renderWorldClockPremium() {
  const countryRows = COUNTRIES.map(([code,zones]) => ({ code, zones, name:displayName(code) })).sort((a,b)=>a.name.localeCompare(b.name));
  const root = node(`
    <section class="nxclock-console">
      <header><div><span>GLOBAL TIME NETWORK</span><strong>World Clock</strong></div><b>${countryRows.length} COUNTRIES</b></header>
      <div class="nxclock-picker">
        <label><span>COUNTRY</span><select data-clock-country aria-label="Select country"></select></label>
        <label><span>TIME ZONE</span><select data-clock-zone aria-label="Select time zone"></select></label>
        <button class="nxpi-action" type="button" data-clock-add>ADD CLOCK</button>
      </div>
      <p class="nxpi-status" data-clock-status>Choose any country, then select its time zone.</p>
    </section>
    <section class="nxclock-grid" data-clock-list></section>
  `, 'nx-world-clock-premium');

  const countrySelect = root.querySelector('[data-clock-country]');
  const zoneSelect = root.querySelector('[data-clock-zone]');
  const add = root.querySelector('[data-clock-add]');
  const status = root.querySelector('[data-clock-status]');
  const list = root.querySelector('[data-clock-list]');
  let timer = null;

  countrySelect.innerHTML = countryRows.map(row => `<option value="${escapeHtml(row.code)}">${flag(row.code)} ${escapeHtml(row.name)}</option>`).join('');
  countrySelect.value = 'PK';

  const selectedCountry = () => countryRows.find(row => row.code === countrySelect.value) || countryRows[0];
  const renderZones = () => {
    const row = selectedCountry();
    zoneSelect.innerHTML = row.zones.map(zone => `<option value="${escapeHtml(zone)}">${escapeHtml(cityLabel(zone))} • ${escapeHtml(zone)}</option>`).join('');
    status.textContent = `${flag(row.code)} ${row.name} • ${row.zones.length} time zone${row.zones.length===1?'':'s'} available.`;
  };

  const draw = () => {
    const clocks = readClocks();
    const now = new Date();
    list.innerHTML = clocks.length ? clocks.map((clock,index) => {
      let time='—', date='—';
      try {
        time = now.toLocaleTimeString([], { timeZone:clock.zone, hour:'2-digit', minute:'2-digit', second:'2-digit' });
        date = now.toLocaleDateString([], { timeZone:clock.zone, weekday:'short', day:'2-digit', month:'short', year:'numeric' });
      } catch {}
      const code = String(clock.code || '').toUpperCase();
      const label = clock.label || (code ? displayName(code) : cityLabel(clock.zone));
      return `<article class="nxclock-card">
        <div><span>${flag(code)} ${escapeHtml(label)}</span><small>${escapeHtml(cityLabel(clock.zone))} • ${escapeHtml(date)} • ${escapeHtml(timeZoneAbbr(clock.zone))}</small></div>
        <strong>${escapeHtml(time)}</strong>
        <button type="button" data-clock-remove="${index}" aria-label="Remove ${escapeHtml(label)}">×</button>
      </article>`;
    }).join('') : '<div class="nx-empty">No clocks added yet.</div>';
    list.querySelectorAll('[data-clock-remove]').forEach(button => button.addEventListener('click', () => {
      const clocks = readClocks(); clocks.splice(Number(button.dataset.clockRemove),1); writeClocks(clocks); draw();
    }));
  };

  countrySelect.addEventListener('change', renderZones);
  add.addEventListener('click', () => {
    const row = selectedCountry();
    const zone = zoneSelect.value;
    if (!row || !zone) return;
    const clocks = readClocks();
    if (clocks.some(item => item.code === row.code && item.zone === zone)) {
      status.textContent = `${flag(row.code)} ${row.name} • ${cityLabel(zone)} is already added.`;
      return;
    }
    clocks.push({ code:row.code, label:row.name, zone }); writeClocks(clocks); draw();
    status.textContent = `${flag(row.code)} ${row.name} • ${cityLabel(zone)} added.`;
  });

  renderZones(); draw(); timer = setInterval(draw,1000);
  root.__cleanup = () => clearInterval(timer);
  return root;
}

export const premiumWorldClockRenderers = Object.freeze({ 'world-clock': renderWorldClockPremium });
