// Preview only: physical coordinates, never bottle identity or fabricated timestamps.
export function demoSensor(accountId, wallId, row, col) {
  let hash = 2166136261;
  for (const char of JSON.stringify([accountId,wallId,row,col])) hash = Math.imul(hash ^ char.charCodeAt(0),16777619) >>> 0;
  return { temperature: Number((12 + hash % 35 / 10).toFixed(1)), humidity: 62 + Math.floor(hash / 35) % 15, isSimulated:true, measuredAt:null };
}
