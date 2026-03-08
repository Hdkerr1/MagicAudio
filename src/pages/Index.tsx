import { useState, useCallback } from 'react';
import UploadScreen from '@/components/UploadScreen';
import ModeSelector from '@/components/ModeSelector';
import ProcessingScreen from '@/components/ProcessingScreen';
import ResultScreen from '@/components/ResultScreen';
import type { ProcessingMode } from '@/lib/audioProcessor';
import { toast } from 'sonner';

type AppStep = 'upload' | 'select-mode' | 'processing' | 'result';

const Index = () => {
  const [step, setStep] = useState<AppStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ProcessingMode | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);

  const handleFileSelected = useCallback((f: File) => {
    setFile(f);
    setStep('select-mode');
  }, []);

  const handleModeSelect = useCallback((m: ProcessingMode) => {
    setMode(m);
    setStep('processing');
  }, []);

  const handleComplete = useCallback((blob: Blob) => {
    setResultBlob(blob);
    setStep('result');
    toast.success('Audio processed successfully!');
  }, []);

  const handleError = useCallback((error: string) => {
    toast.error(`Processing failed: ${error}`);
    setStep('select-mode');
  }, []);

  const handleReset = useCallback(() => {
    setFile(null);
    setMode(null);
    setResultBlob(null);
    setStep('upload');
  }, []);

  switch (step) {
    case 'upload':
      return <UploadScreen onFileSelected={handleFileSelected} />;
    case 'select-mode':
      return (
        <ModeSelector
          fileName={file?.name || ''}
          onModeSelect={handleModeSelect}
          onBack={() => setStep('upload')}
        />
      );
    case 'processing':
      return (
        <ProcessingScreen
          file={file!}
          mode={mode!}
          onComplete={handleComplete}
          onError={handleError}
        />
      );
    case 'result':
      return (
        <ResultScreen
          blob={resultBlob!}
          originalName={file?.name || 'track'}
          mode={mode!}
          onReset={handleReset}
        />
      );
  }
};

export default Index;
