import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScannerFrame } from '@/components/scanner/ScannerFrame';
import { useWebcam } from '@/hooks/useWebcam';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { findBestMatch, drawFaceBox } from '@/lib/faceApi';
import { FACE_CONFIG } from '@/lib/faceConfig';
import { playSuccessSoundByAction } from '@/lib/successSound';
import { cancelFailureSequence, playFailureThenFailedScanSound } from '@/lib/failureSound';
import { getAvatarUrl } from '@/lib/utils';
import { toast } from 'sonner';
import { studentService, type StudentWithFaceCredentials } from '@/services/student.service';
import { timelogService, type RawTimelog } from '@/services/timelog.service';
import {
  scannerService,
  type ScannerAttendancePayload,
  type ScannerTerminalDevice,
  type ScannerTerminalType,
} from '@/services/scanner.service';
import {
  Camera,
  CameraOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import verifiedGif from '@/assets/verified.gif';
import unverifyGif from '@/assets/unverify.gif';

export type TerminalType = ScannerTerminalType;

interface ScannerUser {
  id: string;
  name: string;
  student_id_number: string;
  department: string;
  image_url?: string | null;
}

interface PreviousScanItem {
  id: string;
  name: string;
  subtitle: string;
  type: 'check-in' | 'check-out';
  time: Date;
  image_url?: string | null;
}

const LAST_RECORDED_AVATAR_KEY = 'last-recorded';
type ScannerMode = 'AUTO' | 'TIME_IN' | 'TIME_OUT';
type ScannerFeedback = 'none' | 'verified' | 'unverified';

interface LastRecordedStudent {
  studentId: string;
  fullName: string;
  imageUrl: string | null;
  courseLabel: string;
  sectionLabel: string;
}

function buildLastRecordedStudentDisplay(
  studentRow: StudentWithFaceCredentials | undefined,
  fallbackUser: ScannerUser
): LastRecordedStudent {
  const fullName = studentRow
    ? [studentRow.first_name, studentRow.middle_name, studentRow.last_name].filter(Boolean).join(' ')
    : fallbackUser.name;
  const imageUrl = studentRow?.user_image_url ?? fallbackUser.image_url ?? null;
  const ce = studentRow?.current_enrollment;
  const courseLabel = ce?.course?.name?.trim() || ce?.course?.code?.trim() || '—';
  const sectionLabel = ce?.section
    ? ce.section.name?.trim() || ce.section.code?.trim() || '—'
    : '—';
  return {
    studentId: studentRow?.id ?? fallbackUser.id,
    fullName,
    imageUrl,
    courseLabel,
    sectionLabel,
  };
}

function buildScannerUsers(students: StudentWithFaceCredentials[]): ScannerUser[] {
  return students.map((emp) => ({
    id: emp.id,
    name: [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' '),
    student_id_number: emp.student_id_number,
    department: emp.department?.name ?? '',
    image_url: emp.user_image_url ?? null,
  }));
}

function getInitials(name: string): string {
  const [first = '', second = ''] = name.split(' ');
  return `${first.charAt(0)}${second.charAt(0)}`.trim().toUpperCase() || '?';
}

function parseDescriptorArrays(credentialData: string | Record<string, unknown>): Float32Array[] {
  try {
    const data =
      typeof credentialData === 'string'
        ? (JSON.parse(credentialData) as { descriptors?: number[][] })
        : (credentialData as { descriptors?: number[][] });
    const arr = data?.descriptors ?? [];
    if (!Array.isArray(arr)) return [];
    return arr.map((d) => (Array.isArray(d) ? new Float32Array(d) : new Float32Array(0))).filter((a) => a.length === 128);
  } catch {
    return [];
  }
}

function extractApiErrorMessage(error: unknown, fallback: string): string {
  const responseData =
    error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { data?: { error?: unknown; message?: unknown } } }).response?.data
      : undefined;

  if (typeof responseData?.error === 'string' && responseData.error.trim()) {
    return responseData.error;
  }

  if (typeof responseData?.message === 'string' && responseData.message.trim()) {
    return responseData.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function mapLogTypeToSuccessAction(logType: RawTimelog['log_type'] | undefined): 'check-in' | 'check-out' {
  return logType === 'TIME_IN' ? 'check-in' : 'check-out';
}

export interface FaceScannerTerminalProps {
  terminalType: TerminalType;
  title: string;
  subtitle: string;
  eventId?: string;
  onRecordAttendance: (payload: ScannerAttendancePayload) => Promise<RawTimelog>;
  /** Fires when terminal device context loads or fails (for page headers). */
  onTerminalContext?: (result: { device: ScannerTerminalDevice } | { error: string }) => void;
}

export function FaceScannerTerminal({
  terminalType,
  title,
  subtitle,
  eventId,
  onRecordAttendance,
  onTerminalContext,
}: FaceScannerTerminalProps) {
  const { videoRef, isActive, error: webcamError, startWebcam, stopWebcam } = useWebcam({ width: 1280, height: 720, frameRate: 30 });
  const { modelsReady, isLoading: modelsLoading, isDetecting, currentDetection, startDetection, stopDetection } = useFaceDetection();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [studentsWithFaces, setStudentsWithFaces] = useState<StudentWithFaceCredentials[]>([]);
  const [matchedUser, setMatchedUser] = useState<ScannerUser | null>(null);
  const [lastAction, setLastAction] = useState<'check-in' | 'check-out' | null>(null);
  const [scannerMode, setScannerMode] = useState<ScannerMode>('AUTO');
  const [confidence, setConfidence] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanCooldown, setScanCooldown] = useState(false);
  const [feedback, setFeedback] = useState<ScannerFeedback>('none');
  const [previousScans, setPreviousScans] = useState<PreviousScanItem[]>([]);
  const [lastRecordedStudent, setLastRecordedStudent] = useState<LastRecordedStudent | null>(null);
  const [avatarLoadErrors, setAvatarLoadErrors] = useState<Record<string, boolean>>({});
  const stabilityBufferRef = useRef<string[]>([]);
  const onTerminalContextRef = useRef(onTerminalContext);
  onTerminalContextRef.current = onTerminalContext;
  const [ambiguousMessage, setAmbiguousMessage] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [classContext, setClassContext] = useState<{
    assignment_id: string;
    section_id: string;
    subject_id: string;
    teacher_id: string;
  } | null>(null);
  const lastRecordErrorRef = useRef<{ message: string; at: number } | null>(null);
  const lastFailureFeedbackAtRef = useRef(0);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const users = useMemo(() => buildScannerUsers(studentsWithFaces), [studentsWithFaces]);

  const clearFeedbackTimeout = useCallback(() => {
    if (feedbackTimeoutRef.current != null) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
    cancelFailureSequence();
  }, []);

  const showVerifiedFeedback = useCallback(() => {
    clearFeedbackTimeout();
    setFeedback('verified');
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback('none');
      feedbackTimeoutRef.current = null;
    }, 3000);
  }, [clearFeedbackTimeout]);

  const showUnverifiedFeedback = useCallback(
    ({ throttleMs = 2200, withSound = true }: { throttleMs?: number; withSound?: boolean } = {}) => {
      const now = Date.now();
      if (now - lastFailureFeedbackAtRef.current < throttleMs) return;
      lastFailureFeedbackAtRef.current = now;

      clearFeedbackTimeout();
      setFeedback('unverified');

      const SAFETY_MS = 45_000;
      const endUnverifiedFeedback = () => {
        clearFeedbackTimeout();
        setFeedback('none');
      };

      if (withSound) {
        feedbackTimeoutRef.current = window.setTimeout(endUnverifiedFeedback, SAFETY_MS);
        playFailureThenFailedScanSound(endUnverifiedFeedback);
      } else {
        feedbackTimeoutRef.current = window.setTimeout(() => {
          setFeedback('none');
          feedbackTimeoutRef.current = null;
        }, 1500);
      }
    },
    [clearFeedbackTimeout]
  );

  useEffect(() => {
    return () => {
      clearFeedbackTimeout();
    };
  }, [clearFeedbackTimeout]);

  const storedDescriptors = useMemo(() => {
    const result: { userId: string; descriptors: Float32Array[] }[] = [];
    for (const emp of studentsWithFaces) {
      if (!emp.credentials?.length) continue;
      const allDescriptors: Float32Array[] = [];
      for (const cred of emp.credentials) {
        allDescriptors.push(...parseDescriptorArrays(cred.credential_data));
      }
      if (allDescriptors.length > 0) {
        result.push({ userId: String(emp.id), descriptors: allDescriptors });
      }
    }
    return result;
  }, [studentsWithFaces]);

  useEffect(() => {
    studentService.getStudentsWithFaceCredentials().then(setStudentsWithFaces);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setContextLoading(true);
    setContextError(null);
    setDeviceId(null);
    setClassContext(null);

    scannerService
      .getScannerContext(terminalType)
      .then((ctx) => {
        if (cancelled) return;
        setDeviceId(ctx.device.id);
        setClassContext(ctx.class_context ?? null);
        setContextLoading(false);
        onTerminalContextRef.current?.({ device: ctx.device });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = extractApiErrorMessage(err, 'Could not load terminal.');
        setContextError(message);
        setContextLoading(false);
        toast.error('Terminal unavailable', { description: message });
        onTerminalContextRef.current?.({ error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [terminalType]);

  const mapTimelogsToPreviousScans = useCallback((timelogs: RawTimelog[]) => {
    return timelogs.slice(0, 5).map((timelog) => {
      const fullName = [timelog.student?.first_name, timelog.student?.last_name].filter(Boolean).join(' ').trim();
      return {
        id: timelog.id,
        name: fullName || timelog.student_number || 'Unknown Student',
        subtitle: timelog.student_number || 'N/A',
        type: (timelog.log_type === 'TIME_IN' ? 'check-in' : 'check-out') as 'check-in' | 'check-out',
        time: new Date(timelog.log_datetime),
        image_url: timelog.student?.image_url ?? null,
      };
    });
  }, []);

  useEffect(() => {
    if (!deviceId) return;

    const loadPreviousScans = async () => {
      try {
        const timelogParams = terminalType === 'classroom'
          ? {
              classroom_scope: 'teacher' as const,
              section_id: classContext?.section_id,
              subject_id: classContext?.subject_id,
              limit: 5
            }
          : {
              device_id: deviceId,
              limit: 5
            };
        const timelogs = await timelogService.getTimelogs(timelogParams);
        setPreviousScans(mapTimelogsToPreviousScans(timelogs));
      } catch (error) {
        console.error('Failed to load previous scans:', error);
      }
    };
    loadPreviousScans();
  }, [deviceId, classContext, terminalType, mapTimelogsToPreviousScans]);

  useEffect(() => {
    if (!isActive || !modelsReady) return;
    if (isDetecting) return;

    const video = videoRef.current;
    if (!video) return;

    const start = () => startDetection(video);

    if (video.readyState >= 2 && video.videoWidth > 0) {
      start();
      return;
    }

    video.addEventListener('loadeddata', start, { once: true });
    return () => {
      video.removeEventListener('loadeddata', start);
    };
  }, [isActive, modelsReady, isDetecting, startDetection]);

  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !isActive) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.offsetWidth;
    canvas.height = video.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentDetection) {
      const color = matchedUser ? '#22c55e' : ambiguousMessage ? '#f97316' : '#eab308';
      const label = ambiguousMessage
        ? 'Not recognized clearly'
        : matchedUser
          ? matchedUser.name
          : 'Unknown';
      drawFaceBox(canvas, video, currentDetection.box, label, color);
    }
  }, [currentDetection, matchedUser, ambiguousMessage, isActive]);

  const handleFaceMatch = useCallback(async () => {
    if (
      !deviceId ||
      contextLoading ||
      contextError ||
      !currentDetection ||
      storedDescriptors.length === 0 ||
      users.length === 0 ||
      isProcessing ||
      scanCooldown
    )
      return;

    setIsProcessing(true);
    setAmbiguousMessage(false);

    try {
      const match = findBestMatch(currentDetection.descriptor, storedDescriptors, {
        threshold: FACE_CONFIG.MATCH_THRESHOLD,
        minConfidence: FACE_CONFIG.MIN_CONFIDENCE,
        ambiguityMargin: FACE_CONFIG.AMBIGUITY_MARGIN,
        minMatchingDescriptors: FACE_CONFIG.MIN_MATCHING_DESCRIPTORS,
      });

      if (match?.isAmbiguous) {
        setMatchedUser(null);
        setConfidence(0);
        stabilityBufferRef.current = [];
        setAmbiguousMessage(true);
        setIsProcessing(false);
        return;
      }

      if (match) {
        const user = users.find((u) => String(u.id) === match.userId);
        if (user) {
          setMatchedUser(user);
          setConfidence(match.confidence);

          const prev = stabilityBufferRef.current;
          const newBuffer = [...prev.slice(-(FACE_CONFIG.STABILITY_FRAMES - 1)), match.userId];
          stabilityBufferRef.current = newBuffer;

          const isStable =
            newBuffer.length >= FACE_CONFIG.STABILITY_FRAMES &&
            newBuffer.every((id) => id === match.userId);

          if (!isStable) {
            setIsProcessing(false);
            return;
          }

          const timelog = await onRecordAttendance({
            student_id: user.id,
            student_number: user.student_id_number,
            log_datetime: new Date().toISOString(),
            log_type: scannerMode,
            verification_method: 'FACE',
            verification_score: Math.round(match.confidence * 100) / 100,
            event_id: eventId,
          });

          const type = mapLogTypeToSuccessAction(timelog.log_type);
          setLastAction(type);

          const rosterRow = studentsWithFaces.find((s) => s.id === user.id);
          setLastRecordedStudent(buildLastRecordedStudentDisplay(rosterRow, user));

          try {
            const timelogParams = terminalType === 'classroom'
              ? {
                  classroom_scope: 'teacher' as const,
                  section_id: classContext?.section_id,
                  subject_id: classContext?.subject_id,
                  limit: 5
                }
              : {
                  device_id: deviceId,
                  limit: 5
                };
            const refreshed = await timelogService.getTimelogs(timelogParams);
            setPreviousScans(mapTimelogsToPreviousScans(refreshed));
          } catch {
            setPreviousScans((prev) => {
              const nextItem: PreviousScanItem = {
                id: timelog.id,
                name: user.name,
                subtitle: user.department || user.student_id_number,
                type,
                time: new Date(),
                image_url: user.image_url ?? null,
              };
              return [nextItem, ...prev].slice(0, 5);
            });
          }
          stabilityBufferRef.current = [];

          playSuccessSoundByAction(type);
          showVerifiedFeedback();

          toast.success(type === 'check-in' ? 'Checked In!' : 'Checked Out!', {
            description: `${user.name} - ${format(new Date(), 'h:mm a')}`,
          });

          setScanCooldown(true);
          setTimeout(() => {
            setScanCooldown(false);
            setMatchedUser(null);
            setLastAction(null);
          }, 3000);
        }
      } else {
        setMatchedUser(null);
        setConfidence(0);
        stabilityBufferRef.current = [];
      }
    } catch (error: unknown) {
      console.error('Match error:', error);
      const message = extractApiErrorMessage(error, 'Could not save attendance.');
      showUnverifiedFeedback({ throttleMs: 2500, withSound: true });
      const now = Date.now();
      const lastError = lastRecordErrorRef.current;
      const shouldNotify =
        !lastError ||
        lastError.message !== message ||
        now - lastError.at > 5000;
      if (shouldNotify) {
        toast.error('Recording failed', { description: message });
        lastRecordErrorRef.current = { message, at: now };
      }
    } finally {
      setIsProcessing(false);
    }
  }, [
    deviceId,
    contextLoading,
    contextError,
    currentDetection,
    storedDescriptors,
    users,
    isProcessing,
    scanCooldown,
    onRecordAttendance,
    scannerMode,
    eventId,
    classContext,
    terminalType,
    mapTimelogsToPreviousScans,
    studentsWithFaces,
    showUnverifiedFeedback,
    showVerifiedFeedback,
  ]);

  useEffect(() => {
    if (currentDetection && !scanCooldown) {
      handleFaceMatch();
    }
  }, [currentDetection, handleFaceMatch, scanCooldown]);

  const handleStart = async () => {
    await startWebcam();
  };

  const handleStop = () => {
    stopDetection();
    stopWebcam();
    setMatchedUser(null);
    setLastAction(null);
    stabilityBufferRef.current = [];
    setAmbiguousMessage(false);
    setFeedback('none');
    clearFeedbackTimeout();
  };

  const displayAction = lastAction;
  const displayIsCheckIn = displayAction === 'check-in';

  return (
    <div className="flex flex-col gap-4 xl:grid xl:grid-cols-12 xl:gap-6">
      <div className="w-full xl:col-span-7">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg md:text-xl">Camera Feed</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {contextLoading ? (
                <Badge variant="secondary" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Terminal…
                </Badge>
              ) : contextError ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  No terminal
                </Badge>
              ) : null}
              {modelsLoading ? (
                <Badge variant="secondary" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading models...
                </Badge>
              ) : modelsReady ? (
                <Badge variant="default" className="gap-1 bg-success">
                  <CheckCircle2 className="h-3 w-3" />
                  Ready
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Error
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mx-auto aspect-square w-full max-w-2xl overflow-hidden rounded-xl bg-muted sm:aspect-4/3 xl:max-w-3xl 2xl:max-w-208 shadow-[0_0_0_1px_oklch(0.72_0.19_145/18%),0_0_32px_oklch(0.72_0.19_145/8%)]">
              {webcamError ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center md:gap-4 md:p-8">
                  <CameraOff className="h-12 w-12 text-muted-foreground/30 md:h-16 md:w-16" />
                  <div>
                    <p className="font-medium text-destructive">Camera Error</p>
                    <p className="text-sm text-muted-foreground">{webcamError}</p>
                  </div>
                  <Button onClick={handleStart} variant="outline">
                    Try Again
                  </Button>
                </div>
              ) : !isActive ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center md:gap-4 md:p-8">
                  <Camera className="h-12 w-12 text-muted-foreground/30 md:h-16 md:w-16" />
                  <div>
                    <p className="font-medium">Camera is off</p>
                    <p className="text-sm text-muted-foreground">Click Start to begin scanning</p>
                  </div>
                </div>
              ) : (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                  <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
                  <ScannerFrame
                    isActive={isActive}
                    hasFace={!!currentDetection}
                    scanCooldown={scanCooldown}
                    status={
                      scanCooldown || matchedUser
                        ? 'matched'
                        : ambiguousMessage
                          ? 'ambiguous'
                          : 'scanning'
                    }
                    confidence={matchedUser ? confidence : undefined}
                  />
                  {feedback === 'verified' && matchedUser && lastAction && (
                    <div
                      className={`absolute inset-0 flex items-center justify-center ${
                        displayIsCheckIn ? 'bg-success/15' : 'bg-muted/15'
                      }`}
                    >
                      <div className="animate-success-pop rounded-xl bg-card/75 p-4 text-center shadow-2xl backdrop-blur-md sm:p-6 border border-white/10">
                        <img
                          src={verifiedGif}
                          alt=""
                          className="mx-auto h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32 lg:h-44 lg:w-44 2xl:h-52 2xl:w-52 object-contain"
                          draggable={false}
                        />
                        <p className="mt-2 text-base font-semibold sm:text-lg">{matchedUser.name}</p>
                        <Badge className={displayIsCheckIn ? 'bg-success' : ''}>
                          {displayIsCheckIn ? 'Checked In' : 'Checked Out'}
                        </Badge>
                      </div>
                    </div>
                  )}
                  {feedback === 'unverified' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/5">
                      <div className="animate-success-pop rounded-xl bg-card/50 p-4 text-center shadow-2xl backdrop-blur-md sm:p-6 border border-white/10">
                        <img
                          src={unverifyGif}
                          alt=""
                          className="mx-auto h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32 lg:h-44 lg:w-44 2xl:h-52 2xl:w-52 object-contain"
                          draggable={false}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-3 md:mt-4 md:gap-4">
              {isActive ? (
                <Button onClick={handleStop} variant="destructive" className="touch-target min-h-[44px]">
                  <CameraOff className="mr-2 h-4 w-4" />
                  Stop Camera
                </Button>
              ) : (
                <Button
                  onClick={handleStart}
                  disabled={!modelsReady || contextLoading || !!contextError}
                  className="touch-target min-h-[44px]"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Start Camera
                </Button>
              )}

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={scannerMode === 'AUTO' ? 'default' : 'outline'}
                  className="h-9"
                  aria-pressed={scannerMode === 'AUTO'}
                  onClick={() => setScannerMode('AUTO')}
                >
                  AUTO
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={scannerMode === 'TIME_IN' ? 'default' : 'outline'}
                  className="h-9"
                  aria-pressed={scannerMode === 'TIME_IN'}
                  onClick={() => setScannerMode('TIME_IN')}
                >
                  IN
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={scannerMode === 'TIME_OUT' ? 'default' : 'outline'}
                  className="h-9"
                  aria-pressed={scannerMode === 'TIME_OUT'}
                  onClick={() => setScannerMode('TIME_OUT')}
                >
                  OUT
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3 md:space-y-4 xl:col-span-5 xl:space-y-6">
        <Card className="border-primary/15">
          <CardHeader className="py-3 sm:py-4">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base">
              <span className={`block h-2 w-2 rounded-full ${isActive ? 'bg-success animate-pulse' : 'bg-muted-foreground/40'}`} />
              {title}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </CardHeader>
          <CardContent className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Camera</span>
              <Badge variant={isActive ? 'default' : 'secondary'} className="font-mono text-xs">
                {isActive ? 'ACTIVE' : 'OFFLINE'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Detection</span>
              <Badge variant={currentDetection ? 'default' : 'secondary'} className="font-mono text-xs">
                {currentDetection ? 'FACE FOUND' : 'NO FACE'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Mode</span>
              <Badge variant="secondary" className="font-mono text-xs">
                {scannerMode}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Enrolled</span>
              <span className="font-mono text-sm font-bold tabular-nums">{users.length}</span>
            </div>
            {confidence > 0 && matchedUser && (
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Confidence</span>
                <span className="font-mono text-sm font-bold text-success tabular-nums">{Math.round(confidence * 100)}%</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/15">
          <CardHeader className="py-3 sm:py-4">
            <CardTitle className="text-sm md:text-base">Last scanned student</CardTitle>
            <p className="text-xs text-muted-foreground">Most recent successful attendance record</p>
          </CardHeader>
          <CardContent>
            {!lastRecordedStudent ? (
              <p className="text-sm text-muted-foreground">Scan a student to see details here.</p>
            ) : (
              <div className="flex items-start gap-3 md:gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted md:h-20 md:w-20">
                  {lastRecordedStudent.imageUrl && !avatarLoadErrors[LAST_RECORDED_AVATAR_KEY] ? (
                    <img
                      src={getAvatarUrl(lastRecordedStudent.imageUrl)}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={() =>
                        setAvatarLoadErrors((prev) => ({ ...prev, [LAST_RECORDED_AVATAR_KEY]: true }))
                      }
                    />
                  ) : (
                    <span className="text-lg font-medium md:text-xl">
                      {getInitials(lastRecordedStudent.fullName)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-semibold leading-tight md:text-lg">{lastRecordedStudent.fullName}</p>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Section</p>
                    <p className="text-sm text-foreground">{lastRecordedStudent.sectionLabel}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Course</p>
                    <p className="text-sm text-foreground">{lastRecordedStudent.courseLabel}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Previous Scans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {previousScans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scans yet.</p>
            ) : (
              previousScans.map((scan) => (
                <div key={scan.id} className="flex items-center gap-3 md:gap-4">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-muted md:h-14 md:w-14">
                    {scan.image_url && !avatarLoadErrors[scan.id] ? (
                      <img
                        src={getAvatarUrl(scan.image_url)}
                        alt={scan.name}
                        className="h-full w-full object-cover"
                        onError={() => setAvatarLoadErrors((prev) => ({ ...prev, [scan.id]: true }))}
                      />
                    ) : (
                      <span>{getInitials(scan.name)}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{scan.name}</p>
                    <p className="text-sm text-muted-foreground">{scan.subtitle}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge className={scan.type === 'check-in' ? 'bg-success' : ''}>
                        {scan.type === 'check-in' ? 'In' : 'Out'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{format(scan.time, 'h:mm a')}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {users.length === 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 text-warning" />
                <div>
                  <p className="font-medium text-warning">No Users Registered</p>
                  <p className="text-sm text-muted-foreground">
                    Register users first before scanning for attendance.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
