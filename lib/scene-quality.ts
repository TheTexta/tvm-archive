export type SceneHardware = {
  width: number;
  height: number;
  pixelRatio: number;
  saveData?: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
};

export function defaultToEnhancedDetail(
  hardware: SceneHardware,
  finePointer: boolean,
) {
  return hardware.width >= 800 && finePointer && !hardware.saveData;
}

// Capability hints rule out obviously constrained devices; frame timing makes
// the final decision. A device name, GPU model or persistent fingerprint is not needed.
export function canTrialTextureDetail(hardware: SceneHardware) {
  const pixels =
    hardware.width * hardware.height * Math.min(hardware.pixelRatio, 2) ** 2;
  return (
    !hardware.saveData &&
    pixels <= 8_000_000 &&
    (hardware.deviceMemory === undefined || hardware.deviceMemory >= 4) &&
    (hardware.hardwareConcurrency === undefined ||
      hardware.hardwareConcurrency >= 4)
  );
}

export function p90FrameTime(samples: number[]) {
  if (samples.length < 60) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.9) - 1];
}

export function canTrialAfterBaseline(samples: number[]) {
  const p90 = p90FrameTime(samples);
  return p90 !== null && p90 <= 20;
}

export function enhancedDetailIsSmooth(baselineP90: number, samples: number[]) {
  const p90 = p90FrameTime(samples);
  if (p90 === null) return null;
  return p90 <= Math.min(24, Math.max(11, baselineP90 * 1.3));
}
