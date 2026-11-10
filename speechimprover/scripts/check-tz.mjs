// Re-runs aggregate.js's day checks in a UTC-3 zone, where a 22:30 take is already
// "tomorrow" in UTC — the case the local-day rule exists for. node scripts/check-tz.mjs
process.env.TZ = 'America/Sao_Paulo'; // must be set before any Date is made
if (new Date(2026, 0, 1).getTimezoneOffset() !== 180) throw new Error('TZ override not honoured by this Node');
const { demo } = await import('../src/lib/aggregate.js');
console.log(`${demo()} (TZ=${process.env.TZ})`);
