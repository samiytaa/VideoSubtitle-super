import React from 'react';
import { getAvatarPath } from '../../utils/avatarMap';
import AvatarPicker from '../AvatarPicker';
import { ParsedBlock } from './types';
import { getCharacterColor, parseEditableBlocksText, serializeBlocksText } from './textParserUtils';
import { ExtractedFrame, VideoFile, ROI } from '../../types';
import { SharedDialogueItem } from './components/blocks/SharedDialogueItem';

export interface NestedChoiceGroupProps {
  block: ParsedBlock;
  index: number;
  currentChapterIndex: number;
  characterName: string;
  nestedSelectedOption: Record<number, number | null>;
  nestedHighlight: { blockIndex: number; showIndex: number; bi?: number } | null;
  editingNestedContent: { groupIndex: number; showIndex: number; bi: number } | null;
  editingNestedBlockContent: string;
  editingNestedBlockCharacter: string;
  editingNestedBlockAvatar: string;
  editingNestedBlockNarrationType: 'narration' | 'narration-thought';
  showNestedAvatarPicker: boolean;
  editingNestedLabel2: { blockIndex: number; showIndex: number } | null;
  editingNestedLabelValue: string;
  isMultiSelectMode: boolean;
  selectedNestedKeys: Set<string>;
  characterAvatarHistory: Record<string, string[]>;
  blockRefs: React.MutableRefObject<{ [key: string]: HTMLDivElement | null }>;
  onSetNestedSelectedOption: (updater: (prev: Record<number, number | null>) => Record<number, number | null>) => void;
  onSetEditingNestedContent: (v: { groupIndex: number; showIndex: number; bi: number } | null) => void;
  onSetEditingNestedBlockContent: (v: string) => void;
  onSetEditingNestedBlockCharacter: (v: string) => void;
  onSetEditingNestedBlockAvatar: (v: string) => void;
  onSetEditingNestedBlockNarrationType: (v: 'narration' | 'narration-thought') => void;
  onSetShowNestedAvatarPicker: (v: boolean) => void;
  onSetEditingNestedLabel2: (v: { blockIndex: number; showIndex: number } | null) => void;
  onSetEditingNestedLabelValue: (v: string) => void;
  onSetSelectedNestedKeys: (updater: (prev: Set<string>) => Set<string>) => void;
  onSaveNestedContentEditing: () => void;
  onUpdateNestedGroup: (
    blockIndex: number,
    updater: (opts: { label: string; showIndex: number; blocks: ParsedBlock[] }[]) => { label: string; showIndex: number; blocks: ParsedBlock[] }[]
  ) => void;
  onDeleteNestedOption: (blockIndex: number, showIndex: number) => void;
  onInsertNestedContentBlock: (blockIndex: number, showIndex: number, type: 'narration' | 'narration-thought' | 'dialogue') => void;
  onDeleteNestedContentBlock: (blockIndex: number, showIndex: number, bi: number) => void;
  onInsertBlock: (afterIndex: number, blockType: 'narration' | 'narration-thought' | 'dialogue' | 'nested-choice-group') => void;
  onDeleteBlock: (blockIndex: number) => void;
  showConfirm: (opts: { title: string; message: string }) => Promise<boolean>;
  showAlert: (message: string, title?: string) => void;
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

const NestedChoiceGroup: React.FC<NestedChoiceGroupProps> = ({
  block,
  index,
  currentChapterIndex,
  characterName,
  nestedSelectedOption,
  nestedHighlight,
  editingNestedContent,
  editingNestedBlockContent,
  editingNestedBlockCharacter,
  editingNestedBlockAvatar,
  editingNestedBlockNarrationType,
  showNestedAvatarPicker,
  editingNestedLabel2,
  editingNestedLabelValue,
  isMultiSelectMode,
  selectedNestedKeys,
  characterAvatarHistory,
  blockRefs,
  onSetNestedSelectedOption,
  onSetEditingNestedContent,
  onSetEditingNestedBlockContent,
  onSetEditingNestedBlockCharacter,
  onSetEditingNestedBlockAvatar,
  onSetEditingNestedBlockNarrationType,
  onSetShowNestedAvatarPicker,
  onSetEditingNestedLabel2,
  onSetEditingNestedLabelValue,
  onSetSelectedNestedKeys,
  onSaveNestedContentEditing,
  onUpdateNestedGroup,
  onDeleteNestedOption,
  onInsertNestedContentBlock,
  onDeleteNestedContentBlock,
  onInsertBlock,
  onDeleteBlock,
  showConfirm,
  showAlert,
  extractedFrames = [],
  onDeleteFrames,
  onJumpToTime,
  activeVideo,
  videoSrc,
  sharedVideoRef,
  roi,
  onCaptureFrame
}) => {
  const opts = block.nestedOptions || [];
  const selectedShowIndex = nestedSelectedOption[index] ?? (opts[0]?.showIndex ?? null);
  const selectedOpt = selectedShowIndex !== null ? opts.find(o => o.showIndex === selectedShowIndex) : null;
  const [isRawEditing, setIsRawEditing] = React.useState(false);
  const [rawEditingText, setRawEditingText] = React.useState('');

  React.useEffect(() => {
    setIsRawEditing(false);
    setRawEditingText('');
  }, [index, selectedShowIndex, block.nestedOptions]);

  const startRawEditing = () => {
    if (!selectedOpt) return;
    setRawEditingText(serializeBlocksText(selectedOpt.blocks));
    setIsRawEditing(true);
  };

  const saveRawEditing = () => {
    if (!selectedOpt) return;
    const parsed = parseEditableBlocksText(rawEditingText);
    if (parsed.error) {
      showAlert(parsed.error, '原文解析失败');
      return;
    }
    onUpdateNestedGroup(index, opts =>
      opts.map(o => o.showIndex === selectedOpt.showIndex ? { ...o, blocks: parsed.blocks } : o)
    );
    setIsRawEditing(false);
    setRawEditingText('');
  };

  const renderContentBlock = (b: ParsedBlock, bi: number, showIndex: number) => {
    const fakeKey = `nested-${index}-${showIndex}-${bi}`;
    const menuId = `nested-content-menu-${index}-${showIndex}-${bi}`;
    const convertMenuId = `nested-convert-menu-${index}-${showIndex}-${bi}`;
    const isEditing =
      editingNestedContent?.groupIndex === index &&
      editingNestedContent?.showIndex === showIndex &&
      editingNestedContent?.bi === bi;
    const isHighlighted =
      nestedHighlight?.blockIndex === index &&
      nestedHighlight?.showIndex === showIndex &&
      nestedHighlight?.bi === bi;

    const startEdit = () => {
      onSetEditingNestedContent({ groupIndex: index, showIndex, bi });
      onSetEditingNestedBlockContent(b.content);
      const db = b as { character?: string; avatarStyle?: string };
      onSetEditingNestedBlockCharacter(db.character || '');
      onSetEditingNestedBlockAvatar(db.avatarStyle || '');
      onSetEditingNestedBlockNarrationType(b.type === 'narration-thought' ? 'narration-thought' : 'narration');
    };

    const insertMenu = (
      <div
        id={menuId}
        className="absolute right-2 top-10 bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex flex-col gap-1 z-10 min-w-[140px]"
        style={{ display: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {(['narration', 'narration-thought', 'dialogue'] as const).map(t => (
          <button
            key={t}
            onClick={() => {
              onInsertNestedContentBlock(index, showIndex, t);
              const m = document.getElementById(menuId);
              if (m) m.style.display = 'none';
            }}
            className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            {t === 'narration' ? '插入普通旁白' : t === 'narration-thought' ? '插入心理旁白' : '插入对话'}
          </button>
        ))}
      </div>
    );

    const actionButtons = (isDialogue: boolean) => (
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const m = document.getElementById(convertMenuId);
              if (m) m.style.display = m.style.display === 'none' ? 'flex' : 'none';
            }}
            className="px-2 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 transition-colors"
            title="转换类型"
          >⇄</button>
          <div
            id={convertMenuId}
            className="absolute right-0 top-7 bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex-col gap-1 z-20 min-w-[120px]"
            style={{ display: 'none' }}
            onClick={(e) => e.stopPropagation()}
          >
            {isDialogue ? (
              <>
                <button onClick={() => {
                  onUpdateNestedGroup(index, opts => opts.map(o => {
                    if (o.showIndex !== showIndex) return o;
                    const nb = [...o.blocks]; nb[bi] = { type: 'narration', content: nb[bi].content }; return { ...o, blocks: nb };
                  }));
                  const m = document.getElementById(convertMenuId); if (m) m.style.display = 'none';
                }} className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors">普通旁白</button>
                <button onClick={() => {
                  onUpdateNestedGroup(index, opts => opts.map(o => {
                    if (o.showIndex !== showIndex) return o;
                    const nb = [...o.blocks]; nb[bi] = { type: 'narration-thought', content: nb[bi].content }; return { ...o, blocks: nb };
                  }));
                  const m = document.getElementById(convertMenuId); if (m) m.style.display = 'none';
                }} className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors">心理旁白</button>
              </>
            ) : (
              <>
                <button onClick={() => {
                  const target = b.type === 'narration' ? 'narration-thought' : 'narration';
                  onUpdateNestedGroup(index, opts => opts.map(o => {
                    if (o.showIndex !== showIndex) return o;
                    const nb = [...o.blocks]; nb[bi] = { ...nb[bi], type: target }; return { ...o, blocks: nb };
                  }));
                  const m = document.getElementById(convertMenuId); if (m) m.style.display = 'none';
                }} className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors">
                  {b.type === 'narration' ? '心理旁白' : '普通旁白'}
                </button>
                <button onClick={() => {
                  const defChar = b.type === 'narration-thought' ? '我' : (characterName || '角色名');
                  onUpdateNestedGroup(index, opts => opts.map(o => {
                    if (o.showIndex !== showIndex) return o;
                    const nb = [...o.blocks]; nb[bi] = { type: 'dialogue', content: nb[bi].content, character: defChar, avatarStyle: '' }; return { ...o, blocks: nb };
                  }));
                  const m = document.getElementById(convertMenuId); if (m) m.style.display = 'none';
                }} className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors">对话</button>
              </>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const m = document.getElementById(menuId);
            if (m) m.style.display = m.style.display === 'none' ? 'flex' : 'none';
          }}
          className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
        >＋</button>
        <button
          onClick={async (e) => {
            e.stopPropagation();
            const ok = await showConfirm({ title: '确认删除', message: '确定要删除这条内容吗？' });
            if (ok) onDeleteNestedContentBlock(index, showIndex, bi);
          }}
          className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
        >✕</button>
      </div>
    );

    if (b.type === 'narration' || b.type === 'narration-thought') {
      return (
        <div
          key={fakeKey}
          ref={(el) => { blockRefs.current[fakeKey] = el; }}
          className={`group relative px-4 py-2.5 mb-1.5 rounded-lg text-sm leading-relaxed cursor-pointer transition-all ${isEditing ? 'ring-2 ring-indigo-500' : isHighlighted ? 'ring-2 ring-yellow-400' : ''}`}
          style={{ backgroundColor: '#7b7b77', color: '#ffffff' }}
          onDoubleClick={() => !isEditing && startEdit()}
        >
          {b.type === 'narration-thought' && (
            <div className="flex items-center mb-1.5">
              <span className="text-base mr-1 font-bold" style={{ color: '#f8e4c2' }}>◆</span>
              <span className="font-bold text-sm" style={{ color: '#f8e4c2' }}>我</span>
            </div>
          )}
          {isEditing ? (
            <div onClick={(e) => e.stopPropagation()} className="space-y-2">
              <textarea
                value={editingNestedBlockContent}
                onChange={(e) => onSetEditingNestedBlockContent(e.target.value)}
                className="w-full min-h-[60px] px-3 py-2 border border-white rounded-lg text-sm resize-vertical text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2">
                <button onClick={onSaveNestedContentEditing} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">保存</button>
                <button onClick={() => onSetEditingNestedContent(null)} className="px-4 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-medium hover:bg-gray-600 transition-colors">取消</button>
              </div>
            </div>
          ) : (
            <>
              {b.type === 'narration-thought'
                ? <div className="text-sm" style={{ color: '#f8e4c2' }}>{b.content}</div>
                : b.content
              }
              {actionButtons(false)}
              {insertMenu}
            </>
          )}
        </div>
      );
    }

    if (b.type === 'dialogue') {
      const color = getCharacterColor(b.character || '', b.customColor);
      const nestedKey = `${index}-${showIndex}-${bi}`;
      const isNestedSelected = selectedNestedKeys.has(nestedKey);
      
      const renderNestedActionButtons = () => (
        <>
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const m = document.getElementById(convertMenuId);
                  if (m) m.style.display = m.style.display === 'none' ? 'flex' : 'none';
                }}
                className="px-2 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 transition-colors"
                title="转换类型"
              >⇄</button>
              <div
                id={convertMenuId}
                className="absolute right-0 top-7 bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex-col gap-1 z-20 min-w-[120px]"
                style={{ display: 'none' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button onClick={() => {
                  onUpdateNestedGroup(index, opts => opts.map(o => {
                    if (o.showIndex !== showIndex) return o;
                    const nb = [...o.blocks]; nb[bi] = { type: 'narration', content: nb[bi].content }; return { ...o, blocks: nb };
                  }));
                  const m = document.getElementById(convertMenuId); if (m) m.style.display = 'none';
                }} className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors">普通旁白</button>
                <button onClick={() => {
                  onUpdateNestedGroup(index, opts => opts.map(o => {
                    if (o.showIndex !== showIndex) return o;
                    const nb = [...o.blocks]; nb[bi] = { type: 'narration-thought', content: nb[bi].content }; return { ...o, blocks: nb };
                  }));
                  const m = document.getElementById(convertMenuId); if (m) m.style.display = 'none';
                }} className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors">心理旁白</button>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const m = document.getElementById(menuId);
                if (m) m.style.display = m.style.display === 'none' ? 'flex' : 'none';
              }}
              className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
            >＋</button>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                const ok = await showConfirm({ title: '确认删除', message: '确定要删除这条内容吗？' });
                if (ok) onDeleteNestedContentBlock(index, showIndex, bi);
              }}
              className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
            >✕</button>
          </div>
          {insertMenu}
        </>
      );

      return (
        <SharedDialogueItem
          key={fakeKey}
          character={b.character || ''}
          content={b.content}
          avatarStyle={b.avatarStyle}
          customColor={b.customColor}
          isEditing={isEditing}
          isSelected={isNestedSelected}
          isMultiSelectMode={isMultiSelectMode}
          isHighlighted={isHighlighted}
          editingCharacter={editingNestedBlockCharacter}
          editingContent={editingNestedBlockContent}
          editingAvatar={editingNestedBlockAvatar}
          showAvatarPicker={showNestedAvatarPicker}
          characterAvatarHistory={characterAvatarHistory}
          marginClass="mb-1.5"
          onClick={() => {
            if (isMultiSelectMode) {
              onSetSelectedNestedKeys(prev => {
                const next = new Set(prev);
                next.has(nestedKey) ? next.delete(nestedKey) : next.add(nestedKey);
                return next;
              });
            }
          }}
          onDoubleClick={() => !isEditing && !isMultiSelectMode && startEdit()}
          onCheckboxChange={() => onSetSelectedNestedKeys(prev => {
            const next = new Set(prev);
            next.has(nestedKey) ? next.delete(nestedKey) : next.add(nestedKey);
            return next;
          })}
          onSaveEditing={onSaveNestedContentEditing}
          onCancelEditing={() => onSetEditingNestedContent(null)}
          onSetEditingCharacter={onSetEditingNestedBlockCharacter}
          onSetEditingContent={onSetEditingNestedBlockContent}
          onSetEditingAvatar={onSetEditingNestedBlockAvatar}
          onSetShowAvatarPicker={onSetShowNestedAvatarPicker}
          renderActionButtons={renderNestedActionButtons}
          extractedFrames={extractedFrames}
          onDeleteFrames={onDeleteFrames}
          onJumpToTime={onJumpToTime}
          activeVideo={activeVideo}
          videoSrc={videoSrc}
          sharedVideoRef={sharedVideoRef}
          roi={roi}
          onCaptureFrame={onCaptureFrame}
          itemRef={(el) => { blockRefs.current[fakeKey] = el; }}
        />
      );
    }
    return null;
  };

  return (
    <div
      ref={(el) => { blockRefs.current[`${currentChapterIndex}-${index}`] = el; }}
      className=""
    >
      {/* 选项按钮列表 */}
      <div className="flex flex-col gap-1.5 mb-2">
        {opts.map((opt) => {
          const isSelected = selectedShowIndex === opt.showIndex;
          const isOptHighlighted =
            nestedHighlight?.blockIndex === index &&
            nestedHighlight?.showIndex === opt.showIndex &&
            nestedHighlight?.bi === undefined;
          return (
            <div key={opt.showIndex} className="flex items-center gap-1.5">
              <div
                className={`flex-1 flex items-center cursor-pointer transition-colors text-sm select-none rounded-lg border
                  ${isOptHighlighted ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-[#c8c0b0]'}
                  ${isSelected ? 'bg-[#f5e6c8] text-[#5d3920]' : 'bg-[#fdf6ec] text-[#7a6040] hover:bg-[#f5e6c8]'}`}
                onClick={() => onSetNestedSelectedOption(prev => ({
                  ...prev,
                  [index]: prev[index] === opt.showIndex ? null : opt.showIndex,
                }))}
              >
                <span
                  className="flex-1 py-2.5 px-4"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onSetEditingNestedLabel2({ blockIndex: index, showIndex: opt.showIndex });
                    onSetEditingNestedLabelValue(opt.label);
                  }}
                >
                  {editingNestedLabel2?.blockIndex === index && editingNestedLabel2?.showIndex === opt.showIndex ? (
                    <input
                      autoFocus
                      value={editingNestedLabelValue}
                      onChange={(e) => onSetEditingNestedLabelValue(e.target.value)}
                      onBlur={() => {
                        onUpdateNestedGroup(index, opts => opts.map(o => o.showIndex === opt.showIndex ? { ...o, label: editingNestedLabelValue } : o));
                        onSetEditingNestedLabel2(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onUpdateNestedGroup(index, opts => opts.map(o => o.showIndex === opt.showIndex ? { ...o, label: editingNestedLabelValue } : o));
                          onSetEditingNestedLabel2(null);
                        } else if (e.key === 'Escape') {
                          onSetEditingNestedLabel2(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-transparent outline-none border-b border-amber-400 text-sm"
                    />
                  ) : opt.label}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateNestedGroup(index, opts => {
                      const next = opts.length + 1;
                      return [...opts, { label: `选项${next}`, showIndex: next, blocks: [] }];
                    });
                  }}
                  className="px-2 py-1 text-xs text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors mr-1"
                  title="添加选项"
                >＋</button>
                {opts.length > 1 && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await showConfirm({ title: '确认删除', message: `确定要删除「${opt.label}」选项及其内容吗？` });
                      if (ok) onDeleteNestedOption(index, opt.showIndex);
                    }}
                    className="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors mr-1"
                    title="删除此选项"
                  >✕</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 选中选项的内容块 */}
      {selectedOpt && (
        <div className="pl-3 border-l-2 border-[#e0d8cc] mb-2">
          <div className="flex justify-end gap-1.5 mb-2">
            {isRawEditing ? (
              <>
                <button
                  onClick={saveRawEditing}
                  className="px-2.5 py-1 text-xs text-white bg-green-600 hover:bg-green-700 rounded border border-green-700 transition-colors"
                >保存原文</button>
                <button
                  onClick={() => {
                    setIsRawEditing(false);
                    setRawEditingText('');
                  }}
                  className="px-2.5 py-1 text-xs text-white bg-gray-500 hover:bg-gray-600 rounded border border-gray-600 transition-colors"
                >取消</button>
              </>
            ) : (
              <button
                onClick={startRawEditing}
                className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-300 transition-colors"
              >编辑原文</button>
            )}
          </div>
          {isRawEditing ? (
            <div className="space-y-1.5 mb-2">
              <textarea
                value={rawEditingText}
                onChange={(e) => setRawEditingText(e.target.value)}
                className="w-full min-h-[140px] px-3 py-2 border border-amber-300 rounded-lg text-xs font-mono resize-vertical bg-white text-gray-900"
                placeholder="直接编辑当前嵌套分歧选项对应的模板原文，例如：{{对话|角色|内容}}"
              />
              <div className="text-[11px] text-gray-500">{'支持直接粘贴 {{旁白}}、{{对话}}、{{分歧}}、{{嵌套分歧}} 模板。'}</div>
            </div>
          ) : (
            <>
              {selectedOpt.blocks.length === 0
                ? <div className="px-4 py-2 text-xs text-gray-400 italic">（此选项暂无内容）</div>
                : selectedOpt.blocks.map((b, bi) => renderContentBlock(b, bi, selectedOpt.showIndex))
              }
              <div className="flex justify-end gap-1.5 mt-1">
                <button
                  onClick={() => onInsertNestedContentBlock(index, selectedOpt.showIndex, 'narration')}
                  className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded border border-gray-300 transition-colors"
                >＋ 旁白</button>
                <button
                  onClick={() => onInsertNestedContentBlock(index, selectedOpt.showIndex, 'dialogue')}
                  className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded border border-gray-300 transition-colors"
                >＋ 对话</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 底部操作 */}
      <div className="flex items-center justify-end gap-1.5 mt-1.5">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const menu = document.getElementById(`nested-insert-menu-${index}`);
              if (menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
            }}
            className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded border border-gray-300 transition-colors"
          >＋ 插入</button>
          <div
            id={`nested-insert-menu-${index}`}
            className="absolute right-0 top-7 bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex-col gap-1 z-10 min-w-[130px]"
            style={{ display: 'none' }}
            onClick={(e) => e.stopPropagation()}
          >
            {(['narration', 'narration-thought', 'dialogue', 'nested-choice-group'] as const).map(t => (
              <button
                key={t}
                onClick={() => {
                  onInsertBlock(index, t);
                  const menu = document.getElementById(`nested-insert-menu-${index}`);
                  if (menu) menu.style.display = 'none';
                }}
                className={`w-full px-3 py-2 text-xs text-left rounded transition-colors ${t === 'nested-choice-group' ? 'text-purple-700 hover:bg-purple-50' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                {t === 'narration' ? '插入普通旁白' : t === 'narration-thought' ? '插入心理旁白' : t === 'dialogue' ? '插入对话' : '插入嵌套分歧'}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={async () => {
            const ok = await showConfirm({ title: '确认删除', message: '确定要删除整个嵌套分歧吗？' });
            if (ok) onDeleteBlock(index);
          }}
          className="px-2.5 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors"
        >删除嵌套分歧</button>
      </div>
    </div>
  );
};

export default NestedChoiceGroup;
