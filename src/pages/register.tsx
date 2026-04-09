import { useState, useRef, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWebcam } from '@/hooks/useWebcam';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { assessFaceCaptureQuality, captureFaceThumbnail, drawFaceBox, isCaptureDistinct } from '@/lib/faceApi';
import { ScannerFrame } from '@/components/scanner/ScannerFrame';
import { FACE_CONFIG } from '@/lib/faceConfig';
import { playInstructionLoopSound, stopInstructionLoopSound } from '@/lib/instructionLoopSound';
import { playSuccessSound } from '@/lib/successSound';
import { toast } from 'sonner';
import lookStraightAtCameraSoundUrl from '@/assets/sounds/look-at-straight-at-the-camera.mp3';
import turnHeadLeftSoundUrl from '@/assets/sounds/turn-your-head-slightly-left.mp3';
import turnHeadRightSoundUrl from '@/assets/sounds/turn-your-head-slightly-right.mp3';
import tiltHeadUpSoundUrl from '@/assets/sounds/tilt-your-head-up-slightly.mp3';
import smileNaturallySoundUrl from '@/assets/sounds/smile-naturally.mp3';
import {
  studentService,
  type BackendStudent,
  type StudentWithFaceCredentials,
} from '@/services/student.service';
import { sectionService, type Section } from '@/services/section.service';
import {
  Camera,
  CameraOff,
  UserPlus,
  Users,
  UserCircle2,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
  UserRoundCog,
  X,
} from 'lucide-react';

const REQUIRED_CAPTURES = FACE_CONFIG.REQUIRED_CAPTURES;

const CAPTURE_GUIDANCE: string[] = [
  'Look straight at the camera',
  'Turn your head slightly left',
  'Turn your head slightly right',
  'Tilt your head up slightly',
  'Smile naturally',
];
const CAPTURE_GUIDANCE_AUDIO: string[] = [
  lookStraightAtCameraSoundUrl,
  turnHeadLeftSoundUrl,
  turnHeadRightSoundUrl,
  tiltHeadUpSoundUrl,
  smileNaturallySoundUrl,
];

function fullName(emp: BackendStudent): string {
  const parts = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean);
  return parts.join(' ');
}

