import { Slider } from '@/components/ui/slider';
import type { PlaybackMode, ModeParams } from '@/lib/audio/engine';

interface ParamSlidersProps {
  mode: PlaybackMode;
  params: ModeParams;
  onParamChange: <M extends keyof ModeParams>(mode: M, key: keyof ModeParams[M], value: number) => void;
}

interface SliderDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

const sliderDefs: Record<string, SliderDef[]> = {
  'slowed-reverb': [
    { key: 'speed', label: 'Speed', min: 0.6, max: 1.0, step: 0.01, unit: 'x' },
    { key: 'reverbMix', label: 'Reverb Mix', min: 0, max: 1, step: 0.01 },
    { key: 'reverbDecay', label: 'Reverb Decay', min: 1, max: 8, step: 0.5, unit: 's' },
  ],
  'hard-bass': [
    { key: 'bassBoost', label: 'Bass Boost', min: 0, max: 1, step: 0.01 },
    { key: 'saturation', label: 'Saturation', min: 0, max: 1, step: 0.01 },
    { key: 'punch', label: 'Punch', min: 0, max: 1, step: 0.01 },
  ],
  'lofi': [
    { key: 'warmth', label: 'Warmth', min: 0, max: 1, step: 0.01 },
    { key: 'crackle', label: 'Crackle', min: 0, max: 1, step: 0.01 },
    { key: 'wobble', label: 'Wow & Flutter', min: 0, max: 1, step: 0.01 },
  ],
};

const modeAccents: Record<string, string> = {
  'slowed-reverb': 'text-primary',
  'hard-bass': 'text-accent',
  'lofi': 'text-glow-warm',
};

const formatValue = (val: number, def: SliderDef) => {
  if (def.unit === 'x') return `${val.toFixed(2)}x`;
  if (def.unit === 's') return `${val.toFixed(1)}s`;
  return `${Math.round(val * 100)}%`;
};

const ParamSliders = ({ mode, params, onParamChange }: ParamSlidersProps) => {
  if (!mode) return null;

  const defs = sliderDefs[mode];
  const currentParams = params[mode] as Record<string, number>;
  const accent = modeAccents[mode] || 'text-primary';

  return (
    <div className="w-full glass rounded-xl p-4 space-y-4">
      <h3 className={`text-xs font-mono font-semibold uppercase tracking-wider ${accent}`}>
        Effect Parameters
      </h3>
      {defs.map((def) => (
        <div key={def.key} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground font-medium">{def.label}</label>
            <span className="text-xs font-mono text-foreground/70">
              {formatValue(currentParams[def.key], def)}
            </span>
          </div>
          <Slider
            min={def.min}
            max={def.max}
            step={def.step}
            value={[currentParams[def.key]]}
            onValueChange={([v]) => {
              if (mode === 'slowed-reverb') onParamChange('slowed-reverb', def.key as keyof ModeParams['slowed-reverb'], v);
              else if (mode === 'hard-bass') onParamChange('hard-bass', def.key as keyof ModeParams['hard-bass'], v);
              else if (mode === 'lofi') onParamChange('lofi', def.key as keyof ModeParams['lofi'], v);
            }}
            className="w-full"
          />
        </div>
      ))}
    </div>
  );
};

export default ParamSliders;
