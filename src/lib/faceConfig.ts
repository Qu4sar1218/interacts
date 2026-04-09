/**
 * Centralized configuration for face recognition (matching and registration).
 */

export const FACE_CONFIG = {
  // Matching (Scanner) – tuned so enrolled faces match under normal lighting/angle variation
  MATCH_THRESHOLD: 0.52,
  MIN_CONFIDENCE: 0.52,
  AMBIGUITY_MARGIN: 0.08,
  MIN_MATCHING_DESCRIPTORS: 2,
  STABILITY_FRAMES: 2,

  // Registration
  REQUIRED_CAPTURES: 5,
  CAPTURE_DIVERSITY_THRESHOLD: 0.15,
  MIN_ENROLL_QUALITY: 0.55,

  // Detection
  // scoreThreshold: how confident TinyFaceDetector must be to report a face.
  // Lower = detects faces more reliably in poor lighting / angles (does NOT affect matching accuracy).
  DETECTION_SCORE_THRESHOLD: 0.35,
  // inputSize: network resolution fed to TinyFaceDetector. Higher = better range but slower.
  // 416 is a good balance between detection reliability and performance.
  DETECTION_INPUT_SIZE: 416,
} as const;
