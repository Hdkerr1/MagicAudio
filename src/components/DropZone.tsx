import { useCallback, useState } from 'react';
import { Upload, FileAudio, Music } from 'lucide-react';

interface DropZoneProps {
  onFileSelected: (file: File) => void;
}

const DropZone = ({ onFileSelected }: DropZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      onFileSelected(file);
    }
  }, [onFileSelected]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
  }, [onFileSelected]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-hero px-4">
      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-accent/5 blur-[100px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 mb-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl glass glow-primary">
            <Music className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gradient-primary tracking-tight">
            SoundForge
          </h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
          Studio-grade audio effects in your browser.
          <br />
          <span className="text-foreground/70">Slowed + Reverb · Remix · Slowed Lo-Fi</span>
        </p>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative z-10 cursor-pointer w-full max-w-xl aspect-[16/9] rounded-2xl
          flex flex-col items-center justify-center gap-5 transition-all duration-300
          ${isDragging
            ? 'glass-strong glow-primary scale-[1.02] border-primary/40'
            : 'glass hover:glass-strong hover:border-primary/20'
          }
        `}
      >
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileInput}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <div className={`p-5 rounded-2xl transition-all duration-300 ${isDragging ? 'bg-primary/15 glow-primary' : 'bg-secondary/60'}`}>
          {isDragging ? (
            <FileAudio className="w-10 h-10 text-primary animate-float" />
          ) : (
            <Upload className="w-10 h-10 text-muted-foreground" />
          )}
        </div>
        <div className="text-center">
          <p className="text-foreground font-medium text-lg">
            {isDragging ? 'Drop your track here' : 'Drop audio file or click to browse'}
          </p>
          <p className="text-muted-foreground text-sm mt-1.5 font-mono">
            MP3 · WAV · FLAC · OGG — up to 50MB
          </p>
        </div>
      </label>
    </div>
  );
};

export default DropZone;
