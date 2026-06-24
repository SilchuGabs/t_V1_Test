/**
 * tv-client.js — thin wrapper around @mathieuc/tradingview
 *
 * Scope, on purpose: READ-ONLY. This module never places an order, never
 * touches a broker, and has no execution path. It connects to TradingView's
 * data session using YOUR session cookies (never your password — see
 * .env.example) and reads indicator values the same way your browser does
 * when you have the chart open.
 */
import TradingView from '@mathieuc/tradingview';

const SESSION = process.env.TV_SESSION;
const SIGNATURE = process.env.TV_SIGNATURE;
const USERNAME = process.env.TV_USERNAME;

if (!SESSION || !SIGNATURE) {
  throw new Error(
    'TV_SESSION and TV_SIGNATURE are required in .env. ' +
    'Pull these from your own logged-in browser (DevTools > Application > ' +
    'Cookies > tradingview.com > sessionid / sessionid_sign). ' +
    'Never use your actual TradingView password here or anywhere in this project.'
  );
}

let client = null;
function getClient() {
  if (!client) {
    client = new TradingView.Client({ token: SESSION, signature: SIGNATURE });
  }
  return client;
}

/** List every private/custom indicator saved on the account. */
export async function listPrivateIndicators() {
  if (!USERNAME) {
    throw new Error('TV_USERNAME is required in .env to list private indicators.');
  }
  const indicators = await TradingView.getPrivateIndicators(USERNAME);
  return indicators.map((i) => ({ id: i.id, name: i.name, version: i.version }));
}

/**
 * Attach a named private indicator to a live symbol/timeframe session and
 * resolve with a single snapshot once the first full set of values arrives.
 *
 * @param {string} symbol     e.g. "NASDAQ:PLTR"
 * @param {string} timeframe  TradingView style: "5" = 5-minute, "60" = 1h, "D" = daily
 * @param {string} indicatorNameMatch  substring to match against your saved indicator names
 * @param {number} timeoutMs  give up if no data arrives in this window
 */
export async function getLiveSnapshot(symbol, timeframe, indicatorNameMatch, timeoutMs = 15000) {
  const session = getClient().Session;
  const chart = new session.Chart();
  chart.setMarket(symbol, { timeframe });

  const indicatorList = await TradingView.getPrivateIndicators(USERNAME);
  const match = indicatorList.find((i) =>
    i.name.toLowerCase().includes(indicatorNameMatch.toLowerCase()));

  if (!match) {
    chart.delete();
    const available = indicatorList.map((i) => i.name).join(', ');
    throw new Error(
      `No private indicator matched "${indicatorNameMatch}". Available: ${available}`
    );
  }

  const indicatorDef = await match.get();
  const study = new chart.Study(indicatorDef);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chart.delete();
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for "${match.name}" to load.`));
    }, timeoutMs);

    study.onUpdate(() => {
      const periods = study.periods;
      if (!periods || !periods.length) return;
      clearTimeout(timer);
      const latest = periods[0]; // periods are sorted newest-first
      chart.delete();
      resolve({
        symbol,
        timeframe,
        indicator: match.name,
        time: latest.$time,
        values: latest,
      });
    });

    study.onError((...err) => {
      clearTimeout(timer);
      chart.delete();
      reject(new Error(`Indicator error: ${err.join(' ')}`));
    });
  });
}

/**
 * Pull a range of historical periods for the same indicator, for backtesting
 * or for checking what the framework said at a specific past moment.
 */
export async function getHistoricalValues(symbol, timeframe, indicatorNameMatch, range = 300) {
  const session = getClient().Session;
  const chart = new session.Chart();
  chart.setMarket(symbol, { timeframe, range });

  const indicatorList = await TradingView.getPrivateIndicators(USERNAME);
  const match = indicatorList.find((i) =>
    i.name.toLowerCase().includes(indicatorNameMatch.toLowerCase()));

  if (!match) {
    chart.delete();
    throw new Error(`No private indicator matched "${indicatorNameMatch}".`);
  }

  const indicatorDef = await match.get();
  const study = new chart.Study(indicatorDef);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chart.delete();
      reject(new Error('Timed out waiting for historical study data.'));
    }, 20000);

    let settled = false;
    study.onUpdate(() => {
      const periods = study.periods;
      if (!periods || periods.length < range * 0.5) return; // wait for a full-ish backfill
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chart.delete();
      resolve({ symbol, timeframe, indicator: match.name, count: periods.length, periods });
    });
  });
}

export function closeClient() {
  if (client) {
    client.end();
    client = null;
  }
}
