import { useState, useRef, useCallback, useEffect } from 'react';

interface UseWebcamOptions {
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
  frameRate?: number;
}

interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  isActive: boolean;
  error: string | null;
  startWebcam: () => Promise<void>;
  stopWebcam: () => void;
}

export function useWebcam(options: UseWebcamOptions = {}): UseWebcamReturn {
  const { width = 640, height = 480, facingMode = 'user', frameRate = 30 } = options;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ensure the stream is attached whenever either changes.
  // This fixes cases where the <video> element is conditionally rendered
  // (so it may not exist yet when startWebcam() resolves).
  useEffect(() => {
    if (!stream || !videoRef.current) return;

    videoRef.current.srcObject = stream;
    videoRef.current.play().catch((err) => {
      // Autoplay policies or transient readiness issues can cause play() to reject.
      // The user gesture (Start Camera) typically makes this succeed.
      console.warn('Video play() failed:', err);
    });
  }, [stream]);

  const startWebcam = useCallback(async () => {
    try {
      setError(null);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: width },
          height: { ideal: height },
          facingMode,
          frameRate: { ideal: frameRate },
          // Hint to browsers that support these advanced constraints.
          // (Unsupported keys are safely ignored.)
          advanced: [
            { focusMode: 'continuous' as unknown as string },
            { exposureMode: 'continuous' as unknown as string },
            { whiteBalanceMode: 'continuous' as unknown as string },
          ] as unknown as MediaTrackConstraintSet[],
        },
        audio: false,
      });

      setStream(mediaStream);
      setIsActive(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access webcam';
      setError(message);
      console.error('Webcam error:', err);
    }
  }, [width, height, facingMode, frameRate]);

  const stopWebcam = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsActive(false);
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return {
    videoRef,
    stream,
    isActive,
    error,
    startWebcam,
    stopWebcam,
  };
}
