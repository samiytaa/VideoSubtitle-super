import React, { useEffect, useRef, useState } from 'react';
import { getAvatarPath } from '../utils/avatarMap';
import { useNotifier } from './Notifications';
import { ParsedBlock, Chapter } from './textEditorProofreader/types';
import { parseText, regenerateInputText, getCharacterColor } from './textEditorProofreader/textParserUtils';
import ChoiceBlock from './textEditorProofreader/ChoiceBlock';
import NestedChoiceGroup from './textEditorProofreader/NestedChoiceGroup';
import InputPanel from './textEditorProofreader/InputPanel';
import ChapterNavigator from './textEditorProofreader/ChapterNavigator';
import { useLocalStorageState } from './textEditorProofreader/useLocalStorageState';
import { useScrollPersistence } from './textEditorProofreader/useScrollPersistence';
import { useEditorUiState } from './textEditorProofreader/useEditorUiState';
import PreviewToolbar from './textEditorProofreader/PreviewToolbar';
import EditorModals from './textEditorProofreader/EditorModals';
import ChapterPreview from './textEditorProofreader/ChapterPreview';
import { STORAGE_KEYS } from './textEditorProofreader/storageKeys';
import { useEditorSearch } from './textEditorProofreader/useEditorSearch';
import { useBulkAvatarActions } from './textEditorProofreader/useBulkAvatarActions';
import { ExtractedFrame, VideoFile, ROI } from '../types';

interface TextEditorProofreaderProps {
  extractedFrames?: ExtractedFrame[];
  onDeleteFrames?: (ids: string[]) => void;
  onJumpToTime?: (timestamp: string) => void;
  activeVideo?: VideoFile | null;
  videoSrc?: string | null;
  sharedVideoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  roi?: ROI | null;
  onCaptureFrame?: (frame: ExtractedFrame) => void;
}

