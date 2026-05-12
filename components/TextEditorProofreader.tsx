import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNotifier } from './Notifications';
import { ParsedBlock, Chapter } from './textEditorProofreader/types';
import { parseText, regenerateInputText } from './textEditorProofreader/textParserUtils';
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
import { produce } from 'immer';
import { EditorBlockContext, EditorBlockContextValue, InsertBlockType } from './textEditorProofreader/context/EditorBlockContext';
import { useMenuState } from './textEditorProofreader/hooks/useMenuState';
import { useBlockOperations } from './textEditorProofreader/hooks/useBlockOperations';
import { DialogueBlockItem, NarrationBlockItem, NarrationThoughtBlockItem } from './textEditorProofreader/components/blocks';
import { handleError } from '../utils/errorHandler';

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
  const {
    activeInsertMenuIndex,
    activeNarrationConvertMenuIndex,
    toggleInsertMenu,
    toggleNarrationConvertMenu,
    closeInsertMenu,
    closeNarrationConvertMenu
  } = useMenuState();

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

  const updateChapters = useCallback((updater: (draft: Chapter[]) => void) => {
    const nextChapters = produce(chapters, updater);
    commitChapters(nextChapters);
  }, [chapters]);

  const updateCurrentChapter = useCallback((updater: (blocks: ParsedBlock[]) => void) => {
    updateChapters((draft) => {
      if (!draft[currentChapterIndex]) return;
      updater(draft[currentChapterIndex].blocks);
    });
  }, [updateChapters, currentChapterIndex]);

  const updateBlock = useCallback((blockIndex: number, updater: (block: ParsedBlock) => void) => {
    updateCurrentChapter((blocks) => {
      if (!blocks[blockIndex]) return;
      updater(blocks[blockIndex]);
    });
  }, [updateCurrentChapter]);

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
      handleError(err, { addToast }, {
        context: '复制失败',
        userMessage: '复制失败，请重试',
      });
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
    let editedBlockType: ParsedBlock['type'] | null = null;

    // 更新块内容
    updateBlock(editingBlockIndex, (block) => {
      block.content = editingContent;
      editedBlockType = block.type;
      if (block.type === 'dialogue') {
        block.character = editingCharacter;
        block.avatarStyle = editingAvatar;
      } else if (block.type === 'narration' || block.type === 'narration-thought') {
        block.type = editingNarrationType;
      }
    });

    // 更新头像历史记录
    if (editedBlockType === 'dialogue') pushAvatarHistory(editingCharacter, editingAvatar);

    cancelEditing();
  };

  const handleAvatarSelect = (avatarName: string) => {
    setEditingAvatar(avatarName);
    setShowAvatarPicker(false);
  };

  // 删除指定的块
  const deleteBlock = (blockIndex: number) => {
    const block = chapters[currentChapterIndex]?.blocks[blockIndex];
    if (!block) return;
    // 不允许删除 header 和 footer
    if (block.type === 'header' || block.type === 'footer') {
      return;
    }
    updateCurrentChapter((blocks) => {
      blocks.splice(blockIndex, 1);
    });

    // 如果正在编辑被删除的块，取消编辑
    if (editingBlockIndex === blockIndex) {
      cancelEditing();
    }
  };

  // 在指定位置插入新块
  const insertBlock = (afterIndex: number, blockType: 'narration' | 'narration-thought' | 'dialogue' | 'nested-choice-group') => {
    const newBlock = createNewBlock(blockType);
    updateCurrentChapter((blocks) => {
      blocks.splice(afterIndex + 1, 0, newBlock);
    });

    setTimeout(() => {
      if (blockType !== 'nested-choice-group') {
        startEditing(afterIndex + 1, newBlock);
      }
    }, 100);
  };

  const insertBlockFromMenu = useCallback((index: number, type: InsertBlockType) => {
    insertBlock(index, type);
    closeInsertMenu();
  }, [insertBlock, closeInsertMenu]);

  const saveChoiceEditing = () => {
    if (editingChoiceBlockIndex === null) return;
    updateBlock(editingChoiceBlockIndex, (block) => {
      if (block.type !== 'choice') return;
      block.choiceOptions = editingChoiceOptions.map(o => ({ ...o }));
    });
    setEditingChoiceBlockIndex(null);
  };

  const startSubEditing = (optIdx: number, subIdx: number, sub: ParsedBlock) => {
    setEditingSubBlock({ optIdx, subIdx });
    setEditingSubContent(sub.content);
    setEditingSubCharacter(sub.type === 'dialogue' ? sub.character : '');
    setEditingSubAvatar(sub.type === 'dialogue' ? sub.avatarStyle : '');
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
    updateBlock(choiceBlockIdx, (block) => {
      if (block.type !== 'choice') return;
      const sub = block.choiceOptions[optIdx]?.blocks[subIdx];
      if (!sub) return;
      sub.content = editingSubContent;
      if (sub.type === 'dialogue') {
        sub.character = editingSubCharacter;
        sub.avatarStyle = editingSubAvatar;
      } else {
        sub.type = editingSubNarrationType;
      }
    });
    cancelSubEditing();
  };

  const deleteSubBlock = (choiceBlockIdx: number, optIdx: number, subIdx: number) => {
    updateBlock(choiceBlockIdx, (block) => {
      if (block.type !== 'choice') return;
      block.choiceOptions[optIdx]?.blocks.splice(subIdx, 1);
    });
    if (editingSubBlock?.optIdx === optIdx && editingSubBlock?.subIdx === subIdx) cancelSubEditing();
  };

  const insertSubBlock = (choiceBlockIdx: number, optIdx: number, afterSubIdx: number, type: 'narration' | 'narration-thought' | 'dialogue') => {
    const newSub = createNewBlock(type);
    updateBlock(choiceBlockIdx, (block) => {
      if (block.type !== 'choice') return;
      block.choiceOptions[optIdx]?.blocks.splice(afterSubIdx + 1, 0, newSub);
    });
    setTimeout(() => startSubEditing(optIdx, afterSubIdx + 1, newSub), 50);
  };

  const updateNestedGroup = (blockIndex: number, updater: (opts: { label: string; showIndex: number; blocks: ParsedBlock[] }[]) => { label: string; showIndex: number; blocks: ParsedBlock[] }[]) => {
    updateBlock(blockIndex, (block) => {
      if (block.type !== 'nested-choice-group') return;
      block.nestedOptions = updater(block.nestedOptions || []);
    });
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

    let replacedCount = 0;
    updateCurrentChapter((blocks) => {
      blocks.forEach(block => {
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
    });

    pushAvatarHistory(characterName, avatarName);

    addToast(`已为 ${replacedCount} 个"${characterName}"的对话设置头像`, 'success');
  };

  // 批量替换多个人名的头像
  const batchReplaceMultipleCharacters = (characterAvatarMap: Record<string, string>) => {
    const replacedCounts: Record<string, number> = {};
    updateCurrentChapter((blocks) => {
      blocks.forEach(block => {
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
    });

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

  const blockRenderers = useMemo(() => ({
    narration: (block: Extract<ParsedBlock, { type: 'narration' }>, index: number, blockKey: string) =>
      <NarrationBlockItem key={blockKey} block={block} index={index} blockKey={blockKey} />,
    'narration-thought': (block: Extract<ParsedBlock, { type: 'narration-thought' }>, index: number, blockKey: string) =>
      <NarrationThoughtBlockItem key={blockKey} block={block} index={index} blockKey={blockKey} />,
    dialogue: (block: Extract<ParsedBlock, { type: 'dialogue' }>, index: number, blockKey: string) =>
      <DialogueBlockItem key={blockKey} block={block} index={index} blockKey={blockKey} />,
    choice: (block: Extract<ParsedBlock, { type: 'choice' }>, index: number) =>
      renderChoiceBlock(block, index),
    'nested-choice-group': (block: Extract<ParsedBlock, { type: 'nested-choice-group' }>, index: number) =>
      renderNestedChoiceGroup(block, index)
  }), [renderChoiceBlock, renderNestedChoiceGroup]);

  const renderBlock = useCallback((block: ParsedBlock, index: number) => {
    if (block.type === 'header' || block.type === 'footer' || block.type === 'nested-choice') return null;

    const blockKey = `${currentChapterIndex}-${index}`;
    const renderer = blockRenderers[block.type as keyof typeof blockRenderers];
    if (!renderer) return null;

    return renderer(block as never, index, blockKey);
  }, [blockRenderers, currentChapterIndex]);

  function renderChoiceBlock(block: ParsedBlock, index: number) {
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
          updateBlock(blockIndex, (block) => {
            if (block.type !== 'choice') return;
            block.choiceOptions = opts;
          });
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
  }

  function renderNestedChoiceGroup(block: ParsedBlock, index: number) {
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
  }

  const blockActions = useBlockOperations({
    blockRefs,
    startEditing,
    setEditingContent,
    setEditingCharacter,
    setEditingAvatar,
    setShowAvatarPicker,
    saveEditing,
    cancelEditing,
    toggleNarrationConvertMenu,
    toggleInsertMenu,
    closeInsertMenu,
    insertBlockFromMenu,
    toggleBlockSelection,
    showConfirm,
    deleteBlock,
    updateBlock,
    closeNarrationConvertMenu,
    characterName
  });

  const editorBlockContextValue = useMemo<EditorBlockContextValue>(() => ({
    editingState: {
      blockIndex: editingBlockIndex,
      content: editingContent,
      character: editingCharacter,
      avatar: editingAvatar,
      isMultiSelectMode,
      selectedBlockIndices
    },
    menuState: {
      activeInsertMenuIndex,
      activeNarrationConvertMenuIndex
    },
    resources: {
      chapters,
      currentChapterIndex,
      characterName,
      characterAvatarHistory
    },
    actions: blockActions
  }), [
    editingBlockIndex, editingContent, editingCharacter, editingAvatar, isMultiSelectMode, selectedBlockIndices,
    activeInsertMenuIndex, activeNarrationConvertMenuIndex, chapters, currentChapterIndex, characterName,
    characterAvatarHistory, blockActions
  ]);

  return (
    <EditorBlockContext.Provider value={editorBlockContextValue}>
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
              scrollContainerRef={rightScrollRef}
              onChapterClick={handleChapterClick}
              renderBlock={(index) => renderBlock(chapters[currentChapterIndex].blocks[index], index)}
            />
          </div>
        </div>
        )}
      </div>
    </EditorBlockContext.Provider>
  );
};

export default TextEditorProofreader;
