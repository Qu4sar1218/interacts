import * as faceapi from 'face-api.js';
import { FACE_CONFIG } from '@/lib/faceConfig';

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

// Models load from public/models by default; override with VITE_FACE_MODEL_URL (e.g. CDN URL).
const MODEL_URL = import.meta.env.VITE_FACE_MODEL_URL || '/models';

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      console.log('Face-api models loaded successfully');
    } catch (error) {
      console.error('Error loading face-api models:', error);
      loadingPromise = null;
      throw error;
    }
  })();

  return loadingPromise;
}

export function isModelsLoaded(): boolean {
  return modelsLoaded;
}

export interface FaceDetectionResult {
  descriptor: Float32Array;
  box: faceapi.Box;
  landmarks: faceapi.FaceLandmarks68;
}

export async function detectFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<FaceDetectionResult | null> {
  if (!modelsLoaded) {
    await loadModels();
  }

  const detection = await faceapi
    .detectSingleFace(
      input,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: FACE_CONFIG.DETECTION_INPUT_SIZE,
        scoreThreshold: FACE_CONFIG.DETECTION_SCORE_THRESHOLD,
      })
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;

  return {
    descriptor: detection.descriptor,
    box: detection.detection.box,
    landmarks: detection.landmarks,
  };
}

export async function detectAllFaces(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<FaceDetectionResult[]> {
  if (!modelsLoaded) {
    await loadModels();
  }

  const detections = await faceapi
    .detectAllFaces(
      input,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: FACE_CONFIG.DETECTION_INPUT_SIZE,
        scoreThreshold: FACE_CONFIG.DETECTION_SCORE_THRESHOLD,
      })
    )
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections.map((d) => ({
    descriptor: d.descriptor,
    box: d.detection.box,
    landmarks: d.landmarks,
  }));
}

export function compareFaces(
  descriptor1: Float32Array,
  descriptor2: Float32Array
): number {
  return faceapi.euclideanDistance(descriptor1, descriptor2);
}

export interface MatchOptions {
  threshold?: number;
  minConfidence?: number;
  ambiguityMargin?: number;
  minMatchingDescriptors?: number;
}

export interface MatchResult {
  userId: string;
  distance: number;
  confidence: number;
  matchedDescriptors: number;
  isAmbiguous: boolean;
}

const DEFAULT_MATCH_OPTIONS: Required<MatchOptions> = {
  threshold: 0.45,
  minConfidence: 0.7,
  ambiguityMargin: 0.08,
  minMatchingDescriptors: 2,
};

export function findBestMatch(
  queryDescriptor: Float32Array,
  storedDescriptors: { userId: string; descriptors: Float32Array[] }[],
  options?: MatchOptions
): MatchResult | null {
  const opts = { ...DEFAULT_MATCH_OPTIONS, ...options };
  const { threshold, minConfidence, ambiguityMargin, minMatchingDescriptors } = opts;

  // For each user, compute min distance and count of descriptors below threshold
  type UserMatch = { userId: string; minDistance: number; matchingCount: number };
  const userResults: UserMatch[] = [];

  for (const user of storedDescriptors) {
    let minDistance = Infinity;
    let matchingCount = 0;
    for (const descriptor of user.descriptors) {
      const distance = compareFaces(queryDescriptor, descriptor);
      if (distance < threshold) matchingCount++;
      if (distance < minDistance) minDistance = distance;
    }
    userResults.push({ userId: user.userId, minDistance, matchingCount });
  }

  // Sort by minDistance ascending
  userResults.sort((a, b) => a.minDistance - b.minDistance);
  const best = userResults[0];
  const secondBest = userResults[1];

  if (!best || best.minDistance >= threshold) return null;
  if (best.matchingCount < minMatchingDescriptors) return null;

  const confidence = Math.max(0, Math.min(1, 1 - best.minDistance / threshold));
  if (confidence < minConfidence) return null;

  const isAmbiguous =
    secondBest != null &&
    secondBest.minDistance < threshold &&
    best.minDistance + ambiguityMargin >= secondBest.minDistance;

  return {
    userId: best.userId,
    distance: best.minDistance,
    confidence,
    matchedDescriptors: best.matchingCount,
    isAmbiguous,
  };
}

/**
 * Returns true if the new descriptor is sufficiently different from all existing ones.
 * Used during registration to ensure capture diversity (angle/expression).
 */
export function isCaptureDistinct(
  newDescriptor: Float32Array,
  existingDescriptors: Float32Array[],
  minDistance: number = 0.15
): boolean {
  return existingDescriptors.every(
    (existing) => compareFaces(newDescriptor, existing) > minDistance
  );
}

