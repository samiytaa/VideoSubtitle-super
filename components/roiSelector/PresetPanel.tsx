import React from 'react';
import { RoiPreset } from '../../types';
import PresetCard from './PresetCard';

interface PresetPanelProps {
  presets: Record<string, RoiPreset>;
  currentPresetName: string | null;
  selectedDialoguePresetName?: string | null;
  selectedLocationPresetName?: string | null;
  onApply: (preset: RoiPreset) => void;
  onAdd: (category: 'dialogue' | 'location') => void;
  onDelete: (e: React.MouseEvent, name: string) => void;
  onRename: (e: React.MouseEvent, name: string) => void;
  onSetDefault: (e: React.MouseEvent, name: string) => void;
  dialogueOptionsContent?: React.ReactNode;
  locationOptionsContent?: React.ReactNode;
}

const PresetPanel: React.FC<PresetPanelProps> = ({
  presets,
  currentPresetName,
  selectedDialoguePresetName,
  selectedLocationPresetName,
  onApply,
  onAdd,
  onDelete,
  onRename,
  onSetDefault,
  dialogueOptionsContent,
  locationOptionsContent,
}) => {
  const allPresets = Object.values(presets) as RoiPreset[];

  const dialoguePresets = allPresets.filter(p =>
    p.category === 'dialogue' || p.name.includes('对话') || p.name.includes('【对话】')
  );
  const locationPresets = allPresets.filter(p =>
    p.category === 'location' || p.name.includes('地点') || p.name.includes('【地点】')
  );

  return (
    <div className="flex flex-col gap-3">
      <PresetCard
        category="dialogue"
        presets={dialoguePresets}
        currentPresetName={currentPresetName}
        selectedPresetName={selectedDialoguePresetName}
        onApply={onApply}
        onAdd={() => onAdd('dialogue')}
        onDelete={onDelete}
        onRename={onRename}
        onSetDefault={onSetDefault}
        optionsContent={dialogueOptionsContent}
      />
      <PresetCard
        category="location"
        presets={locationPresets}
        currentPresetName={currentPresetName}
        selectedPresetName={selectedLocationPresetName}
        onApply={onApply}
        onAdd={() => onAdd('location')}
        onDelete={onDelete}
        onRename={onRename}
        onSetDefault={onSetDefault}
        optionsContent={locationOptionsContent}
      />
    </div>
  );
};

export default PresetPanel;