export default function Register() {
  // Use a higher-res stream for enrollment so live frames are readable and descriptors are more stable.
  const { videoRef, isActive, error: webcamError, startWebcam, stopWebcam } = useWebcam({ width: 1280, height: 720, frameRate: 30 });
  const { modelsReady, isLoading: modelsLoading, isDetecting, currentDetection, startDetection, stopDetection, detectOnce } = useFaceDetection();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eligibleFetchSeqRef = useRef(0);

  const [students, setStudents] = useState<BackendStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentQuery, setStudentQuery] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState('all');
  const [capturedDescriptors, setCapturedDescriptors] = useState<Float32Array[]>([]);
  const [capturedQualityScores, setCapturedQualityScores] = useState<number[]>([]);
  const [faceImage, setFaceImage] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'registration' | 'registered'>('registration');
  const [registeredStudents, setRegisteredStudents] = useState<StudentWithFaceCredentials[]>([]);
  const [registeredLoading, setRegisteredLoading] = useState(false);
  const [registeredError, setRegisteredError] = useState<string | null>(null);
  const [hasLoadedRegistered, setHasLoadedRegistered] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<'new' | 'reregister'>('new');
  const [recaptureStudentName, setRecaptureStudentName] = useState<string>('');
  const [confirmRecaptureStudent, setConfirmRecaptureStudent] = useState<StudentWithFaceCredentials | null>(null);
  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState<StudentWithFaceCredentials | null>(null);
  const [isMutatingRegistered, setIsMutatingRegistered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSectionsLoading(true);
    sectionService
      .getSections({ active: true })
      .then((list) => {
        if (cancelled) return;
        setSections(
          [...list].sort((a, b) =>
            `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`)
          )
        );
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load sections:', error);
        toast.error('Failed to load sections', { description: 'Please try again.' });
      })
      .finally(() => {
        if (cancelled) return;
        setSectionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (registrationMode !== 'new') return;
    let cancelled = false;
    const requestSeq = ++eligibleFetchSeqRef.current;
    setStudentsLoading(true);
    setStudents([]);
    studentService
      .getEligibleStudentsForFace({ sectionId: selectedSectionId })
      .then((list) => {
        if (cancelled) return;
        if (requestSeq !== eligibleFetchSeqRef.current) return;
        setStudents(list.filter((e) => e.is_active));
      })
      .catch((error) => {
        if (cancelled) return;
        if (requestSeq !== eligibleFetchSeqRef.current) return;
        console.error('Failed to load eligible students:', error);
        toast.error('Failed to load students', { description: 'Please try again.' });
      })
      .finally(() => {
        if (cancelled) return;
        if (requestSeq !== eligibleFetchSeqRef.current) return;
        setStudentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [registrationMode, selectedSectionId]);

  const fetchRegisteredStudents = async () => {
    setRegisteredLoading(true);
    setRegisteredError(null);
    try {
      const data = await studentService.getStudentsWithFaceCredentials();
      setRegisteredStudents(data);
      setHasLoadedRegistered(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load registered faces.';
      setRegisteredError(message);
    } finally {
      setRegisteredLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'registered' && !hasLoadedRegistered && !registeredLoading) {
      fetchRegisteredStudents();
    }
  }, [activeTab, hasLoadedRegistered, registeredLoading]);

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
      const isCaptured = capturedDescriptors.length >= REQUIRED_CAPTURES;
      drawFaceBox(canvas, video, currentDetection.box, undefined, isCaptured ? '#22c55e' : '#3b82f6');
    }
  }, [currentDetection, capturedDescriptors.length, isActive]);

  useEffect(() => {
    if (!isActive || !modelsReady || isDetecting) return;
    const video = videoRef.current;
    if (!video) return;
    const start = () => startDetection(video);
    if (video.readyState >= 2 && video.videoWidth > 0) {
      start();
      return;
    }
    video.addEventListener('loadeddata', start, { once: true });
    return () => video.removeEventListener('loadeddata', start);
  }, [isActive, modelsReady, isDetecting, startDetection]);

  useEffect(() => {
    const canPlayLoop =
      activeTab === 'registration' &&
      isActive &&
      !!selectedStudentId &&
      !isSaving &&
      capturedDescriptors.length < REQUIRED_CAPTURES;

    if (!canPlayLoop) {
      stopInstructionLoopSound();
      return;
    }

    const instructionAudioUrl = CAPTURE_GUIDANCE_AUDIO[capturedDescriptors.length];
    if (!instructionAudioUrl) {
      stopInstructionLoopSound();
      return;
    }

    playInstructionLoopSound(instructionAudioUrl);
  }, [activeTab, isActive, selectedStudentId, registrationMode, isSaving, capturedDescriptors.length]);

  useEffect(() => {
    return () => {
      stopInstructionLoopSound();
    };
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setIsCapturing(true);
    try {
      const detection = await detectOnce(videoRef.current);
      if (detection) {
        const quality = assessFaceCaptureQuality(videoRef.current, detection.box);
        if (quality.score < FACE_CONFIG.MIN_ENROLL_QUALITY) {
          toast.error('Low capture quality', {
            description:
              quality.reasons.length > 0
                ? quality.reasons.join(' • ')
                : 'Please improve lighting and hold still, then try again.',
          });
          setIsCapturing(false);
          return;
        }

        const existingDescriptors = capturedDescriptors.map((d) =>
          d instanceof Float32Array ? d : Float32Array.from(d as unknown as ArrayLike<number>)
        );
        const isDistinct = isCaptureDistinct(
          detection.descriptor,
          existingDescriptors,
          FACE_CONFIG.CAPTURE_DIVERSITY_THRESHOLD
        );
        if (!isDistinct && existingDescriptors.length > 0) {
          toast.error('Capture too similar', {
            description:
              'Move your head to a different angle or expression, then capture again.',
          });
          setIsCapturing(false);
          return;
        }
        setCapturedDescriptors((prev) => [...prev, detection.descriptor]);
        setCapturedQualityScores((prev) => [...prev, Math.round(quality.score * 100) / 100]);
        if (capturedDescriptors.length === 0) {
          const thumbnail = captureFaceThumbnail(videoRef.current!, detection.box);
          setFaceImage(thumbnail);
        }
        const nextIndex = capturedDescriptors.length + 1;
        playSuccessSound();
        toast.success(`Capture ${nextIndex}/${REQUIRED_CAPTURES}`, {
          description:
            nextIndex < REQUIRED_CAPTURES
              ? (CAPTURE_GUIDANCE[nextIndex] ?? 'Face captured.')
              : 'Face captured successfully.',
        });
      } else {
        toast.error('No face detected', {
          description: 'Please position your face in the camera.',
        });
      }
    } catch (error) {
      console.error('Capture error:', error);
      toast.error('Capture failed', { description: 'Please try again.' });
    } finally {
      setIsCapturing(false);
    }
  };

  const handleReset = () => {
    stopInstructionLoopSound();
    setCapturedDescriptors([]);
    setCapturedQualityScores([]);
    setFaceImage('');
  };

  const beginRecapture = (student: StudentWithFaceCredentials) => {
    setRegistrationMode('reregister');
    setRecaptureStudentName(fullName(student));
    setSelectedStudentId(student.id);
    setStudentQuery('');
    setStudents([
      {
        id: student.id,
        student_id_number: student.student_id_number,
        school_id: student.school_id ?? null,
        department_id: student.department_id ?? null,
        first_name: student.first_name,
        middle_name: student.middle_name,
        last_name: student.last_name,
        email: student.email ?? null,
        is_active: student.is_active,
        status: student.status,
        enrolledDate: student.enrolledDate,
        user_image_url: student.user_image_url ?? null,
        school: student.school ?? null,
        department: student.department ?? null,
      },
    ]);
    handleReset();
    setActiveTab('registration');
    toast.message('Re-capture started', {
      description: `Capture a new face profile for ${fullName(student)}. Submitting will replace previous credentials.`,
    });
  };

  const handleDeleteRegisteredFace = async (student: StudentWithFaceCredentials) => {
    if (!student.credentials.length) return;
    setIsMutatingRegistered(true);
    try {
      await Promise.all(
        student.credentials.map((credential) =>
          studentService.deleteCredential(student.id, credential.id)
        )
      );
      toast.success('Registered face removed', {
        description: `${fullName(student)} can now be captured again.`,
      });
      await fetchRegisteredStudents();
      if (selectedStudentId === student.id && registrationMode === 'reregister') {
        setRegistrationMode('new');
        setRecaptureStudentName('');
        setSelectedStudentId('');
        handleReset();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete credentials.';
      toast.error('Delete failed', { description: message });
    } finally {
      setIsMutatingRegistered(false);
      setConfirmDeleteStudent(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedStudentId) {
      toast.error('Select student', {
        description: 'Please select a student to register.',
      });
      return;
    }
    if (capturedDescriptors.length < REQUIRED_CAPTURES) {
      toast.error('Insufficient captures', {
        description: `Please capture at least ${REQUIRED_CAPTURES} face images.`,
      });
      return;
    }
    const studentId = selectedStudentId;
    setIsSaving(true);
    try {
      const descriptors = capturedDescriptors.map((d) => Array.from(d));
      let thumbnail: Blob | undefined;
      if (faceImage) {
        const res = await fetch(faceImage);
        thumbnail = await res.blob();
      }
      if (registrationMode === 'reregister') {
        await studentService.replaceFaceCredential(studentId, {
          descriptors,
          quality_scores: capturedQualityScores,
          thumbnail,
        });
      } else {
        await studentService.enrollFaceCredential(studentId, {
          descriptors,
          quality_scores: capturedQualityScores,
          thumbnail,
        });
      }
      const emp = students.find((e) => e.id === studentId);
      playSuccessSound();
      if (registrationMode === 'reregister') {
        toast.success('Face re-registered', {
          description: recaptureStudentName
            ? `${recaptureStudentName}'s previous credential was replaced.`
            : 'Previous credentials were replaced with this capture.',
        });
      } else {
        toast.success('Face registered', {
          description: emp
            ? `${fullName(emp)} has been enrolled for face recognition.`
            : 'Enrollment successful.',
        });
      }
      setSelectedStudentId('');
      setCapturedDescriptors([]);
      setCapturedQualityScores([]);
      setFaceImage('');
      setRegistrationMode('new');
      setRecaptureStudentName('');
      handleStop();
      if (registrationMode === 'new') {
        setStudentQuery('');
        const eligible = await studentService.getEligibleStudentsForFace({ sectionId: selectedSectionId });
        setStudents(eligible.filter((e) => e.is_active));
      }
      await fetchRegisteredStudents();
      setActiveTab('registered');
    } catch (error) {
      console.error('Registration error:', error);
      const msg = error instanceof Error ? error.message : 'An error occurred. Please try again.';
      toast.error('Registration failed', { description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const visibleStudents = students.filter((s) => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      s.student_id_number,
      s.first_name,
      s.middle_name ?? '',
      s.last_name,
      s.department?.name ?? '',
      s.school?.name ?? ''
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  useEffect(() => {
    if (registrationMode !== 'new') return;
    if (!selectedStudentId) return;
    const existsInVisibleList = visibleStudents.some((s) => s.id === selectedStudentId);
    if (!existsInVisibleList) {
      setSelectedStudentId('');
    }
  }, [registrationMode, selectedStudentId, visibleStudents]);

  const handleStart = async () => {
    await startWebcam();
  };

  const handleStop = () => {
    stopInstructionLoopSound();
    stopDetection();
    stopWebcam();
  };

  const captureProgress = (capturedDescriptors.length / REQUIRED_CAPTURES) * 100;
  const isReadyToSubmit = capturedDescriptors.length >= REQUIRED_CAPTURES;

  return (
    <MainLayout>
      <div className="section-spacing">
        <div className="space-y-3">
          <h1 className="page-header">Register Student Face</h1>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'registration' | 'registered')}
          defaultValue="registration"
          className="space-y-4 md:space-y-6"
        >
          <TabsList className="h-auto w-full rounded-xl border border-primary/20 bg-card/60 p-1 backdrop-blur-sm sm:w-auto">
            <TabsTrigger
              value="registration"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Face Registration
            </TabsTrigger>
            <TabsTrigger
              value="registered"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Registered Student Face
            </TabsTrigger>
          </TabsList>

          <TabsContent value="registration" className="mt-0">
            <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
              <Card>
            <CardHeader>
              <CardTitle>Student</CardTitle>
              <CardDescription>
                {registrationMode === 'reregister'
                  ? `Re-capturing face data for ${recaptureStudentName || 'selected student'}`
                  : 'Select a student to enroll face data'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4">
              {registrationMode === 'reregister' && (
                <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
                  Re-register mode is active. Submitting new captures will replace old face credentials.
                </div>
              )}
              {registrationMode === 'new' && (
                <div className="space-y-1.5 md:space-y-2">
                  <Label>Section</Label>
                  <Select
                    value={selectedSectionId}
                    onValueChange={(value) => {
                      setSelectedSectionId(value);
                      setSelectedStudentId('');
                    }}
                    disabled={studentsLoading || sectionsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All sections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sections</SelectItem>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.code} - {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5 md:space-y-2">
                <Label>Student *</Label>
                <Select
                  value={selectedStudentId}
                  onValueChange={setSelectedStudentId}
                  disabled={studentsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={studentsLoading ? 'Loading...' : 'Select student'} />
                  </SelectTrigger>
                  <SelectContent>
                    {registrationMode === 'new' && (
                      <div
                        className="sticky top-0 z-10 border-b bg-popover p-2"
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Input
                          value={studentQuery}
                          onChange={(e) => setStudentQuery(e.target.value)}
                          placeholder="Search student (ID or name)"
                          disabled={studentsLoading}
                        />
                      </div>
                    )}
                    {visibleStudents.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.student_id_number} – {fullName(emp)}
                        {emp.department?.name ? ` (${emp.department.name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!studentsLoading && registrationMode === 'new' && visibleStudents.length === 0 && (
                  <p className="text-xs text-muted-foreground">No enrolled, unregistered students found.</p>
                )}
              </div>

              <div className="rounded-lg border p-3 md:p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Face Captures</span>
                  <Badge variant={isReadyToSubmit ? 'default' : 'secondary'}>
                    {capturedDescriptors.length}/{REQUIRED_CAPTURES}
                  </Badge>
                </div>
                <Progress value={captureProgress} className="h-2" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {isReadyToSubmit ? 'Ready to register!' : `Capture ${REQUIRED_CAPTURES - capturedDescriptors.length} more face image(s)`}
                </p>
              </div>

              {faceImage && (
                <div className="flex items-center gap-3 rounded-lg border p-3 md:gap-4 md:p-4">
                  <img src={faceImage} alt="Face preview" className="h-14 w-14 rounded-full object-cover md:h-16 md:w-16" />
                  <div>
                    <p className="text-sm font-medium">Face captured</p>
                    <p className="text-xs text-muted-foreground">Profile thumbnail</p>
                  </div>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={!isReadyToSubmit || !selectedStudentId || isSaving}
                className="w-full"
                size="lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {registrationMode === 'reregister' ? 'Replacing...' : 'Registering...'}
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {registrationMode === 'reregister' ? 'Replace Face Credential' : 'Register Face'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Face Capture</CardTitle>
                <CardDescription>Capture multiple angles for better accuracy</CardDescription>
              </div>
              {modelsLoading ? (
                <Badge variant="secondary" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </Badge>
              ) : modelsReady ? (
                <Badge variant="default" className="gap-1 bg-success">
                  <CheckCircle2 className="h-3 w-3" />
                  Ready
                </Badge>
              ) : (
                <Badge variant="destructive">Error</Badge>
              )}
            </CardHeader>
            <CardContent>
                {/* Square on mobile → 4:3 on sm+ → better face framing */}
                <div className="relative aspect-square overflow-hidden rounded-xl bg-muted sm:aspect-4/3 shadow-[0_0_0_1px_oklch(0.72_0.19_145/18%),0_0_32px_oklch(0.72_0.19_145/8%)]">
                {webcamError ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                    <CameraOff className="h-16 w-16 text-muted-foreground/30" />
                    <p className="font-medium text-destructive">Camera Error</p>
                    <p className="text-sm text-muted-foreground">{webcamError}</p>
                    <Button onClick={handleStart} variant="outline">Try Again</Button>
                  </div>
                ) : !isActive ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                    <Camera className="h-16 w-16 text-muted-foreground/30" />
                    <p className="font-medium">Camera is off</p>
                    <p className="text-sm text-muted-foreground">Start the camera to capture face</p>
                  </div>
                ) : (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                    <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
                    <ScannerFrame
                      isActive={isActive}
                      hasFace={!!currentDetection}
                      mode="register"
                      captureCount={capturedDescriptors.length}
                      totalCaptures={REQUIRED_CAPTURES}
                      className="[&_.scanner-status-badge]:text-sm sm:[&_.scanner-status-badge]:text-base [&_.scanner-status-badge]:font-semibold [&_.scanner-status-badge]:tracking-wide [&_.scanner-status-idle]:bg-background/90 [&_.scanner-status-idle]:text-foreground [&_.scanner-status-idle]:border [&_.scanner-status-idle]:border-primary/45 [&_.scanner-status-idle]:shadow-lg"
                      guidanceText={
                        capturedDescriptors.length >= REQUIRED_CAPTURES
                          ? 'ALL CAPTURES COMPLETE'
                          : CAPTURE_GUIDANCE[capturedDescriptors.length]
                      }
                    />
                  </>
                )}
              </div>
                <div className="mt-3 flex flex-wrap justify-center gap-3 md:mt-4 md:gap-4">
                {isActive ? (
                  <>
                    <Button onClick={handleCapture} disabled={!isActive || isCapturing || isReadyToSubmit} size="lg">
                      {isCapturing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Capturing...</> : <><Camera className="mr-2 h-4 w-4" />Capture ({capturedDescriptors.length}/{REQUIRED_CAPTURES})</>}
                    </Button>
                    {capturedDescriptors.length > 0 && (
                      <Button onClick={handleReset} variant="outline" size="lg">
                        <RefreshCw className="mr-2 h-4 w-4" />Reset
                      </Button>
                    )}
                    <Button onClick={handleStop} variant="ghost" size="lg">
                      <X className="mr-2 h-4 w-4" />Stop
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleStart} disabled={!modelsReady} size="lg">
                    <Camera className="mr-2 h-4 w-4" />Start Camera
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
            </div>
          </TabsContent>

          <TabsContent value="registered" className="mt-0">
            <Card>
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 md:h-5 md:w-5" />
                  Registered Student Faces
                </CardTitle>
                <CardDescription>
                  Students with enrolled face credentials from the backend.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4">
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchRegisteredStudents}
                    disabled={registeredLoading}
                  >
                    {registeredLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </>
                    )}
                  </Button>
                </div>

                {registeredLoading ? (
                  <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                    Loading registered faces...
                  </div>
                ) : registeredError ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    {registeredError}
                  </div>
                ) : registeredStudents.length === 0 ? (
                  <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                    No registered student faces yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {registeredStudents.map((student) => {
                      const latestEnrolledDate = student.credentials
                        .map((c) => c.enrolled_date)
                        .filter(Boolean)
                        .sort()
                        .at(-1);
                      const primaryCount = student.credentials.filter((c) => c.is_primary).length;

                      return (
                        <div
                          key={student.id}
                          className="rounded-xl border bg-card/40 p-3 backdrop-blur-sm md:p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{fullName(student)}</p>
                              <p className="text-xs text-muted-foreground">
                                {student.student_id_number}
                                {student.department?.name ? ` • ${student.department.name}` : ''}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">
                                {student.credentials.length} credential{student.credentials.length > 1 ? 's' : ''}
                              </Badge>
                              {primaryCount > 0 && (
                                <Badge className="bg-success text-success-foreground">
                                  PRIMARY
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setConfirmRecaptureStudent(student)}
                                disabled={isMutatingRegistered || isSaving}
                              >
                                <UserRoundCog className="mr-1 h-3.5 w-3.5" />
                                Re-register
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setConfirmDeleteStudent(student)}
                                disabled={isMutatingRegistered || isSaving}
                              >
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                Delete
                              </Button>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                            <div className="flex items-center gap-1.5">
                              <UserCircle2 className="h-3.5 w-3.5" />
                              <span>Student ID: {student.id}</span>
                            </div>
                            <div>
                              Latest enrolled:{' '}
                              {latestEnrolledDate
                                ? new Date(latestEnrolledDate).toLocaleDateString()
                                : 'N/A'}
                            </div>
                            <div>
                              Credential refs:{' '}
                              {student.credentials.some((c) => c.credential_reference)
                                ? 'Available'
                                : 'None'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <AlertDialog
        open={!!confirmRecaptureStudent}
        onOpenChange={(open) => {
          if (!open) setConfirmRecaptureStudent(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-register face credential?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRecaptureStudent
                ? `This will start a new capture for ${fullName(confirmRecaptureStudent)}.`
                : 'This will start a new capture.'}
              {' '}When you submit, the previous FACE credential(s) will be replaced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutatingRegistered || isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isMutatingRegistered || isSaving}
              onClick={() => {
                if (confirmRecaptureStudent) beginRecapture(confirmRecaptureStudent);
                setConfirmRecaptureStudent(null);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!confirmDeleteStudent}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteStudent(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete registered face?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDeleteStudent
                ? `This removes all saved face credential records for ${fullName(confirmDeleteStudent)}.`
                : 'This removes saved face credential records.'}
              {' '}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutatingRegistered || isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isMutatingRegistered || isSaving}
              onClick={() => {
                if (confirmDeleteStudent) {
                  void handleDeleteRegisteredFace(confirmDeleteStudent);
                }
              }}
            >
              {isMutatingRegistered ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
