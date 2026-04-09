import { useCallback, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { FaceScannerTerminal } from '@/components/scanner/FaceScannerTerminal';
import { scannerService, type ScannerTerminalDevice } from '@/services/scanner.service';
import { Button } from '@/components/ui/button';
import { ChevronLeft, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboardPath, useAuth } from '@/contexts/auth-context';

export default function ClassroomScanner() {
  const { user } = useAuth();
  const dashboardPath = getDashboardPath(user?.role?.name);
  const [, setDeviceLine] = useState('Loading device…');

  const handleTerminalContext = useCallback(
    (result: { device: ScannerTerminalDevice } | { error: string }) => {
      if ('device' in result) {
        setDeviceLine(`${result.device.name} (${result.device.code})`);
      } else {
        setDeviceLine('Terminal unavailable');
      }
    },
    []
  );

  return (
    <MainLayout>
      <div className="section-spacing safe-top safe-bottom">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-0.5 shrink-0">
            <Link to={dashboardPath} aria-label="Back to dashboard">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Classroom Face Terminal</h1>
            </div>
          </div>
        </div>

        <FaceScannerTerminal
          terminalType="classroom"
          title="Classroom Terminal"
          subtitle="Classroom attendance scanner"
          onRecordAttendance={scannerService.recordClassroomAttendance.bind(scannerService)}
          onTerminalContext={handleTerminalContext}
        />
      </div>
    </MainLayout>
  );
}
