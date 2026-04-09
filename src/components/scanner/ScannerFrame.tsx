import { cn } from '@/lib/utils';

interface ScannerFrameProps {
  /** Show frame and scan effects when camera is active */
  isActive: boolean;
  /** Face is currently detected */
  hasFace?: boolean;
  /** Cooldown after successful scan */
  scanCooldown?: boolean;
  /** Current scanner state — drives color-coding */
  status?: 'scanning' | 'matched' | 'ambiguous';
  /** Confidence 0-1 when matched */
  confidence?: number;
  /** 'scanner' for attendance, 'register' for enrollment */
  mode?: 'scanner' | 'register';
  /** Overrides the default idle guidance text */
  guidanceText?: string;
  /** Capture progress for register mode */
  captureCount?: number;
  totalCaptures?: number;
  className?: string;
}

/**
 * Techy biometric HUD overlay — sits on top of video + canvas.
 * Layers (bottom → top):
 *   1. Vignette (edge darkening)
 *   2. Face guide oval (biometric targeting ellipse)
 *   3. Pulsing ring (face detected)
 *   4. Corner brackets (glow state-aware)
 *   5. Scan line (while scanning)
 *   6. Top HUD bar (mode + REC blinker)
 *   7. Status badge (bottom-center)
 */
export function ScannerFrame({
  isActive,
  hasFace = false,
  scanCooldown = false,
  status = 'scanning',
  confidence,
  mode = 'scanner',
  guidanceText,
  captureCount,
  totalCaptures,
  className,
}: ScannerFrameProps) {
  if (!isActive) return null;

  const isMatched = status === 'matched' || scanCooldown;
  const isAmbiguous = status === 'ambiguous';

  const cornerClass = isMatched
    ? 'scanner-corner-matched'
    : isAmbiguous
      ? 'scanner-corner-ambiguous'
      : hasFace
        ? 'scanner-corner-active'
        : '';

  return (
    <div className={cn('absolute inset-0 pointer-events-none select-none overflow-hidden', className)}>
      {/* 1. Vignette — edges dark, centre clear */}
      <div className="scanner-vignette absolute inset-0" aria-hidden />

      {/* 2. Face guide oval — biometric targeting ellipse */}
      <div
        className={cn(
          'scanner-face-oval absolute border-2 border-dashed rounded-full transition-all duration-500',
          isMatched
            ? 'border-success/85 scanner-face-oval-locked animate-face-oval-lock'
            : isAmbiguous
              ? 'border-warning/65'
              : hasFace
                ? 'border-primary/75 animate-face-oval-pulse'
                : 'border-white/15',
        )}
        aria-hidden
      />

      {/* 3. Pulsing ring — only when face is detected and not yet matched/cooldown */}
      {hasFace && !isMatched && !isAmbiguous && (
        <div
          className="absolute inset-[13%] rounded-full border border-primary/22 animate-face-detected"
          aria-hidden
        />
      )}

      {/* 4. Corner brackets */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
        <div
          key={pos}
          className={cn(
            `scanner-corner scanner-corner-${pos} animate-corner-pulse`,
            cornerClass,
            isMatched && 'opacity-60',
          )}
          aria-hidden
        />
      ))}

      {/* 5. Scan line — sweeps while active, hidden during cooldown */}
      {!scanCooldown && (
        <div className="scanner-scan-line" aria-hidden />
      )}

      {/* 6. Top HUD bar */}
      <div
        className="absolute top-2.5 left-3 right-3 flex items-center justify-between sm:top-3 sm:left-4 sm:right-4"
        aria-hidden
      >
        <span className="scanner-hud-text">
          {mode === 'register' ? 'ENROLL MODE' : 'SCAN MODE'}
        </span>
        <span className="scanner-hud-text scanner-hud-blink">● REC</span>
      </div>

      {/* 7. Status badge — bottom-centre HUD pill */}
      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 sm:bottom-4"
        aria-live="polite"
      >
        <div
          className={cn(
            'scanner-status-badge',
            isMatched
              ? 'scanner-status-matched'
              : isAmbiguous
                ? 'scanner-status-ambiguous'
                : hasFace
                  ? 'scanner-status-detecting'
                  : 'scanner-status-idle',
          )}
        >
          {isMatched ? (
            <span className="flex items-center gap-1.5">
              <span className="block h-1.5 w-1.5 shrink-0 rounded-full bg-success animate-pulse" />
              {confidence != null ? `${Math.round(confidence * 100)}% MATCH` : 'FACE LOCKED'}
            </span>
          ) : isAmbiguous ? (
            <span className="flex items-center gap-1.5">
              <span className="block h-1.5 w-1.5 shrink-0 rounded-full bg-warning animate-pulse" />
              AMBIGUOUS — RESCAN
            </span>
          ) : hasFace ? (
            <span className="flex items-center gap-1.5">
              <span className="block h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-pulse" />
              {mode === 'register' && captureCount != null && totalCaptures != null
                ? `${captureCount}/${totalCaptures} CAPTURED`
                : 'ANALYZING...'}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/45" />
              <span className={mode === 'register' ? 'text-destructive' : undefined}>
                {guidanceText
                  ? guidanceText.toUpperCase()
                  : mode === 'register'
                    ? 'POSITION FACE IN OVAL'
                    : 'SCANNING FOR FACE'}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
