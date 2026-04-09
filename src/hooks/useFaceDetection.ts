import { useState, useCallback, useRef, useEffect } from 'react';
import { loadModels, detectFace, isModelsLoaded } from '@/lib/faceApi';
import type { FaceDetectionResult } from '@/lib/faceApi';

interface UseFaceDetectionOptions {
  onFaceDetected?: (result: FaceDetectionResult) => void;
  onNoFace?: () => void;
  detectionInterval?: number;
}

interface UseFaceDetectionReturn {
  isLoading: boolean;
  isDetecting: boolean;
  modelsReady: boolean;
  error: string | null;
  currentDetection: FaceDetectionResult | null;
  startDetection: (video: HTMLVideoElement) => void;
  stopDetection: () => void;
  detectOnce: (video: HTMLVideoElement) => Promise<FaceDetectionResult | null>;
}

export function useFaceDetection(options: UseFaceDetectionOptions = {}): UseFaceDetectionReturn {
  const { onFaceDetected, onNoFace, detectionInterval = 100 } = options;

  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDetection, setCurrentDetection] = useState<FaceDetectionResult | null>(null);

  const loopActiveRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load models on mount
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        await loadModels();
        setModelsReady(true);
      } catch (err) {
        setError('Failed to load face detection models');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const detectOnce = useCallback(async (video: HTMLVideoElement): Promise<FaceDetectionResult | null> => {
    if (!isModelsLoaded()) {
      await loadModels();
    }
    
    try {
      const result = await detectFace(video);
      setCurrentDetection(result);
      return result;
    } catch (err) {
      console.error('Detection error:', err);
      return null;
    }
  }, []);

  const startDetection = useCallback((video: HTMLVideoElement) => {
    if (!modelsReady) return;

    videoRef.current = video;
    setIsDetecting(true);
    loopActiveRef.current = true;

    // Sequential loop: detect → done → short pause → detect again.
    // Prevents overlapping calls when detectFace() takes longer than the interval.
    const loop = async () => {
      while (loopActiveRef.current) {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
          // Video not ready yet; wait and retry.
          await new Promise((r) => setTimeout(r, detectionInterval));
          continue;
        }

        try {
          const result = await detectFace(videoRef.current);
          // Guard: component may have unmounted or detection stopped during await
          if (!loopActiveRef.current) break;

          setCurrentDetection(result);

          if (result) {
            onFaceDetected?.(result);
          } else {
            onNoFace?.();
          }
        } catch (err) {
          console.error('Detection error:', err);
        }

        // Small pause between detection cycles to yield to the main thread.
        await new Promise((r) => setTimeout(r, detectionInterval));
      }
    };

    loop();
  }, [modelsReady, detectionInterval, onFaceDetected, onNoFace]);

  const stopDetection = useCallback(() => {
    loopActiveRef.current = false;
    videoRef.current = null;
    setIsDetecting(false);
    setCurrentDetection(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      loopActiveRef.current = false;
    };
  }, []);

  return {
    isLoading,
    isDetecting,
    modelsReady,
    error,
    currentDetection,
    startDetection,
    stopDetection,
    detectOnce,
  };
}
