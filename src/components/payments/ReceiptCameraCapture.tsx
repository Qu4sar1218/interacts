import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CameraIcon, RefreshCwIcon, CheckIcon, VideoOffIcon, Loader2Icon } from 'lucide-react';

type CameraState = 'idle' | 'streaming' | 'captured' | 'error';

interface Props {
  onCapture: (blob: Blob) => void;
  onClear: () => void;
  disabled?: boolean;
}

export function ReceiptCameraCapture({ onCapture, onClear, disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Attach stream to the <video> element whenever the stream changes.
  // This handles the conditional-render race: the <video> is only in the DOM
  // once cameraState === 'streaming', so videoRef.current is null at the
  // moment getUserMedia resolves. Using state + effect (same pattern as
  // useWebcam.ts) ensures assignment happens after the element mounts.
  useEffect(() => {
    if (!stream || !videoRef.current) return;

    const video = videoRef.current;
    setIsVideoReady(false);
    video.srcObject = stream;
    video.play().catch((err) => console.warn('Video play() failed:', err));

    // Only enable Capture once the browser has decoded the first frame.
    // Without this guard, drawImage() can run against an empty/black frame.
    const markReady = () => setIsVideoReady(true);
    if (video.readyState >= 2 && video.videoWidth > 0) {
      markReady();
    } else {
      video.addEventListener('loadeddata', markReady, { once: true });
      video.addEventListener('playing', markReady, { once: true });
    }

    return () => {
      video.removeEventListener('loadeddata', markReady);
      video.removeEventListener('playing', markReady);
    };
  }, [stream]);

  const startCamera = useCallback(async () => {
    setErrorMessage(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      setStream(mediaStream);
      setCameraState('streaming');
    } catch (err: unknown) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access in your browser settings.'
          : err instanceof DOMException && err.name === 'NotFoundError'
            ? 'No camera found on this device.'
            : 'Could not access the camera. Make sure you are on a secure (HTTPS) connection.';
      setErrorMessage(message);
      setCameraState('error');
    }
  }, []);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Safety guard: abort if the video hasn't decoded a real frame yet.
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stream?.getTracks().forEach((t) => t.stop());
        setStream(null);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setCameraState('captured');
        onCapture(blob);
      },
      'image/jpeg',
      0.85,
    );
  }, [stream, onCapture]);

  const handleRecapture = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setIsVideoReady(false);
    onClear();
    startCamera();
  }, [previewUrl, onClear, startCamera]);

  if (cameraState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 sm:p-8">
        <CameraIcon className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">
          Take a photo of your receipt using your device camera.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={startCamera} disabled={disabled}>
          <CameraIcon className="mr-2 h-4 w-4" />
          Open camera
        </Button>
      </div>
    );
  }

  if (cameraState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-destructive/40 bg-destructive/5 p-6 sm:p-8">
        <VideoOffIcon className="h-10 w-10 text-destructive" />
        <p className="text-sm text-destructive text-center max-w-xs">{errorMessage}</p>
        <Button type="button" variant="outline" size="sm" onClick={startCamera}>
          <RefreshCwIcon className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (cameraState === 'captured' && previewUrl) {
    return (
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-lg border bg-muted">
          <img src={previewUrl} alt="Captured receipt" className="w-full object-contain max-h-[400px]" />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleRecapture} disabled={disabled}>
            <RefreshCwIcon className="mr-2 h-4 w-4" />
            Recapture
          </Button>
          <Button type="button" variant="default" size="sm" disabled className="pointer-events-none">
            <CheckIcon className="mr-2 h-4 w-4" />
            Photo ready
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full max-h-[400px] object-contain"
        />
        {!isVideoReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-2 text-white">
              <Loader2Icon className="h-6 w-6 animate-spin" />
              <span className="text-xs">Starting camera…</span>
            </div>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <Button
        type="button"
        size="sm"
        onClick={handleCapture}
        disabled={disabled || !isVideoReady}
      >
        {isVideoReady ? (
          <>
            <CameraIcon className="mr-2 h-4 w-4" />
            Capture
          </>
        ) : (
          <>
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            Starting camera…
          </>
        )}
      </Button>
    </div>
  );
}
