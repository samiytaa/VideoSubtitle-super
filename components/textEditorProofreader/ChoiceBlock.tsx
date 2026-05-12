import React from 'react';
import { getAvatarPath } from '../../utils/avatarMap';
import AvatarPicker from '../AvatarPicker';
import { ParsedBlock } from './types';
import { getCharacterColor } from './textParserUtils';
import { ExtractedFrame, VideoFile, ROI } from '../../types';

export interface ChoiceBlockProps {
  block: ParsedBlock;
  index: number;
  // 编辑状态
  editingChoiceBlockIndex: number | null;
  editingChoiceOptions: { label: string; blocks: ParsedBlock[] }[];
  editingSubBlock: { optIdx: number; subIdx: number } | null;
  editingSubContent: string;
  editingSubCharacter: string;
  editingSubAvatar: string;
  editingSubNarrationType: 'narration' | 'narration-thought';
  showSubAvatarPicker: boolean;
  choiceSelectedOption: Record<number, number | null>;
  blockRef: (el: HTMLDivElement | null) => void;
  // 回调
  onSetEditingChoiceBlockIndex: (idx: number | null) => void;
  onSetEditingChoiceOptions: (opts: { label: string; blocks: ParsedBlock[] }[]) => void;
  onSaveChoiceEditing: () => void;
  onStartSubEditing: (optIdx: number, subIdx: number, sub: ParsedBlock) => void;
  onCancelSubEditing: () => void;
  onSaveSubEditing: (choiceBlockIdx: number) => void;
  onDeleteSubBlock: (choiceBlockIdx: number, optIdx: number, subIdx: number) => void;
  onInsertSubBlock: (choiceBlockIdx: number, optIdx: number, afterSubIdx: number, type: 'narration' | 'narration-thought' | 'dialogue') => void;
  onDeleteBlock: (blockIndex: number) => void;
  onSetChoiceSelectedOption: (updater: (prev: Record<number, number | null>) => Record<number, number | null>) => void;
  onSetEditingSubContent: (v: string) => void;
  onSetEditingSubCharacter: (v: string) => void;
  onSetEditingSubAvatar: (v: string) => void;
  onSetEditingSubNarrationType: (v: 'narration' | 'narration-thought') => void;
  onSetShowSubAvatarPicker: (v: boolean) => void;
  onUpdateChoiceOptions: (blockIndex: number, opts: { label: string; blocks: ParsedBlock[] }[]) => void;
  showConfirm: (opts: { title: string; message: string }) => Promise<boolean>;
  // 校对图片相关props
  extractedFrames?: ExtractedFrame[];
  onDeleteFrames?: (ids: string[]) => void;
  onJumpToTime?: (timestamp: string) => void;
  activeVideo?: VideoFile | null;
  videoSrc?: string | null;
  sharedVideoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  roi?: ROI | null;
  onCaptureFrame?: (frame: ExtractedFrame) => void;
}