const TextEditorProofreader: React.FC<TextEditorProofreaderProps> = ({
  extractedFrames = [],
  onDeleteFrames,
  onJumpToTime,
  activeVideo,
  videoSrc,
  sharedVideoRef,
  roi,
  onCaptureFrame
}) => {
  const { addToast, showConfirm, showAlert } = useNotifier();
  const [inputText, setInputText, inputStorage] = useLocalStorageState<string>(STORAGE_KEYS.inputText, '', {
    serialize: (value) => value,
    deserialize: (raw) => raw
  });
  const [chapters, setChapters] = useLocalStorageState<Chapter[]>(STORAGE_KEYS.chapters, []);
  const [currentChapterIndex, setCurrentChapterIndex] = useLocalStorageState<number>(STORAGE_KEYS.currentChapterIndex, 0);
  const [characterName, setCharacterName] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const {
    editingBlockIndex,
    editingContent,
    editingCharacter,
    editingAvatar,
    editingNarrationType,
    editingChoiceBlockIndex,
    editingChoiceOptions,
    editingNestedIndex,
    editingNestedLabel,
    nestedSelectedOption,
    nestedHighlight,
    editingNestedContent,
    editingNestedBlockContent,
    editingNestedBlockCharacter,
    editingNestedBlockNarrationType,
    editingNestedBlockAvatar,
    editingSubBlock,
    editingSubContent,
    editingSubCharacter,
    editingSubAvatar,
    editingSubNarrationType,
    choiceSelectedOption,
    editingNestedLabel2,
    editingNestedLabelValue,
    isMultiSelectMode,
    selectedBlockIndices,
    selectedNestedKeys,
    searchKeyword,
    searchResults,
    selectedCharacterName,
    showAvatarPicker,
    showNestedAvatarPicker,
    showSubAvatarPicker,
    showBatchAvatarPicker,
    showSearchDialog,
    showQuickReplaceDialog,
    startBlockEdit,
    cancelBlockEdit,
    resetEditingScopes,
    setEditingContent,
    setEditingCharacter,
    setEditingAvatar,
    setEditingNarrationType,
    setEditingChoiceBlockIndex,
    setEditingChoiceOptions,
    setEditingNestedIndex,
    setEditingNestedLabel,
    setNestedSelectedOption,
    setNestedHighlight,
    setEditingNestedContent,
    setEditingNestedBlockContent,
    setEditingNestedBlockCharacter,
    setEditingNestedBlockNarrationType,
    setEditingNestedBlockAvatar,
    setEditingSubBlock,
    setEditingSubContent,
    setEditingSubCharacter,
    setEditingSubAvatar,
    setEditingSubNarrationType,
    setChoiceSelectedOption,
    setEditingNestedLabel2,
    setEditingNestedLabelValue,
    setIsMultiSelectMode,
    setSelectedBlockIndices,
    setSelectedNestedKeys,
    clearSelections,
    enterMultiSelect,
    exitMultiSelect,
    setSearchKeyword,
    setSearchResults,
    setSelectedCharacterName,
    setShowAvatarPicker,
    setShowNestedAvatarPicker,
    setShowSubAvatarPicker,
    setShowBatchAvatarPicker,
    setShowSearchDialog,
    setShowQuickReplaceDialog
  } = useEditorUiState();

  // 人名头像历史记录（每个人名保存最近3次使用的头像）
  const [characterAvatarHistory, setCharacterAvatarHistory] = useLocalStorageState<Record<string, string[]>>(STORAGE_KEYS.characterAvatarHistory, {});

  // 输入区域折叠状态（原“左侧折叠”）
  const [isInputCollapsed, setIsInputCollapsed] = useLocalStorageState<boolean>(
    STORAGE_KEYS.leftCollapsed,
    false,
    {
      serialize: (value) => String(value),
      deserialize: (raw) => raw === 'true'
    }
  );

  // 滚动位置引用
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});



  useScrollPersistence(leftScrollRef, rightScrollRef, {
    leftKey: STORAGE_KEYS.leftScroll,
    rightKey: STORAGE_KEYS.rightScroll,
    saveDeps: [chapters.length, isInputCollapsed],
    restoreDeps: [chapters, currentChapterIndex]
  });

  useEffect(() => {
    if (chapters.length === 0) return;
    if (!characterName) {
      setCharacterName(chapters[0].character);
    }
    if (currentChapterIndex < 0 || currentChapterIndex >= chapters.length) {
      setCurrentChapterIndex(0);
    }
  }, [chapters, currentChapterIndex, characterName, setCurrentChapterIndex]);
  const chapterRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const getUpdatedChapters = () => [...chapters];

  const createNewBlock = (
    type: 'narration' | 'narration-thought' | 'dialogue' | 'nested-choice-group'
  ): ParsedBlock => {
    if (type === 'nested-choice-group') {
      return {
        type: 'nested-choice-group',
        content: '',
        nestedOptions: [
          { label: '选项1', showIndex: 1, blocks: [] },
          { label: '选项2', showIndex: 2, blocks: [] }
        ]
      };
    }
    if (type === 'dialogue') {
      return { type: 'dialogue', content: '新对话内容', character: '角色名', avatarStyle: '' };
    }
    return { type, content: '新旁白内容' };
  };

  const pushAvatarHistory = (targetCharacter: string, avatarName: string) => {
    if (!targetCharacter || !avatarName) return;
    setCharacterAvatarHistory(prev => {
      const history = prev[targetCharacter] || [];
      const newHistory = [avatarName, ...history.filter(a => a !== avatarName)].slice(0, 3);
      return { ...prev, [targetCharacter]: newHistory };
    });
  };

  const commitChapters = (nextChapters: Chapter[]) => {
    setChapters(nextChapters);
    setInputText(regenerateInputText(nextChapters));
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
  };

  const handleStartProofreading = () => {
    if (!inputText.trim()) {
      addToast('请先输入文本', 'error');
      return;
    }

    // 如果存在嵌套分歧，确保 {{JS|Qiantao.js}} 在最前面
    let processedText = inputText;
    if (processedText.includes('{{嵌套分歧|')) {
      const jsTag = '{{JS|Qiantao.js}}';
      processedText = processedText.replace(jsTag, '');
      processedText = jsTag + processedText;
      if (processedText !== inputText) {
        setInputText(processedText);
      }
    }

    const parsedChapters = parseText(processedText);
    setChapters(parsedChapters);

    // 设置角色名
    if (parsedChapters.length > 0) {
      setCharacterName(parsedChapters[0].character);
    }

    setIsInputCollapsed(true);
  };

  const handleCopyText = async () => {
    if (!inputText.trim()) {
      addToast('没有可复制的内容', 'error');
      return;
    }

    try {
      // 将 }} 替换为 }}\n 增加换行符
      const textWithNewlines = inputText.replace(/\}\}/g, '}}\n');
      await navigator.clipboard.writeText(textWithNewlines);
      setCopySuccess(true);
      addToast('复制成功', 'success');
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
      addToast('复制失败，请重试', 'error');
    }
  };

  const setCurrentChapterIndexSafe = (index: number) => {
    if (chapters.length === 0) return;
    const safeIndex = Math.max(0, Math.min(index, chapters.length - 1));
    setCurrentChapterIndex(safeIndex);
  };

  const handleChapterClick = (index: number) => {
    setCurrentChapterIndexSafe(index);
    resetEditingScopes(); // 切换章节时取消编辑

    // 滚动到顶部
    if (rightScrollRef.current) {
      rightScrollRef.current.scrollTop = 0;
    }
  };

  const startEditing = (blockIndex: number, block: ParsedBlock) => {
    startBlockEdit(blockIndex, block);
  };

  const cancelEditing = () => {
    cancelBlockEdit();
  };

  const saveEditing = () => {
    if (editingBlockIndex === null) return;

    const updatedChapters = getUpdatedChapters();
    const currentChapter = updatedChapters[currentChapterIndex];
    const block = currentChapter.blocks[editingBlockIndex];

    // 更新块内容
    block.content = editingContent;
    if (block.type === 'dialogue') {
      block.character = editingCharacter;
      block.avatarStyle = editingAvatar;
    } else if (block.type === 'narration' || block.type === 'narration-thought') {
      // 更新旁白类型
      block.type = editingNarrationType;
    }

    commitChapters(updatedChapters);

    // 更新头像历史记录
    if (block.type === 'dialogue') pushAvatarHistory(editingCharacter, editingAvatar);

    cancelEditing();
  };

  const handleAvatarSelect = (avatarName: string) => {
    setEditingAvatar(avatarName);
    setShowAvatarPicker(false);
  };

  // 删除指定的块
  const deleteBlock = (blockIndex: number) => {
    const updatedChapters = getUpdatedChapters();
    const currentChapter = updatedChapters[currentChapterIndex];

    // 不允许删除 header 和 footer
    const block = currentChapter.blocks[blockIndex];
    if (block.type === 'header' || block.type === 'footer') {
      return;
    }

    // 删除块
    currentChapter.blocks.splice(blockIndex, 1);
    commitChapters(updatedChapters);

    // 如果正在编辑被删除的块，取消编辑
    if (editingBlockIndex === blockIndex) {
      cancelEditing();
    }
  };

  // 在指定位置插入新块
  const insertBlock = (afterIndex: number, blockType: 'narration' | 'narration-thought' | 'dialogue' | 'nested-choice-group') => {
    const updatedChapters = getUpdatedChapters();
    const currentChapter = updatedChapters[currentChapterIndex];

    const newBlock = createNewBlock(blockType);

    currentChapter.blocks.splice(afterIndex + 1, 0, newBlock);
    commitChapters(updatedChapters);

    setTimeout(() => {
      if (blockType !== 'nested-choice-group') {
        startEditing(afterIndex + 1, newBlock);
      }
    }, 100);
  };

  const saveChoiceEditing = () => {
    if (editingChoiceBlockIndex === null) return;
    const updatedChapters = getUpdatedChapters();
    const block = updatedChapters[currentChapterIndex].blocks[editingChoiceBlockIndex];
    block.choiceOptions = editingChoiceOptions.map(o => ({ ...o }));
    commitChapters(updatedChapters);
    setEditingChoiceBlockIndex(null);
  };

  const startSubEditing = (optIdx: number, subIdx: number, sub: ParsedBlock) => {
    setEditingSubBlock({ optIdx, subIdx });
    setEditingSubContent(sub.content);
    setEditingSubCharacter(sub.character || '');
    setEditingSubAvatar(sub.avatarStyle || '');
    setEditingSubNarrationType(sub.type === 'narration-thought' ? 'narration-thought' : 'narration');
  };

  const cancelSubEditing = () => {
    setEditingSubBlock(null);
    setEditingSubContent('');
    setEditingSubCharacter('');
    setEditingSubAvatar('');
    setEditingSubNarrationType('narration');
    setShowSubAvatarPicker(false);
  };

  const saveSubEditing = (choiceBlockIdx: number) => {
    if (!editingSubBlock) return;
    const { optIdx, subIdx } = editingSubBlock;
    const updatedChapters = getUpdatedChapters();
    const block = updatedChapters[currentChapterIndex].blocks[choiceBlockIdx];
    const sub = block.choiceOptions![optIdx].blocks[subIdx];
    sub.content = editingSubContent;
    if (sub.type === 'dialogue') {
      sub.character = editingSubCharacter;
      sub.avatarStyle = editingSubAvatar;
    } else {
      sub.type = editingSubNarrationType;
    }
    commitChapters(updatedChapters);
    cancelSubEditing();
  };

  const deleteSubBlock = (choiceBlockIdx: number, optIdx: number, subIdx: number) => {
    const updatedChapters = getUpdatedChapters();
    updatedChapters[currentChapterIndex].blocks[choiceBlockIdx].choiceOptions![optIdx].blocks.splice(subIdx, 1);
    commitChapters(updatedChapters);
    if (editingSubBlock?.optIdx === optIdx && editingSubBlock?.subIdx === subIdx) cancelSubEditing();
  };

  const insertSubBlock = (choiceBlockIdx: number, optIdx: number, afterSubIdx: number, type: 'narration' | 'narration-thought' | 'dialogue') => {
    const newSub = createNewBlock(type);
    const updatedChapters = getUpdatedChapters();
    updatedChapters[currentChapterIndex].blocks[choiceBlockIdx].choiceOptions![optIdx].blocks.splice(afterSubIdx + 1, 0, newSub);
    commitChapters(updatedChapters);
    setTimeout(() => startSubEditing(optIdx, afterSubIdx + 1, newSub), 50);
  };

  const saveNestedEditing = () => {
    if (editingNestedIndex === null) return;
    const updatedChapters = getUpdatedChapters();
    const block = updatedChapters[currentChapterIndex].blocks[editingNestedIndex];
    block.nestedChoiceLabel = editingNestedLabel;
    commitChapters(updatedChapters);
    setEditingNestedIndex(null);
  };

  const updateNestedGroup = (blockIndex: number, updater: (opts: { label: string; showIndex: number; blocks: ParsedBlock[] }[]) => { label: string; showIndex: number; blocks: ParsedBlock[] }[]) => {
    const updatedChapters = getUpdatedChapters();
    const block = updatedChapters[currentChapterIndex].blocks[blockIndex];
    block.nestedOptions = updater(block.nestedOptions || []);
    commitChapters(updatedChapters);
  };

  const deleteNestedOption = (blockIndex: number, showIndex: number) => {
    updateNestedGroup(blockIndex, opts => {
      const filtered = opts.filter(o => o.showIndex !== showIndex);
      return filtered.map((o, i) => ({ ...o, showIndex: i + 1 }));
    });
    setNestedSelectedOption(prev => ({ ...prev, [blockIndex]: null }));
  };

  const insertNestedContentBlock = (blockIndex: number, showIndex: number, type: 'narration' | 'narration-thought' | 'dialogue') => {
    const newBlock = createNewBlock(type);
    updateNestedGroup(blockIndex, opts =>
      opts.map(o => o.showIndex === showIndex ? { ...o, blocks: [...o.blocks, newBlock] } : o)
    );
  };

  const deleteNestedContentBlock = (blockIndex: number, showIndex: number, bi: number) => {
    updateNestedGroup(blockIndex, opts =>
      opts.map(o => o.showIndex === showIndex ? { ...o, blocks: o.blocks.filter((_, i) => i !== bi) } : o)
    );
  };

  const saveNestedContentEditing = () => {
    if (!editingNestedContent) return;
    const { groupIndex, showIndex, bi } = editingNestedContent;
    updateNestedGroup(groupIndex, opts =>
      opts.map(o => {
        if (o.showIndex !== showIndex) return o;
        const newBlocks = [...o.blocks];
        const b = { ...newBlocks[bi] };
        b.content = editingNestedBlockContent;
        if (b.type === 'dialogue') {
          b.character = editingNestedBlockCharacter;
          b.avatarStyle = editingNestedBlockAvatar;
        } else {
          b.type = editingNestedBlockNarrationType;
        }
        newBlocks[bi] = b;
        return { ...o, blocks: newBlocks };
      })
    );
    pushAvatarHistory(editingNestedBlockCharacter, editingNestedBlockAvatar);
    setEditingNestedContent(null);
  };  // 切换多选模式
  const toggleMultiSelectMode = () => {
    if (isMultiSelectMode) {
      exitMultiSelect();
      return;
    }
    enterMultiSelect();
    clearSelections();
  };

  const bulkActions = useBulkAvatarActions({
    chapters,
    currentChapterIndex,
    selectedBlockIndices,
    selectedNestedKeys,
    characterAvatarHistory,
    setCharacterAvatarHistory,
    commitChapters,
    setShowBatchAvatarPicker,
    clearSelections,
    exitMultiSelect
  });

  const toggleBlockSelection = (blockIndex: number) => bulkActions.toggleBlockSelection(blockIndex, setSelectedBlockIndices);
  const toggleSelectAllDialogues = () => bulkActions.toggleSelectAllDialogues(setSelectedBlockIndices);

  const selectedCount = selectedBlockIndices.size + selectedNestedKeys.size;
  const currentPreviewChapter = chapters[currentChapterIndex];
  const dialogueIndices = currentPreviewChapter
    ? currentPreviewChapter.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.type === 'dialogue')
      .map(({ index }) => index)
    : [];
  const allDialoguesSelected = dialogueIndices.length > 0 && dialogueIndices.every(index => selectedBlockIndices.has(index));

  const handleOpenQuickReplaceDialog = () => {
    const characters = getCurrentChapterCharacters();
    if (characters.length === 0) {
      addToast('当前小节没有对话', 'error');
      return;
    }
    setShowQuickReplaceDialog(true);
  };

  const handleBatchClearAvatarConfirm = async () => {
    const confirmed = await showConfirm({
      title: '确认清空',
      message: `确定要清空选中的 ${selectedCount} 个对话的头像吗？`
    });
    if (confirmed) {
      batchClearAvatar();
    }
  };

  const batchSetAvatar = bulkActions.batchSetAvatar;
  const batchClearAvatar = bulkActions.batchClearAvatar;

  // 获取当前小节中的所有人名（去重）
  const getCurrentChapterCharacters = (): string[] => {
    if (chapters.length === 0) return [];

    const currentChapter = chapters[currentChapterIndex];
    const characters = new Set<string>();

    currentChapter.blocks.forEach(block => {
      if (block.type === 'dialogue' && block.character) {
        characters.add(block.character);
      }
      if (block.type === 'nested-choice-group') {
        (block.nestedOptions || []).forEach(opt => {
          opt.blocks.forEach(b => {
            if (b.type === 'dialogue' && b.character) characters.add(b.character);
          });
        });
      }
    });

    return Array.from(characters).sort();
  };

  // 一键替换指定人名的头像
  const quickReplaceCharacterAvatar = (characterName: string, avatarName: string) => {
    if (!characterName) return;

    const updatedChapters = getUpdatedChapters();
    const currentChapter = updatedChapters[currentChapterIndex];

    let replacedCount = 0;
    currentChapter.blocks.forEach(block => {
      if (block.type === 'dialogue' && block.character === characterName) {
        block.avatarStyle = avatarName;
        replacedCount++;
      }
      if (block.type === 'nested-choice-group') {
        (block.nestedOptions || []).forEach(opt => {
          opt.blocks.forEach(b => {
            if (b.type === 'dialogue' && b.character === characterName) {
              b.avatarStyle = avatarName;
              replacedCount++;
            }
          });
        });
      }
    });

    commitChapters(updatedChapters);

    pushAvatarHistory(characterName, avatarName);

    addToast(`已为 ${replacedCount} 个"${characterName}"的对话设置头像`, 'success');
  };

  // 批量替换多个人名的头像
  const batchReplaceMultipleCharacters = (characterAvatarMap: Record<string, string>) => {
    const updatedChapters = getUpdatedChapters();
    const currentChapter = updatedChapters[currentChapterIndex];

    const replacedCounts: Record<string, number> = {};

    currentChapter.blocks.forEach(block => {
      if (block.type === 'dialogue' && block.character && characterAvatarMap[block.character]) {
        block.avatarStyle = characterAvatarMap[block.character];
        replacedCounts[block.character] = (replacedCounts[block.character] || 0) + 1;
      }
      if (block.type === 'nested-choice-group') {
        (block.nestedOptions || []).forEach(opt => {
          opt.blocks.forEach(b => {
            if (b.type === 'dialogue' && b.character && characterAvatarMap[b.character]) {
              b.avatarStyle = characterAvatarMap[b.character];
              replacedCounts[b.character] = (replacedCounts[b.character] || 0) + 1;
            }
          });
        });
      }
    });

    commitChapters(updatedChapters);

    Object.entries(characterAvatarMap).forEach(([name, avatar]) => {
      pushAvatarHistory(name, avatar);
    });

    setShowQuickReplaceDialog(false);
    setSelectedCharacterName('');

    const summary = Object.entries(replacedCounts)
      .map(([name, count]) => `${name}: ${count}个`)
      .join('\n');
    showAlert(`批量替换完成：\n${summary}`, '替换结果');
  };

  const { handleSearch, jumpToSearchResult } = useEditorSearch({
    chapters,
    setSearchKeyword,
    setSearchResults,
    setCurrentChapterIndexSafe,
    setShowSearchDialog,
    setNestedSelectedOption,
    setNestedHighlight,
    blockRefs
  });

  const renderBlock = (block: ParsedBlock, index: number) => {
    if (block.type === 'header' || block.type === 'footer') {
      return null;
    }

    if (block.type === 'choice') return renderChoiceBlock(block, index);
    if (block.type === 'nested-choice') return null;
    if (block.type === 'nested-choice-group') return renderNestedChoiceGroup(block, index);

    const isEditing = editingBlockIndex === index;
    const blockKey = `${currentChapterIndex}-${index}`;

    if (block.type === 'narration') {
      return (
        <div
          key={index}
          ref={(el) => blockRefs.current[blockKey] = el}
          className={`group relative px-4 py-2.5 mb-1.5 rounded-lg text-sm leading-relaxed cursor-pointer transition-all ${isEditing ? 'ring-2 ring-indigo-500' : ''
            }`}
          style={{
            backgroundColor: '#7b7b77',
            color: '#ffffff'
          }}
          onClick={() => !isEditing && startEditing(index, block)}
          onMouseEnter={(e) => {
            if (!isEditing) {
              e.currentTarget.style.backgroundColor = '#8a8a86';
            }
          }}
          onMouseLeave={(e) => {
            if (!isEditing) {
              e.currentTarget.style.backgroundColor = '#7b7b77';
            }
          }}
        >
          {isEditing ? (
            <div onClick={(e) => e.stopPropagation()} className="space-y-2">
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                className="w-full min-h-[60px] px-3 py-2 border border-white rounded-lg text-sm resize-vertical text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2">
                <button onClick={saveEditing} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">保存</button>
                <button onClick={cancelEditing} className="px-4 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-medium hover:bg-gray-600 transition-colors">取消</button>
              </div>
            </div>
          ) : (
            <>
              {block.content}
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const m = document.getElementById(`narr-convert-menu-${index}`);
                      if (m) m.style.display = m.style.display === 'none' ? 'flex' : 'none';
                    }}
                    className="px-2 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 transition-colors"
                    title="转换类型"
                  >⇄</button>
                  <div
                    id={`narr-convert-menu-${index}`}
                    className="absolute right-0 top-7 bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex-col gap-1 z-20 min-w-[120px]"
                    style={{ display: 'none' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button onClick={() => {
                      const updatedChapters = [...chapters];
                      updatedChapters[currentChapterIndex].blocks[index].type = 'narration-thought';
                      commitChapters(updatedChapters);
                      const m = document.getElementById(`narr-convert-menu-${index}`);
                      if (m) m.style.display = 'none';
                    }} className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors">心理旁白</button>
                    <button onClick={() => {
                      const updatedChapters = [...chapters];
                      const b = updatedChapters[currentChapterIndex].blocks[index];
                      b.type = 'dialogue'; b.character = characterName || '角色名'; b.avatarStyle = '';
                      commitChapters(updatedChapters);
                      const m = document.getElementById(`narr-convert-menu-${index}`);
                      if (m) m.style.display = 'none';
                    }} className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors">对话</button>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const insertMenu = document.getElementById(`insert-menu-${index}`);
                    if (insertMenu) insertMenu.style.display = insertMenu.style.display === 'none' ? 'flex' : 'none';
                  }}
                  className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                  title="插入"
                >＋</button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const confirmed = await showConfirm({ title: '确认删除', message: '确定要删除这条旁白吗？' });
                    if (confirmed) deleteBlock(index);
                  }}
                  className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                  title="删除"
                >✕</button>
              </div>
              {/* 插入菜单 */}
              <div
                id={`insert-menu-${index}`}
                className="absolute right-2 top-10 bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex flex-col gap-1 z-10 min-w-[140px]"
                style={{ display: 'none' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    insertBlock(index, 'narration');
                    const menu = document.getElementById(`insert-menu-${index}`);
                    if (menu) menu.style.display = 'none';
                  }}
                  className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  插入普通旁白
                </button>
                <button
                  onClick={() => {
                    insertBlock(index, 'narration-thought');
                    const menu = document.getElementById(`insert-menu-${index}`);
                    if (menu) menu.style.display = 'none';
                  }}
                  className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  插入心理旁白
                </button>
                <button
                  onClick={() => {
                    insertBlock(index, 'dialogue');
                    const menu = document.getElementById(`insert-menu-${index}`);
                    if (menu) menu.style.display = 'none';
                  }}
                  className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  插入对话
                </button>
                <button
                  onClick={() => {
                    insertBlock(index, 'nested-choice-group');
                    const menu = document.getElementById(`insert-menu-${index}`);
                    if (menu) menu.style.display = 'none';
                  }}
                  className="w-full px-3 py-2 text-xs text-left text-purple-700 hover:bg-purple-50 rounded transition-colors"
                >
                  插入嵌套分歧
                </button>
              </div>
            </>
          )}
        </div>
      );
    }

    if (block.type === 'narration-thought') {
      return (
        <div
          key={index}
          ref={(el) => blockRefs.current[blockKey] = el}
          className={`group relative px-4 py-3 mb-1.5 rounded-lg text-sm leading-relaxed cursor-pointer transition-all ${isEditing ? 'ring-2 ring-indigo-500' : ''
            }`}
          style={{
            backgroundColor: '#7b7b77'
          }}
          onClick={() => !isEditing && startEditing(index, block)}
          onMouseEnter={(e) => {
            if (!isEditing) {
              e.currentTarget.style.backgroundColor = '#8a8a86';
            }
          }}
          onMouseLeave={(e) => {
            if (!isEditing) {
              e.currentTarget.style.backgroundColor = '#7b7b77';
            }
          }}
        >
          <div className="flex items-center mb-1.5">
            <span className="text-base mr-1 font-bold" style={{ color: '#f8e4c2' }}>
              ◆
            </span>
            <span className="font-bold text-sm" style={{ color: '#f8e4c2' }}>
              我
            </span>
          </div>
          {isEditing ? (
            <div onClick={(e) => e.stopPropagation()} className="space-y-2">
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                className="w-full min-h-[60px] px-3 py-2 border border-white rounded-lg text-sm resize-vertical text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2">
                <button onClick={saveEditing} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">保存</button>
                <button onClick={cancelEditing} className="px-4 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-medium hover:bg-gray-600 transition-colors">取消</button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm" style={{ color: '#f8e4c2' }}>
                {block.content}
              </div>
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const m = document.getElementById(`narr-convert-menu-${index}`);
                      if (m) m.style.display = m.style.display === 'none' ? 'flex' : 'none';
                    }}
                    className="px-2 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 transition-colors"
                    title="转换类型"
                  >⇄</button>
                  <div
                    id={`narr-convert-menu-${index}`}
                    className="absolute right-0 top-7 bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex-col gap-1 z-20 min-w-[120px]"
                    style={{ display: 'none' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button onClick={() => {
                      const updatedChapters = [...chapters];
                      updatedChapters[currentChapterIndex].blocks[index].type = 'narration';
                      commitChapters(updatedChapters);
                      const m = document.getElementById(`narr-convert-menu-${index}`);
                      if (m) m.style.display = 'none';
                    }} className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors">普通旁白</button>
                    <button onClick={() => {
                      const updatedChapters = [...chapters];
                      const b = updatedChapters[currentChapterIndex].blocks[index];
                      b.type = 'dialogue'; b.character = '我'; b.avatarStyle = '';
                      commitChapters(updatedChapters);
                      const m = document.getElementById(`narr-convert-menu-${index}`);
                      if (m) m.style.display = 'none';
                    }} className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors">对话</button>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const insertMenu = document.getElementById(`insert-menu-${index}`);
                    if (insertMenu) insertMenu.style.display = insertMenu.style.display === 'none' ? 'flex' : 'none';
                  }}
                  className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                  title="插入"
                >＋</button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const confirmed = await showConfirm({ title: '确认删除', message: '确定要删除这条心理旁白吗？' });
                    if (confirmed) deleteBlock(index);
                  }}
                  className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                  title="删除"
                >✕</button>
              </div>
              {/* 插入菜单 */}
              <div
                id={`insert-menu-${index}`}
                className="absolute right-2 top-10 bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex flex-col gap-1 z-10 min-w-[140px]"
                style={{ display: 'none' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    insertBlock(index, 'narration');
                    const menu = document.getElementById(`insert-menu-${index}`);
                    if (menu) menu.style.display = 'none';
                  }}
                  className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  插入普通旁白
                </button>
                <button
                  onClick={() => {
                    insertBlock(index, 'narration-thought');
                    const menu = document.getElementById(`insert-menu-${index}`);
                    if (menu) menu.style.display = 'none';
                  }}
                  className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  插入心理旁白
                </button>
                <button
                  onClick={() => {
                    insertBlock(index, 'dialogue');
                    const menu = document.getElementById(`insert-menu-${index}`);
                    if (menu) menu.style.display = 'none';
                  }}
                  className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  插入对话
                </button>
                <button
                  onClick={() => {
                    insertBlock(index, 'nested-choice-group');
                    const menu = document.getElementById(`insert-menu-${index}`);
                    if (menu) menu.style.display = 'none';
                  }}
                  className="w-full px-3 py-2 text-xs text-left text-purple-700 hover:bg-purple-50 rounded transition-colors"
                >
                  插入嵌套分歧
                </button>
              </div>
            </>
          )}
        </div>
      );
    }

    if (block.type === 'dialogue') {
      const characterColor = getCharacterColor(block.character || '', block.customColor);
      const isSelected = selectedBlockIndices.has(index);

      return (
        <div
          key={index}
          ref={(el) => blockRefs.current[blockKey] = el}
          className={`group relative bg-white border px-4 py-3 mb-1.5 rounded-lg text-sm leading-relaxed flex gap-3 items-start cursor-pointer transition-all hover:shadow-md ${isEditing ? 'ring-2 ring-indigo-500' : ''
            } ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
          style={{ borderColor: isSelected ? '#3b82f6' : characterColor }}
          onClick={() => {
            if (isMultiSelectMode) {
              toggleBlockSelection(index);
            } else if (!isEditing) {
              startEditing(index, block);
            }
          }}
        >
          {/* 多选复选框 */}
          {isMultiSelectMode && (
            <div
              className="shrink-0 flex items-center"
              onClick={(e) => {
                e.stopPropagation();
                toggleBlockSelection(index);
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleBlockSelection(index)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          )}

          {/* 头像区域 */}
          {block.avatarStyle && !isEditing && (
            <div className="shrink-0 w-[70px] h-[70px] overflow-hidden rounded">
              {(() => {
                const avatarPath = getAvatarPath(block.avatarStyle);
                if (!avatarPath) return null;

                return (
                  <img
                    src={avatarPath}
                    alt={block.character}
                    className="w-[120%] h-[120%] object-cover object-center -translate-x-[8.33%] -translate-y-[8.33%]"
                    onError={(e) => {
                      console.error(`头像加载失败: ${block.avatarStyle}`);
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                );
              })()}
            </div>
          )}

          {/* 对话内容区域 */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div onClick={(e) => e.stopPropagation()} className="space-y-2">
                <div>
                  <div className="flex gap-3 items-start">
                    {/* 左侧：头像预览 */}
                    <div className="shrink-0">
                      {editingAvatar ? (
                        <div
                          className="w-[100px] h-[100px] border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50 cursor-pointer hover:border-blue-500 transition-colors"
                          onClick={() => setShowAvatarPicker(true)}
                          title="点击更换头像"
                        >
                          {(() => {
                            const avatarPath = getAvatarPath(editingAvatar);
                            if (!avatarPath) {
                              return (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                  无效头像
                                </div>
                              );
                            }
                            return (
                              <img
                                src={avatarPath}
                                alt={editingAvatar}
                                className="w-[120%] h-[120%] object-cover object-center -translate-x-[8.33%] -translate-y-[8.33%]"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            );
                          })()}
                        </div>
                      ) : (
                        <div
                          className="w-[100px] h-[100px] border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 cursor-pointer hover:border-blue-500 transition-colors"
                          onClick={() => setShowAvatarPicker(true)}
                          title="点击选择头像"
                        >
                          <span className="text-gray-400 text-xs text-center px-2">未选择<br />头像</span>
                        </div>
                      )}
                    </div>

                    {/* 右侧：操作按钮和输入框 */}
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowAvatarPicker(true)}
                          className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors whitespace-nowrap"
                        >
                          选择头像
                        </button>
                        <button
                          onClick={() => setEditingAvatar('')}
                          className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-medium hover:bg-gray-600 transition-colors whitespace-nowrap"
                        >
                          清空头像
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editingAvatar}
                        onChange={(e) => setEditingAvatar(e.target.value)}
                        placeholder="例如：广陵王-无语"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      {(() => {
                        const history = characterAvatarHistory[editingCharacter] || [];
                        if (history.length === 0) return null;
                        return (
                          <div className="flex gap-1.5 flex-wrap">
                            {history.map((avatarName) => {
                              const p = getAvatarPath(avatarName);
                              if (!p) return null;
                              const isActive = editingAvatar === avatarName;
                              return (
                                <div
                                  key={avatarName}
                                  onClick={() => setEditingAvatar(avatarName)}
                                  title={avatarName}
                                  className={`w-[48px] h-[48px] rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${isActive ? 'border-blue-500' : 'border-gray-300 hover:border-blue-400'}`}
                                >
                                  <img
                                    src={p}
                                    alt={avatarName}
                                    className="w-[120%] h-[120%] object-cover object-center -translate-x-[8.33%] -translate-y-[8.33%]"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block mb-1 text-xs text-gray-600 font-medium">
                    角色名：
                  </label>
                  <input
                    type="text"
                    value={editingCharacter}
                    onChange={(e) => setEditingCharacter(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-gray-600 font-medium">
                    对话内容：
                  </label>
                  <textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    className="w-full min-h-[60px] px-3 py-2 border border-gray-300 rounded-lg text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveEditing}
                    className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                  >
                    保存
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-4 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-medium hover:bg-gray-600 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center mb-1.5">
                  <span
                    className="text-base mr-1 font-bold"
                    style={{ color: characterColor }}
                  >
                    ◆
                  </span>
                  <span className="font-bold text-sm" style={{ color: characterColor }}>
                    {block.character}
                  </span>
                </div>
                <div className="text-gray-700 text-sm leading-relaxed">
                  {block.content}
                </div>
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const updatedChapters = [...chapters];
                      const b = updatedChapters[currentChapterIndex].blocks[index];
                      b.type = 'narration';
                      b.character = undefined;
                      b.avatarStyle = undefined;
                      commitChapters(updatedChapters);
                    }}
                    className="px-2 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 transition-colors"
                    title="转为旁白"
                  >⇄</button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const insertMenu = document.getElementById(`insert-menu-${index}`);
                      if (insertMenu) {
                        insertMenu.style.display = insertMenu.style.display === 'none' ? 'flex' : 'none';
                      }
                    }}
                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                    title="插入"
                  >
                    ＋
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const confirmed = await showConfirm({
                        title: '确认删除',
                        message: '确定要删除这条对话吗？'
                      });
                      if (confirmed) {
                        deleteBlock(index);
                      }
                    }}
                    className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
                {/* 插入菜单 */}
                <div
                  id={`insert-menu-${index}`}
                  className="absolute right-2 top-10 bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex flex-col gap-1 z-10 min-w-[140px]"
                  style={{ display: 'none' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      insertBlock(index, 'narration');
                      const menu = document.getElementById(`insert-menu-${index}`);
                      if (menu) menu.style.display = 'none';
                    }}
                    className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  >
                    插入普通旁白
                  </button>
                  <button
                    onClick={() => {
                      insertBlock(index, 'narration-thought');
                      const menu = document.getElementById(`insert-menu-${index}`);
                      if (menu) menu.style.display = 'none';
                    }}
                    className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  >
                    插入心理旁白
                  </button>
                  <button
                    onClick={() => {
                      insertBlock(index, 'dialogue');
                      const menu = document.getElementById(`insert-menu-${index}`);
                      if (menu) menu.style.display = 'none';
                    }}
                    className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  >
                    插入对话
                  </button>
                  <button
                    onClick={() => {
                      insertBlock(index, 'nested-choice-group');
                      const menu = document.getElementById(`insert-menu-${index}`);
                      if (menu) menu.style.display = 'none';
                    }}
                    className="w-full px-3 py-2 text-xs text-left text-purple-700 hover:bg-purple-50 rounded transition-colors"
                  >
                    插入嵌套分歧
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderChoiceBlock = (block: ParsedBlock, index: number) => {
    const blockKey = `${currentChapterIndex}-${index}`;
    return (
      <ChoiceBlock
        key={index}
        block={block}
        index={index}
        editingChoiceBlockIndex={editingChoiceBlockIndex}
        editingChoiceOptions={editingChoiceOptions}
        editingSubBlock={editingSubBlock}
        editingSubContent={editingSubContent}
        editingSubCharacter={editingSubCharacter}
        editingSubAvatar={editingSubAvatar}
        editingSubNarrationType={editingSubNarrationType}
        showSubAvatarPicker={showSubAvatarPicker}
        choiceSelectedOption={choiceSelectedOption}
        blockRef={(el) => { blockRefs.current[blockKey] = el; }}
        onSetEditingChoiceBlockIndex={setEditingChoiceBlockIndex}
        onSetEditingChoiceOptions={setEditingChoiceOptions}
        onSaveChoiceEditing={saveChoiceEditing}
        onStartSubEditing={startSubEditing}
        onCancelSubEditing={cancelSubEditing}
        onSaveSubEditing={saveSubEditing}
        onDeleteSubBlock={deleteSubBlock}
        onInsertSubBlock={insertSubBlock}
        onDeleteBlock={deleteBlock}
        onSetChoiceSelectedOption={setChoiceSelectedOption}
        onSetEditingSubContent={setEditingSubContent}
        onSetEditingSubCharacter={setEditingSubCharacter}
        onSetEditingSubAvatar={setEditingSubAvatar}
        onSetEditingSubNarrationType={setEditingSubNarrationType}
        onSetShowSubAvatarPicker={setShowSubAvatarPicker}
        onUpdateChoiceOptions={(blockIndex, opts) => {
          const updatedChapters = [...chapters];
          updatedChapters[currentChapterIndex].blocks[blockIndex].choiceOptions = opts;
          commitChapters(updatedChapters);
        }}
        showConfirm={showConfirm}
        extractedFrames={extractedFrames}
        onDeleteFrames={onDeleteFrames}
        onJumpToTime={onJumpToTime}
        activeVideo={activeVideo}
        videoSrc={videoSrc}
        sharedVideoRef={sharedVideoRef}
        roi={roi}
        onCaptureFrame={onCaptureFrame}
      />
    );
  };

  const renderNestedChoiceGroup = (block: ParsedBlock, index: number) => {
    return (
      <NestedChoiceGroup
        key={`nested-group-${index}`}
        block={block}
        index={index}
        currentChapterIndex={currentChapterIndex}
        characterName={characterName}
        nestedSelectedOption={nestedSelectedOption}
        nestedHighlight={nestedHighlight}
        editingNestedContent={editingNestedContent}
        editingNestedBlockContent={editingNestedBlockContent}
        editingNestedBlockCharacter={editingNestedBlockCharacter}
        editingNestedBlockAvatar={editingNestedBlockAvatar}
        editingNestedBlockNarrationType={editingNestedBlockNarrationType}
        showNestedAvatarPicker={showNestedAvatarPicker}
        editingNestedLabel2={editingNestedLabel2}
        editingNestedLabelValue={editingNestedLabelValue}
        isMultiSelectMode={isMultiSelectMode}
        selectedNestedKeys={selectedNestedKeys}
        characterAvatarHistory={characterAvatarHistory}
        blockRefs={blockRefs}
        onSetNestedSelectedOption={setNestedSelectedOption}
        onSetEditingNestedContent={setEditingNestedContent}
        onSetEditingNestedBlockContent={setEditingNestedBlockContent}
        onSetEditingNestedBlockCharacter={setEditingNestedBlockCharacter}
        onSetEditingNestedBlockAvatar={setEditingNestedBlockAvatar}
        onSetEditingNestedBlockNarrationType={setEditingNestedBlockNarrationType}
        onSetShowNestedAvatarPicker={setShowNestedAvatarPicker}
        onSetEditingNestedLabel2={setEditingNestedLabel2}
        onSetEditingNestedLabelValue={setEditingNestedLabelValue}
        onSetSelectedNestedKeys={setSelectedNestedKeys}
        onSaveNestedContentEditing={saveNestedContentEditing}
        onUpdateNestedGroup={updateNestedGroup}
        onDeleteNestedOption={deleteNestedOption}
        onInsertNestedContentBlock={insertNestedContentBlock}
        onDeleteNestedContentBlock={deleteNestedContentBlock}
        onInsertBlock={insertBlock}
        onDeleteBlock={deleteBlock}
        showConfirm={showConfirm}
        extractedFrames={extractedFrames}
        onDeleteFrames={onDeleteFrames}
        onJumpToTime={onJumpToTime}
        activeVideo={activeVideo}
        videoSrc={videoSrc}
        sharedVideoRef={sharedVideoRef}
        roi={roi}
        onCaptureFrame={onCaptureFrame}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <EditorModals
        showSearchDialog={showSearchDialog}
        searchKeyword={searchKeyword}
        searchResults={searchResults}
        chapters={chapters}
        onCloseSearchDialog={() => setShowSearchDialog(false)}
        onSearch={handleSearch}
        onJumpSearchResult={jumpToSearchResult}
        showAvatarPicker={showAvatarPicker}
        onSelectAvatar={handleAvatarSelect}
        onCloseAvatarPicker={() => setShowAvatarPicker(false)}
        editingAvatar={editingAvatar}
        showBatchAvatarPicker={showBatchAvatarPicker}
        onBatchSelectAvatar={batchSetAvatar}
        onCloseBatchAvatarPicker={() => setShowBatchAvatarPicker(false)}
        showNestedAvatarPicker={showNestedAvatarPicker}
        onSelectNestedAvatar={(avatarName) => { setEditingNestedBlockAvatar(avatarName); setShowNestedAvatarPicker(false); }}
        onCloseNestedAvatarPicker={() => setShowNestedAvatarPicker(false)}
        editingNestedBlockAvatar={editingNestedBlockAvatar}
        showQuickReplaceDialog={showQuickReplaceDialog}
        quickReplaceCharacters={getCurrentChapterCharacters()}
        selectedCharacterName={selectedCharacterName}
        onSelectCharacterName={setSelectedCharacterName}
        onQuickReplaceConfirm={(avatarName) => quickReplaceCharacterAvatar(selectedCharacterName, avatarName)}
        onQuickReplaceBatchConfirm={batchReplaceMultipleCharacters}
        onCloseQuickReplaceDialog={() => {
          setShowQuickReplaceDialog(false);
          setSelectedCharacterName('');
        }}
        characterAvatarHistory={characterAvatarHistory}
        addToast={addToast}
        extractedFrames={extractedFrames}
        onDeleteFrames={onDeleteFrames}
        onJumpToTime={onJumpToTime}
        activeVideo={activeVideo}
        videoSrc={videoSrc}
        sharedVideoRef={sharedVideoRef}
        roi={roi}
        onCaptureFrame={onCaptureFrame}
      />

      <InputPanel
        isCollapsed={isInputCollapsed}
        inputText={inputText}
        copySuccess={copySuccess}
        leftScrollRef={leftScrollRef}
        onExpand={() => setIsInputCollapsed(false)}
        onCopy={handleCopyText}
        onClear={async () => {
          const confirmed = await showConfirm({
            title: '确认清空',
            message: '确定要清空文本吗？'
          });
          if (confirmed) {
            inputStorage.clear();
            setChapters([]);
          }
        }}
        onStartProofreading={handleStartProofreading}
        onTextChange={handleTextChange}
      />

      {chapters.length > 0 && chapters[0].format !== 'general' && (
        <ChapterNavigator
          chapters={chapters}
          currentChapterIndex={currentChapterIndex}
          onChapterClick={handleChapterClick}
        />
      )}

      {/* 预览区域 */}
      {chapters.length > 0 && (
        <div className="flex-1 min-h-0 flex flex-col">
          <PreviewToolbar
            isMultiSelectMode={isMultiSelectMode}
            selectedCount={selectedCount}
            allDialoguesSelected={allDialoguesSelected}
            onOpenSearch={() => setShowSearchDialog(true)}
            onOpenQuickReplace={handleOpenQuickReplaceDialog}
            onToggleMultiSelectMode={toggleMultiSelectMode}
            onToggleSelectAllDialogues={toggleSelectAllDialogues}
            onOpenBatchAvatarPicker={() => setShowBatchAvatarPicker(true)}
            onBatchClearAvatarConfirm={handleBatchClearAvatarConfirm}
          />

          <div ref={rightScrollRef} className="flex-1 min-h-0 overflow-y-auto pt-4">
            <ChapterPreview
              chapter={chapters[currentChapterIndex]}
              chapterIndex={currentChapterIndex}
              chapters={chapters}
              currentChapterIndex={currentChapterIndex}
              onChapterClick={handleChapterClick}
              renderBlock={(index) => renderBlock(chapters[currentChapterIndex].blocks[index], index)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TextEditorProofreader;
