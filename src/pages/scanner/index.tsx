import { MainLayout } from '@/components/layout/MainLayout';

export default function ScannerPlaceholder() {
  return (
    <MainLayout>
      <div className="section-spacing safe-top safe-bottom">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Face Scanner</h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground md:text-base">
          Select a terminal from the sidebar: Hallway, Classroom, or Event Face Terminal.
        </p>
      </div>
    </MainLayout>
  );
}