const ChoiceBlock: React.FC<ChoiceBlockProps> = ({
  block,
  index,
  editingChoiceBlockIndex,
  editingChoiceOptions,
  editingSubBlock,
  editingSubContent,
  editingSubCharacter,
  editingSubAvatar,
  editingSubNarrationType,
  showSubAvatarPicker,
  choiceSelectedOption,
  blockRef,
  onSetEditingChoiceBlockIndex,
  onSetEditingChoiceOptions,
  onSaveChoiceEditing,
  onStartSubEditing,
  onCancelSubEditing,
  onSaveSubEditing,
  onDeleteSubBlock,
  onInsertSubBlock,
  onDeleteBlock,
  onSetChoiceSelectedOption,
  onSetEditingSubContent,
  onSetEditingSubCharacter,
  onSetEditingSubAvatar,
  onSetEditingSubNarrationType,
  onSetShowSubAvatarPicker,
  onUpdateChoiceOptions,
  showConfirm,
  extractedFrames = [],
  onDeleteFrames,
  onJumpToTime,
  activeVideo,
  videoSrc,
  sharedVideoRef,
  roi,
  onCaptureFrame
}) => {
  const isHeaderEditing = editingChoiceBlockIndex === index;
  const opts = isHeaderEditing ? editingChoiceOptions : (block.choiceOptions || []);

  const renderOptionBlocks = () =>
    opts.map((opt, optIdx) => {
      const selectedOptIdx = choiceSelectedOption[index] ?? null;
      const isSelected = selectedOptIdx === optIdx;
      const isDimmed = selectedOptIdx !== null && !isSelected;

      return (
        <div
          key={optIdx}
          className={`rounded border overflow-hidden transition-all ${isSelected ? 'border-amber-500 shadow-md' : 'border-amber-300'} ${isDimmed ? 'opacity-40' : ''}`}
          style={{ backgroundColor: isSelected ? '#f5e6c8' : '#e8e8e0' }}
        >
          {/* 选项标题行 */}
          <div
            className={`px-2 py-1 flex items-center gap-2 cursor-pointer select-none transition-colors ${isSelected ? 'bg-amber-400' : 'bg-amber-100 hover:bg-amber-200'}`}
            onClick={() => onSetChoiceSelectedOption(prev => ({
              ...prev,
              [index]: prev[index] === optIdx ? null : optIdx,
            }))}
          >
            <span className={`text-xs font-medium shrink-0 ${isSelected ? 'text-white' : 'text-amber-800'}`}>选项 {optIdx + 1}：</span>
            {isHeaderEditing ? (
              <>
                <input
                  value={editingChoiceOptions[optIdx]?.label ?? opt.label}
                  onChange={(e) => {
                    const next = [...editingChoiceOptions];
                    next[optIdx] = { ...next[optIdx], label: e.target.value };
                    onSetEditingChoiceOptions(next);
                  }}
                  className="flex-1 px-1.5 py-0.5 border border-amber-300 rounded text-xs"
                />
                <button
                  onClick={() => {
                    const next = editingChoiceOptions.filter((_, j) => j !== optIdx);
                    onSetEditingChoiceOptions(next);
                    onUpdateChoiceOptions(index, next);
                  }}
                  className="text-red-500 hover:text-red-700 text-xs shrink-0"
                >✕</button>
              </>
            ) : (
              <span
                className={`text-xs flex-1 cursor-pointer hover:underline ${isSelected ? 'text-white font-semibold' : 'text-amber-800'}`}
                title="点击编辑选项名"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetEditingChoiceBlockIndex(index);
                  onSetEditingChoiceOptions(JSON.parse(JSON.stringify(block.choiceOptions || [])));
                }}
              >{opt.label}</span>
            )}
          </div>

          {/* 选项内部 blocks */}
          <div className="p-1.5 space-y-1">
            {opt.blocks.map((sub, subIdx) => {
              const isSubEditing = editingSubBlock?.optIdx === optIdx && editingSubBlock?.subIdx === subIdx;
              const subMenuId = `sub-insert-${index}-${optIdx}-${subIdx}`;

              if (sub.type === 'narration' || sub.type === 'narration-thought') {
                return (
                  <div
                    key={subIdx}
                    className={`group relative px-3 py-2 rounded text-xs leading-relaxed cursor-pointer ${isSubEditing ? 'ring-2 ring-indigo-400' : ''}`}
                    style={{ backgroundColor: '#7b7b77', color: '#fff' }}
                    onClick={() => !isSubEditing && onStartSubEditing(optIdx, subIdx, sub)}
                  >
                    {isSubEditing ? (
                      <div onClick={(e) => e.stopPropagation()} className="space-y-1.5">
                        <select
                          value={editingSubNarrationType}
                          onChange={(e) => onSetEditingSubNarrationType(e.target.value as 'narration' | 'narration-thought')}
                          className="w-full px-2 py-1 border border-white rounded text-xs bg-white text-gray-900"
                        >
                          <option value="narration">普通旁白</option>
                          <option value="narration-thought">心理旁白</option>
                        </select>
                        <textarea
                          value={editingSubContent}
                          onChange={(e) => onSetEditingSubContent(e.target.value)}
                          className="w-full min-h-[50px] px-2 py-1 border border-white rounded text-xs resize-vertical text-gray-900 bg-white"
                        />
                        <div className="flex gap-1.5">
                          <button onClick={() => onSaveSubEditing(index)} className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">保存</button>
                          <button onClick={onCancelSubEditing} className="px-3 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600">取消</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {sub.type === 'narration-thought' && <span className="font-bold mr-1" style={{ color: '#f8e4c2' }}>◆ 我</span>}
                        <span style={{ color: sub.type === 'narration-thought' ? '#f8e4c2' : '#fff' }}>{sub.content}</span>
                        <div className="absolute right-1 top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); const m = document.getElementById(subMenuId); if (m) m.style.display = m.style.display === 'none' ? 'flex' : 'none'; }}
                            className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                          >＋</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteSubBlock(index, optIdx, subIdx); }}
                            className="px-1.5 py-0.5 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                          >✕</button>
                        </div>
                        <div
                          id={subMenuId}
                          className="absolute right-1 top-7 bg-white rounded shadow-lg border border-gray-200 p-1 flex-col gap-0.5 z-10 min-w-[120px]"
                          style={{ display: 'none' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(['narration', 'narration-thought', 'dialogue'] as const).map(t => (
                            <button
                              key={t}
                              onClick={() => { onInsertSubBlock(index, optIdx, subIdx, t); const m = document.getElementById(subMenuId); if (m) m.style.display = 'none'; }}
                              className="w-full px-2 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-100 rounded"
                            >
                              {t === 'narration' ? '插入普通旁白' : t === 'narration-thought' ? '插入心理旁白' : '插入对话'}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              }

              if (sub.type === 'dialogue') {
                const color = getCharacterColor(sub.character || '', sub.customColor);
                return (
                  <div
                    key={subIdx}
                    className={`group relative bg-white border px-3 py-2 rounded text-xs leading-relaxed flex gap-2 items-start cursor-pointer hover:shadow-sm ${isSubEditing ? 'ring-2 ring-indigo-400' : ''}`}
                    style={{ borderColor: color }}
                    onClick={() => !isSubEditing && onStartSubEditing(optIdx, subIdx, sub)}
                  >
                    {sub.avatarStyle && (() => {
                      const p = getAvatarPath(sub.avatarStyle);
                      return p ? (
                        <div className="shrink-0 w-[40px] h-[40px] overflow-hidden rounded">
                          <img src={p} alt={sub.character} className="w-[120%] h-[120%] object-cover object-center -translate-x-[8.33%] -translate-y-[8.33%]" />
                        </div>
                      ) : null;
                    })()}
                    <div className="flex-1 min-w-0">
                      {isSubEditing ? (
                        <div onClick={(e) => e.stopPropagation()} className="space-y-1.5">
                          <input
                            value={editingSubCharacter}
                            onChange={(e) => onSetEditingSubCharacter(e.target.value)}
                            placeholder="角色名"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                          <textarea
                            value={editingSubContent}
                            onChange={(e) => onSetEditingSubContent(e.target.value)}
                            className="w-full min-h-[50px] px-2 py-1 border border-gray-300 rounded text-xs resize-vertical"
                          />
                          <div className="flex items-center gap-2">
                            <button onClick={() => onSetShowSubAvatarPicker(true)} className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600">选择头像</button>
                            <button onClick={() => onSetEditingSubAvatar('')} className="px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500">清空头像</button>
                            <input
                              value={editingSubAvatar}
                              onChange={(e) => onSetEditingSubAvatar(e.target.value)}
                              placeholder="头像名"
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                            />
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => onSaveSubEditing(index)} className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">保存</button>
                            <button onClick={onCancelSubEditing} className="px-3 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600">取消</button>
                          </div>
                          {showSubAvatarPicker && (
                            <AvatarPicker
                              onSelect={(name) => { onSetEditingSubAvatar(name); onSetShowSubAvatarPicker(false); }}
                              onClose={() => onSetShowSubAvatarPicker(false)}
                              currentAvatar={editingSubAvatar}
                              extractedFrames={extractedFrames}
                              onDeleteFrames={onDeleteFrames}
                              onJumpToTime={onJumpToTime}
                              activeVideo={activeVideo}
                              videoSrc={videoSrc}
                              sharedVideoRef={sharedVideoRef}
                              roi={roi}
                              onCaptureFrame={onCaptureFrame}
                            />
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center mb-0.5">
                            <span className="font-bold mr-1" style={{ color }}>◆</span>
                            <span className="font-bold" style={{ color }}>{sub.character}</span>
                          </div>
                          <div className="text-gray-700">{sub.content}</div>
                          <div className="absolute right-1 top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); const m = document.getElementById(subMenuId); if (m) m.style.display = m.style.display === 'none' ? 'flex' : 'none'; }}
                              className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                            >＋</button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDeleteSubBlock(index, optIdx, subIdx); }}
                              className="px-1.5 py-0.5 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                            >✕</button>
                          </div>
                          <div
                            id={subMenuId}
                            className="absolute right-1 top-7 bg-white rounded shadow-lg border border-gray-200 p-1 flex-col gap-0.5 z-10 min-w-[120px]"
                            style={{ display: 'none' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {(['narration', 'narration-thought', 'dialogue'] as const).map(t => (
                              <button
                                key={t}
                                onClick={() => { onInsertSubBlock(index, optIdx, subIdx, t); const m = document.getElementById(subMenuId); if (m) m.style.display = 'none'; }}
                                className="w-full px-2 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-100 rounded"
                              >
                                {t === 'narration' ? '插入普通旁白' : t === 'narration-thought' ? '插入心理旁白' : '插入对话'}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })}
            <button
              onClick={() => onInsertSubBlock(index, optIdx, opt.blocks.length - 1, 'dialogue')}
              className="w-full py-1 border border-dashed border-gray-400 text-gray-500 text-xs rounded hover:bg-gray-100"
            >＋ 添加内容</button>
          </div>
        </div>
      );
    });

  return (
    <div ref={blockRef} className="mb-1.5 rounded-lg border-2 border-amber-400 overflow-hidden">
      <div className="px-3 py-1.5 bg-amber-400 text-white text-xs font-bold flex items-center justify-between">
        <span>分歧选项</span>
        <div className="flex gap-1">
          <button
            onClick={() => {
              if (isHeaderEditing) {
                onSaveChoiceEditing();
              } else {
                onSetEditingChoiceBlockIndex(index);
                onSetEditingChoiceOptions(JSON.parse(JSON.stringify(block.choiceOptions || [])));
              }
            }}
            className="px-2 py-0.5 bg-white/30 hover:bg-white/50 rounded text-xs"
          >
            {isHeaderEditing ? '完成' : '编辑选项'}
          </button>
          <button
            onClick={() => {
              const newOpt = { label: '新选项', blocks: [] };
              onUpdateChoiceOptions(index, [...(block.choiceOptions || []), newOpt]);
              if (isHeaderEditing) onSetEditingChoiceOptions([...editingChoiceOptions, newOpt]);
            }}
            className="px-2 py-0.5 bg-white/30 hover:bg-white/50 rounded text-xs"
          >＋ 选项</button>
          <button
            onClick={async () => {
              const ok = await showConfirm({ title: '确认删除', message: '确定要删除这个分歧块吗？' });
              if (ok) onDeleteBlock(index);
            }}
            className="px-2 py-0.5 bg-white/30 hover:bg-white/50 rounded text-xs"
          >✕</button>
        </div>
      </div>
      <div className="p-2 space-y-2 bg-amber-50">
        {renderOptionBlocks()}
      </div>
    </div>
  );
};

export default ChoiceBlock;
