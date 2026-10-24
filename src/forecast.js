const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// Returns the current hour in Algeria time as "YYYY-MM-DDTHH:00",
// the same format Open-Meteo uses for hourly timestamps.
function currentHourKey(timezone, date = new Date()) {
  const local = date.toLocaleString('sv-SE', { timeZone: timezone });
  return `${local.slice(0, 13).replace(' ', 'T')}:00`;
}

async function getRainRisk({ lat, lon, timezone, hoursAhead, threshold }) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'precipitation_probability',
    forecast_days: '2',
    timezone,
  });

  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const data = await res.json();

  const times = data.hourly.time;
  const probs = data.hourly.precipitation_probability;

  let start = times.indexOf(currentHourKey(timezone));
  if (start === -1) start = 0;

  const hours = [];
  for (let i = start; i <= start + hoursAhead && i < times.length; i++) {
    hours.push({ time: times[i], probability: probs[i] ?? 0 });
  }

  const peak = hours.reduce((best, h) => (h.probability > best.probability ? h : best), hours[0]);

  return {
    risky: peak.probability >= threshold,
    peakProbability: peak.probability,
    peakTime: peak.time,
    hours,
  };
}

module.exports = { getRainRisk };
