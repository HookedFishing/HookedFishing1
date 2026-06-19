const PATTERNS = {
  nibble: 8,
  bite: [28, 18, 42],
  catch: [16, 24, 16, 48],
  reelGood: 10,
  fail: [40, 28, 55],
  upgrade: [12, 20, 30],
};

export function playHaptic(kind) {
  if (!navigator.vibrate) return;
  const pattern = PATTERNS[kind];
  if (!pattern) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Vibration blocked or unavailable.
  }
}