export function drawFaceBox(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  box: faceapi.Box,
  label?: string,
  color: string = '#22c55e'
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Scale box coordinates to canvas size
  const scaleX = canvas.width / video.videoWidth;
  const scaleY = canvas.height / video.videoHeight;

  const x = box.x * scaleX;
  const y = box.y * scaleY;
  const width = box.width * scaleX;
  const height = box.height * scaleY;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  if (label) {
    ctx.fillStyle = color;
    ctx.font = '14px var(--font-sans), system-ui, sans-serif';
    const textWidth = ctx.measureText(label).width;
    ctx.fillRect(x, y - 22, textWidth + 10, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 5, y - 6);
  }
}

export function captureFrame(video: HTMLVideoElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.8);
}

export function captureFaceThumbnail(
  video: HTMLVideoElement,
  box: faceapi.Box,
  padding: number = 40
): string {
  const canvas = document.createElement('canvas');
  const size = Math.max(box.width, box.height) + padding * 2;
  // Higher resolution thumbnail so the stored/preview face is readable.
  // (Still small enough to fit backend 2MB upload limit easily.)
  const THUMB_SIZE = 256;
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const sx = Math.max(0, box.x - padding);
  const sy = Math.max(0, box.y - padding);
  const sw = Math.min(size, video.videoWidth - sx);
  const sh = Math.min(size, video.videoHeight - sy);

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, THUMB_SIZE, THUMB_SIZE);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Fast, local-only quality signal to prevent enrolling very blurry/dark frames.
 * This does NOT replace recognition accuracy; it improves the input quality.
 */
export function assessFaceCaptureQuality(
  video: HTMLVideoElement,
  box: faceapi.Box
): { score: number; metrics: { faceAreaRatio: number; brightness: number; sharpness: number }; reasons: string[] } {
  const reasons: string[] = [];

  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const faceAreaRatio = (box.width * box.height) / (vw * vh);

  // Draw a normalized face crop for measurement.
  const canvas = document.createElement('canvas');
  const SIZE = 256;
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { score: 0, metrics: { faceAreaRatio, brightness: 0, sharpness: 0 }, reasons: ['Could not assess image quality'] };
  }

  const padding = Math.max(20, Math.round(Math.max(box.width, box.height) * 0.15));
  const sx = Math.max(0, box.x - padding);
  const sy = Math.max(0, box.y - padding);
  const sw = Math.min(box.width + padding * 2, vw - sx);
  const sh = Math.min(box.height + padding * 2, vh - sy);
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, SIZE, SIZE);

  const image = ctx.getImageData(0, 0, SIZE, SIZE).data;

  // Brightness: mean luma
  let sum = 0;
  const gray = new Float32Array(SIZE * SIZE);
  for (let i = 0, p = 0; i < image.length; i += 4, p++) {
    const r = image[i]!;
    const g = image[i + 1]!;
    const b = image[i + 2]!;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    gray[p] = y;
    sum += y;
  }
  const brightness = sum / gray.length; // 0..255

  // Sharpness: variance of a simple Laplacian response
  let lapSum = 0;
  let lapSumSq = 0;
  let count = 0;
  const w = SIZE;
  for (let y = 1; y < SIZE - 1; y++) {
    for (let x = 1; x < SIZE - 1; x++) {
      const c = gray[y * w + x]!;
      const lap =
        8 * c -
        gray[(y - 1) * w + x]! -
        gray[(y + 1) * w + x]! -
        gray[y * w + (x - 1)]! -
        gray[y * w + (x + 1)]! -
        gray[(y - 1) * w + (x - 1)]! -
        gray[(y - 1) * w + (x + 1)]! -
        gray[(y + 1) * w + (x - 1)]! -
        gray[(y + 1) * w + (x + 1)]!;
      lapSum += lap;
      lapSumSq += lap * lap;
      count++;
    }
  }
  const lapMean = lapSum / Math.max(1, count);
  const sharpnessVar = lapSumSq / Math.max(1, count) - lapMean * lapMean;

  // Map raw metrics to 0..1 signals.
  const sizeScore = clamp01((faceAreaRatio - 0.03) / (0.12 - 0.03));
  const brightnessScore = clamp01((brightness - 50) / (170 - 50)); // too dark < ~50, too bright isn't penalized heavily
  const sharpnessScore = clamp01((sharpnessVar - 80) / (400 - 80)); // heuristic range for webcam frames

  if (faceAreaRatio < 0.03) reasons.push('Move closer to the camera');
  if (brightness < 50) reasons.push('Improve lighting (too dark)');
  if (sharpnessVar < 80) reasons.push('Hold still / clean lens (image too blurry)');

  const score = clamp01(0.25 * sizeScore + 0.25 * brightnessScore + 0.5 * sharpnessScore);

  return {
    score,
    metrics: { faceAreaRatio, brightness, sharpness: sharpnessVar },
    reasons,
  };
}
