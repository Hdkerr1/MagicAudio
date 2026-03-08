import { useCallback, useState } from 'react';
import { Upload, Music, FileAudio } from 'lucide-react';

interface UploadScreenProps {
  onFileSelected: (file: File) => void;
}

const UploadScreen = ({ onFileSelected }: UploadScreenProps) => {
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
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Music className="w-8 h-8 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold text-gradient-primary">
            SoundForge
          </h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-md">
          Transform your music with studio-grade effects. Upload a track to begin.
        </p>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative cursor-pointer w-full max-w-lg aspect-[4/3] rounded-2xl border-2 border-dashed
          flex flex-col items-center justify-center gap-4 transition-all duration-300
          ${isDragging
            ? 'border-primary bg-primary/5 glow-primary scale-[1.02]'
            : 'border-border hover:border-primary/50 bg-card hover:bg-card/80'
          }
        `}
      >
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileInput}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-primary/20' : 'bg-secondary'}`}>
          {isDragging ? (
            <FileAudio className="w-10 h-10 text-primary" />
          ) : (
            <Upload className="w-10 h-10 text-muted-foreground" />
          )}
        </div>
        <div className="text-center">
          <p className="text-foreground font-medium text-lg">
            {isDragging ? 'Drop your file here' : 'Drop audio file or click to browse'}
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            MP3, WAV, FLAC, OGG — up to 50MB
          </p>
        </div>
      </label>
    </div>
  );
};

export default UploadScreen;
