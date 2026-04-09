import { useCallback, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { FaceScannerTerminal } from '@/components/scanner/FaceScannerTerminal';
import { scannerService, type ScannerTerminalDevice } from '@/services/scanner.service';
import { Button } from '@/components/ui/button';
import { ChevronLeft, DoorOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HallwayScanner() {
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
            <Link to="/" aria-label="Back to dashboard">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Hallway Face Terminal</h1>
            </div>
          </div>
        </div>

        <FaceScannerTerminal
          terminalType="hallway"
          title="Hallway Terminal"
          subtitle="Main entrance attendance scanner"
          onRecordAttendance={scannerService.recordHallwayAttendance.bind(scannerService)}
          onTerminalContext={handleTerminalContext}
        />
      </div>
    </MainLayout>
  );
}
