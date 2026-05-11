import React, { useEffect, useRef, useState } from 'react';
import { getAvatarPath } from '../utils/avatarMap';
import AvatarPicker from './AvatarPicker';
import { useNotifier } from './Notifications';
import { ParsedBlock, Chapter } from './textProofreader2/types';
import { parseText, regenerateInputText, getCharacterColor } from './textProofreader2/textParserUtils';
import ChoiceBlock from './textProofreader2/ChoiceBlock';
import NestedChoiceGroup from './textProofreader2/NestedChoiceGroup';
import QuickReplaceDialog from './textProofreader2/QuickReplaceDialog';
import { ExtractedFrame, VideoFile, ROI } from '../types';

interface TextProofreader2Props {
  extractedFrames?: ExtractedFrame[];
  onDeleteFrames?: (ids: string[]) => void;
  onJumpToTime?: (timestamp: string) => void;
  activeVideo?: VideoFile | null;
  videoSrc?: string | null;
  sharedVideoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  roi?: ROI | null;
  onCaptureFrame?: (frame: ExtractedFrame) => void;
}

const TextProofreader2: React.FC<TextProofreader2Props> = ({
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
  const [inputText, setInputText] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(() => {
    const saved = localStorage.getItem('textProofreader_currentChapterIndex');
    return saved ? Number(saved) : 0;
  });
  const [characterName, setCharacterName] = useState('');
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingCharacter, setEditingCharacter] = useState('');
  const [editingAvatar, setEditingAvatar] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [editingNarrationType, setEditingNarrationType] = useState<'narration' | 'narration-thought'>('narration');

  // 分歧编辑状态
  const [editingChoiceBlockIndex, setEditingChoiceBlockIndex] = useState<number | null>(null);
  const [editingChoiceOptions, setEditingChoiceOptions] = useState<{ label: string; blocks: ParsedBlock[] }[]>([]);
  // 嵌套分歧编辑状态（item 类型）
  const [editingNestedIndex, setEditingNestedIndex] = useState<number | null>(null);
  const [editingNestedLabel, setEditingNestedLabel] = useState('');
  // 嵌套分歧选中选项状态：key = headBlockIndex, value = 选中的 item blockIndex（null = 未选）
  const [nestedSelectedOption, setNestedSelectedOption] = useState<Record<number, number | null>>({});
  // 嵌套分歧高亮状态（搜索跳转用）
  const [nestedHighlight, setNestedHighlight] = useState<{ blockIndex: number; showIndex: number; bi?: number } | null>(null);
  // 嵌套分歧内容块编辑状态
  const [editingNestedContent, setEditingNestedContent] = useState<{ groupIndex: number; showIndex: number; bi: number } | null>(null);
  const [editingNestedBlockContent, setEditingNestedBlockContent] = useState('');
  const [editingNestedBlockCharacter, setEditingNestedBlockCharacter] = useState('');
  const [editingNestedBlockNarrationType, setEditingNestedBlockNarrationType] = useState<'narration' | 'narration-thought'>('narration');
  const [editingNestedBlockAvatar, setEditingNestedBlockAvatar] = useState('');
  const [showNestedAvatarPicker, setShowNestedAvatarPicker] = useState(false);
  // 分歧内部 sub-block 编辑状态
  const [editingSubBlock, setEditingSubBlock] = useState<{ optIdx: number; subIdx: number } | null>(null);
  const [editingSubContent, setEditingSubContent] = useState('');
  const [editingSubCharacter, setEditingSubCharacter] = useState('');
  const [editingSubAvatar, setEditingSubAvatar] = useState('');
  const [editingSubNarrationType, setEditingSubNarrationType] = useState<'narration' | 'narration-thought'>('narration');
  const [showSubAvatarPicker, setShowSubAvatarPicker] = useState(false);

  // choice 分歧选中选项状态：key = blockIndex, value = 选中的 optIdx（null = 全部展开）
  const [choiceSelectedOption, setChoiceSelectedOption] = useState<Record<number, number | null>>({});

  // 嵌套分歧选项 label 内联编辑状态
  const [editingNestedLabel2, setEditingNestedLabel2] = useState<{ blockIndex: number; showIndex: number } | null>(null);
  const [editingNestedLabelValue, setEditingNestedLabelValue] = useState('');

  // 多选功能状态
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedBlockIndices, setSelectedBlockIndices] = useState<Set<number>>(new Set());
  const [selectedNestedKeys, setSelectedNestedKeys] = useState<Set<string>>(new Set());
  const [showBatchAvatarPicker, setShowBatchAvatarPicker] = useState(false);

  // 一键替换人名头像功能状态
  const [showQuickReplaceDialog, setShowQuickReplaceDialog] = useState(false);
  const [selectedCharacterName, setSelectedCharacterName] = useState('');

  // 人名头像历史记录（每个人名保存最近3次使用的头像）
  const [characterAvatarHistory, setCharacterAvatarHistory] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('characterAvatarHistory');
    return saved ? JSON.parse(saved) : {};
  });

  // 输入区域折叠状态（原“左侧折叠”）
  const [isInputCollapsed, setIsInputCollapsed] = useState(() => {
    const saved = localStorage.getItem('textProofreader_leftCollapsed');
    return saved === 'true';
  });

  // 滚动位置引用
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  // 搜索功能状态
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    chapterIndex: number;
    blockIndex: number;
    type: 'narration' | 'dialogue' | 'character' | 'nested-option';
    content: string;
    character?: string;
    matchText: string;
    nestedShowIndex?: number;
    nestedBi?: number;
  }>>([]);
  const blockRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // 保存头像历史记录到 localStorage
  useEffect(() => {
    localStorage.setItem('characterAvatarHistory', JSON.stringify(characterAvatarHistory));
  }, [characterAvatarHistory]);

  // 保存左侧折叠状态到 localStorage
  useEffect(() => {
    localStorage.setItem('textProofreader_leftCollapsed', String(isInputCollapsed));
  }, [isInputCollapsed]);

  // 保存当前章节索引到 localStorage
  useEffect(() => {
    localStorage.setItem('textProofreader_currentChapterIndex', String(currentChapterIndex));
  }, [currentChapterIndex]);

  // 保存滚动位置到 localStorage
  useEffect(() => {
    const saveScrollPositions = () => {
      if (leftScrollRef.current) {
        localStorage.setItem('textProofreader_leftScroll', String(leftScrollRef.current.scrollTop));
      }
      if (rightScrollRef.current) {
        localStorage.setItem('textProofreader_rightScroll', String(rightScrollRef.current.scrollTop));
      }
    };

    const leftEl = leftScrollRef.current;
    const rightEl = rightScrollRef.current;

    if (leftEl) {
      leftEl.addEventListener('scroll', saveScrollPositions);
    }
    if (rightEl) {
      rightEl.addEventListener('scroll', saveScrollPositions);
    }

    return () => {
      if (leftEl) {
        leftEl.removeEventListener('scroll', saveScrollPositions);
      }
      if (rightEl) {
        rightEl.removeEventListener('scroll', saveScrollPositions);
      }
    };
  }, [chapters.length, isInputCollapsed]);

  // 恢复滚动位置
  useEffect(() => {
    const leftScroll = localStorage.getItem('textProofreader_leftScroll');
    const rightScroll = localStorage.getItem('textProofreader_rightScroll');

    if (leftScrollRef.current && leftScroll) {
      leftScrollRef.current.scrollTop = Number(leftScroll);
    }
    if (rightScrollRef.current && rightScroll) {
      rightScrollRef.current.scrollTop = Number(rightScroll);
    }
  }, [chapters, currentChapterIndex]);

  // 从 localStorage 加载数据
  useEffect(() => {
    const savedText = localStorage.getItem('textProofreader_inputText');
    if (savedText) {
      setInputText(savedText);
      
      // 检查是否有已保存的章节数据，如果有则自动加载
      const savedChapters = localStorage.getItem('textProofreader_chapters');
      if (savedChapters) {
        try {
          const parsedChapters = JSON.parse(savedChapters);
          setChapters(parsedChapters);

          if (parsedChapters.length > 0) {
            setCharacterName(parsedChapters[0].character);

            // 恢复章节索引，确保不超出范围
            const savedIndex = localStorage.getItem('textProofreader_currentChapterIndex');
            if (savedIndex) {
              const index = Number(savedIndex);
              if (index >= 0 && index < parsedChapters.length) {
                setCurrentChapterIndex(index);
              } else {
                setCurrentChapterIndex(0);
              }
            }
          }
        } catch (e) {
          console.error('加载章节数据失败:', e);
        }
      }
    }
  }, []);

  // 保存输入文本到 localStorage
  useEffect(() => {
    if (inputText) {
      localStorage.setItem('textProofreader_inputText', inputText);
    }
  }, [inputText]);

  // 自动保存章节数据到 localStorage（包含头像信息）
  useEffect(() => {
    if (chapters.length > 0) {
      localStorage.setItem('textProofreader_chapters', JSON.stringify(chapters));
    }
  }, [chapters]);
  const chapterRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

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
    
    // 保存章节数据到 localStorage
    localStorage.setItem('textProofreader_chapters', JSON.stringify(parsedChapters));

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

  const handleChapterClick = (index: number) => {
    setCurrentChapterIndex(index);
    setEditingBlockIndex(null); // 切换章节时取消编辑

    // 滚动到顶部
    if (rightScrollRef.current) {
      rightScrollRef.current.scrollTop = 0;
    }
  };

  const startEditing = (blockIndex: number, block: ParsedBlock) => {
    setEditingBlockIndex(blockIndex);
    setEditingContent(block.content);
    setEditingCharacter(block.character || '');
    setEditingAvatar(block.avatarStyle || '');
    setEditingNarrationType(block.type === 'narration-thought' ? 'narration-thought' : 'narration');
  };

  const cancelEditing = () => {
    setEditingBlockIndex(null);
    setEditingContent('');
    setEditingCharacter('');
    setEditingAvatar('');
    setEditingNarrationType('narration');
    setShowAvatarPicker(false);
  };

  const saveEditing = () => {
    if (editingBlockIndex === null) return;

    const updatedChapters = [...chapters];
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

    setChapters(updatedChapters);

    // 更新头像历史记录
    if (block.type === 'dialogue' && editingAvatar && editingCharacter) {
      setCharacterAvatarHistory(prev => {
        const history = prev[editingCharacter] || [];
        const newHistory = [editingAvatar, ...history.filter(a => a !== editingAvatar)].slice(0, 3);
        return { ...prev, [editingCharacter]: newHistory };
      });
    }

    // 重新生成输入文本
    const newInputText = regenerateInputText(updatedChapters);
    setInputText(newInputText);

    cancelEditing();
  };

  const handleAvatarSelect = (avatarName: string) => {
    setEditingAvatar(avatarName);
    setShowAvatarPicker(false);
  };

  // 删除指定的块
  const deleteBlock = (blockIndex: number) => {
    const updatedChapters = [...chapters];
    const currentChapter = updatedChapters[currentChapterIndex];

    // 不允许删除 header 和 footer
    const block = currentChapter.blocks[blockIndex];
    if (block.type === 'header' || block.type === 'footer') {
      return;
    }

    // 删除块
    currentChapter.blocks.splice(blockIndex, 1);
    setChapters(updatedChapters);

    // 重新生成输入文本
    const newInputText = regenerateInputText(updatedChapters);
    setInputText(newInputText);

    // 如果正在编辑被删除的块，取消编辑
    if (editingBlockIndex === blockIndex) {
      cancelEditing();
    }
  };

  // 在指定位置插入新块
  const insertBlock = (afterIndex: number, blockType: 'narration' | 'narration-thought' | 'dialogue' | 'nested-choice-group') => {
    const updatedChapters = [...chapters];
    const currentChapter = updatedChapters[currentChapterIndex];

    const newBlock: ParsedBlock =
      blockType === 'nested-choice-group'
        ? { type: 'nested-choice-group', content: '', nestedOptions: [{ label: '选项1', showIndex: 1, blocks: [] }, { label: '选项2', showIndex: 2, blocks: [] }] }
        : {
            type: blockType,
            content: blockType === 'dialogue' ? '新对话内容' : '新旁白内容',
            character: blockType === 'dialogue' ? '角色名' : undefined,
            avatarStyle: blockType === 'dialogue' ? '' : undefined
          };

    currentChapter.blocks.splice(afterIndex + 1, 0, newBlock);
    setChapters(updatedChapters);
    setInputText(regenerateInputText(updatedChapters));

    setTimeout(() => {
      if (blockType !== 'nested-choice-group') {
        startEditing(afterIndex + 1, newBlock);
      }
    }, 100);
  };

  const saveChoiceEditing = () => {
    if (editingChoiceBlockIndex === null) return;
    const updatedChapters = [...chapters];
    const block = updatedChapters[currentChapterIndex].blocks[editingChoiceBlockIndex];
    block.choiceOptions = editingChoiceOptions.map(o => ({ ...o }));
    setChapters(updatedChapters);
    setInputText(regenerateInputText(updatedChapters));
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
    const updatedChapters = [...chapters];
    const block = updatedChapters[currentChapterIndex].blocks[choiceBlockIdx];
    const sub = block.choiceOptions![optIdx].blocks[subIdx];
    sub.content = editingSubContent;
    if (sub.type === 'dialogue') {
      sub.character = editingSubCharacter;
      sub.avatarStyle = editingSubAvatar;
    } else {
      sub.type = editingSubNarrationType;
    }
    setChapters(updatedChapters);
    setInputText(regenerateInputText(updatedChapters));
    cancelSubEditing();
  };

  const deleteSubBlock = (choiceBlockIdx: number, optIdx: number, subIdx: number) => {
    const updatedChapters = [...chapters];
    updatedChapters[currentChapterIndex].blocks[choiceBlockIdx].choiceOptions![optIdx].blocks.splice(subIdx, 1);
    setChapters(updatedChapters);
    setInputText(regenerateInputText(updatedChapters));
    if (editingSubBlock?.optIdx === optIdx && editingSubBlock?.subIdx === subIdx) cancelSubEditing();
  };

  const insertSubBlock = (choiceBlockIdx: number, optIdx: number, afterSubIdx: number, type: 'narration' | 'narration-thought' | 'dialogue') => {
    const newSub: ParsedBlock = type === 'dialogue'
      ? { type: 'dialogue', content: '新对话内容', character: '角色名', avatarStyle: '' }
      : { type, content: '新旁白内容' };
    const updatedChapters = [...chapters];
    updatedChapters[currentChapterIndex].blocks[choiceBlockIdx].choiceOptions![optIdx].blocks.splice(afterSubIdx + 1, 0, newSub);
    setChapters(updatedChapters);
    setInputText(regenerateInputText(updatedChapters));
    setTimeout(() => startSubEditing(optIdx, afterSubIdx + 1, newSub), 50);
  };

  const saveNestedEditing = () => {
    if (editingNestedIndex === null) return;
    const updatedChapters = [...chapters];
    const block = updatedChapters[currentChapterIndex].blocks[editingNestedIndex];
    block.nestedChoiceLabel = editingNestedLabel;
    setChapters(updatedChapters);
    setInputText(regenerateInputText(updatedChapters));
    setEditingNestedIndex(null);
  };

  const updateNestedGroup = (blockIndex: number, updater: (opts: { label: string; showIndex: number; blocks: ParsedBlock[] }[]) => { label: string; showIndex: number; blocks: ParsedBlock[] }[]) => {
    const updatedChapters = [...chapters];
    const block = updatedChapters[currentChapterIndex].blocks[blockIndex];
    block.nestedOptions = updater(block.nestedOptions || []);
    setChapters(updatedChapters);
    setInputText(regenerateInputText(updatedChapters));
  };

  const deleteNestedOption = (blockIndex: number, showIndex: number) => {
    updateNestedGroup(blockIndex, opts => {
      const filtered = opts.filter(o => o.showIndex !== showIndex);
      return filtered.map((o, i) => ({ ...o, showIndex: i + 1 }));
    });
    setNestedSelectedOption(prev => ({ ...prev, [blockIndex]: null }));
  };

  const insertNestedContentBlock = (blockIndex: number, showIndex: number, type: 'narration' | 'narration-thought' | 'dialogue') => {
    const newBlock: ParsedBlock = type === 'dialogue'
      ? { type: 'dialogue', content: '新对话内容', character: '角色名', avatarStyle: '' }
      : { type, content: '新旁白内容' };
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
    if (editingNestedBlockAvatar && editingNestedBlockCharacter) {
      setCharacterAvatarHistory(prev => {
        const history = prev[editingNestedBlockCharacter] || [];
        const newHistory = [editingNestedBlockAvatar, ...history.filter(a => a !== editingNestedBlockAvatar)].slice(0, 3);
        return { ...prev, [editingNestedBlockCharacter]: newHistory };
      });
    }
    setEditingNestedContent(null);
  };  // 切换多选模式
  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    setSelectedBlockIndices(new Set());
    setSelectedNestedKeys(new Set());
  };

  // 切换块的选中状态
  const toggleBlockSelection = (blockIndex: number) => {
    const newSelected = new Set(selectedBlockIndices);
    if (newSelected.has(blockIndex)) {
      newSelected.delete(blockIndex);
    } else {
      newSelected.add(blockIndex);
    }
    setSelectedBlockIndices(newSelected);
  };

  // 全选/取消全选对话块
  const toggleSelectAllDialogues = () => {
    const currentChapter = chapters[currentChapterIndex];
    const dialogueIndices = currentChapter.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.type === 'dialogue')
      .map(({ index }) => index);

    const allSelected = dialogueIndices.every(index => selectedBlockIndices.has(index));

    if (allSelected) {
      // 取消全选
      setSelectedBlockIndices(new Set());
    } else {
      // 全选对话
      setSelectedBlockIndices(new Set(dialogueIndices));
    }
  };

  // 批量设置头像
  const batchSetAvatar = (avatarName: string) => {
    const updatedChapters = [...chapters];
    const currentChapter = updatedChapters[currentChapterIndex];

    // 顶层对话块
    selectedBlockIndices.forEach(index => {
      const block = currentChapter.blocks[index];
      if (block.type === 'dialogue') {
        block.avatarStyle = avatarName;
      }
    });

    // 嵌套对话块
    selectedNestedKeys.forEach(key => {
      const [gi, si, bi] = key.split('-').map(Number);
      const groupBlock = currentChapter.blocks[gi];
      if (groupBlock?.type === 'nested-choice-group') {
        const opt = (groupBlock.nestedOptions || []).find(o => o.showIndex === si);
        if (opt && opt.blocks[bi]?.type === 'dialogue') {
          opt.blocks[bi].avatarStyle = avatarName;
        }
      }
    });

    // 更新历史记录（按角色名归类）
    const updatedHistory = { ...characterAvatarHistory };
    const affectedChars = new Set<string>();
    selectedBlockIndices.forEach(index => {
      const block = currentChapter.blocks[index];
      if (block.type === 'dialogue' && block.character) affectedChars.add(block.character);
    });
    selectedNestedKeys.forEach(key => {
      const [gi, si, bi] = key.split('-').map(Number);
      const groupBlock = currentChapter.blocks[gi];
      if (groupBlock?.type === 'nested-choice-group') {
        const opt = (groupBlock.nestedOptions || []).find(o => o.showIndex === si);
        if (opt && opt.blocks[bi]?.type === 'dialogue' && opt.blocks[bi].character) {
          affectedChars.add(opt.blocks[bi].character!);
        }
      }
    });
    affectedChars.forEach(char => {
      const history = updatedHistory[char] || [];
      updatedHistory[char] = [avatarName, ...history.filter(a => a !== avatarName)].slice(0, 3);
    });
    setCharacterAvatarHistory(updatedHistory);

    setChapters(updatedChapters);
    const newInputText = regenerateInputText(updatedChapters);
    setInputText(newInputText);

    setShowBatchAvatarPicker(false);
    setSelectedBlockIndices(new Set());
    setSelectedNestedKeys(new Set());
    setIsMultiSelectMode(false);
  };

  // 批量清空头像
  const batchClearAvatar = () => {
    if (selectedBlockIndices.size === 0 && selectedNestedKeys.size === 0) return;

    const updatedChapters = [...chapters];
    const currentChapter = updatedChapters[currentChapterIndex];

    selectedBlockIndices.forEach(index => {
      const block = currentChapter.blocks[index];
      if (block.type === 'dialogue') block.avatarStyle = '';
    });

    selectedNestedKeys.forEach(key => {
      const [gi, si, bi] = key.split('-').map(Number);
      const groupBlock = currentChapter.blocks[gi];
      if (groupBlock?.type === 'nested-choice-group') {
        const opt = (groupBlock.nestedOptions || []).find(o => o.showIndex === si);
        if (opt && opt.blocks[bi]?.type === 'dialogue') opt.blocks[bi].avatarStyle = '';
      }
    });

    setChapters(updatedChapters);
    const newInputText = regenerateInputText(updatedChapters);
    setInputText(newInputText);

    setSelectedBlockIndices(new Set());
    setSelectedNestedKeys(new Set());
    setIsMultiSelectMode(false);
  };

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

    const updatedChapters = [...chapters];
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

    setChapters(updatedChapters);
    const newInputText = regenerateInputText(updatedChapters);
    setInputText(newInputText);

    const updatedHistory = { ...characterAvatarHistory };
    const history = updatedHistory[characterName] || [];
    const newHistory = [avatarName, ...history.filter(a => a !== avatarName)].slice(0, 3);
    updatedHistory[characterName] = newHistory;
    setCharacterAvatarHistory(updatedHistory);

    addToast(`已为 ${replacedCount} 个"${characterName}"的对话设置头像`, 'success');
  };

  // 批量替换多个人名的头像
  const batchReplaceMultipleCharacters = (characterAvatarMap: Record<string, string>) => {
    const updatedChapters = [...chapters];
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

    setChapters(updatedChapters);
    const newInputText = regenerateInputText(updatedChapters);
    setInputText(newInputText);

    const updatedHistory = { ...characterAvatarHistory };
    Object.entries(characterAvatarMap).forEach(([characterName, avatarName]) => {
      const history = updatedHistory[characterName] || [];
      const newHistory = [avatarName, ...history.filter(a => a !== avatarName)].slice(0, 3);
      updatedHistory[characterName] = newHistory;
    });
    setCharacterAvatarHistory(updatedHistory);

    setShowQuickReplaceDialog(false);
    setSelectedCharacterName('');

    const summary = Object.entries(replacedCounts)
      .map(([name, count]) => `${name}: ${count}个`)
      .join('\n');
    showAlert(`批量替换完成：\n${summary}`, '替换结果');
  };

  // 搜索功能
  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword);
    
    if (!keyword.trim()) {
      setSearchResults([]);
      return;
    }

    const results: Array<{
      chapterIndex: number;
      blockIndex: number;
      type: 'narration' | 'dialogue' | 'character' | 'nested-option';
      content: string;
      character?: string;
      matchText: string;
      nestedShowIndex?: number;
      nestedBi?: number;
    }> = [];

    const searchBlock = (b: ParsedBlock, chapterIndex: number, blockIndex: number, nestedShowIndex?: number, nestedBi?: number) => {
      if (b.type === 'narration' || b.type === 'narration-thought') {
        if (b.content.includes(keyword)) {
          results.push({ chapterIndex, blockIndex, type: 'narration', content: b.content, matchText: b.content, nestedShowIndex, nestedBi });
        }
      }
      if (b.type === 'dialogue') {
        if (b.content.includes(keyword)) {
          results.push({ chapterIndex, blockIndex, type: 'dialogue', content: b.content, character: b.character, matchText: b.content, nestedShowIndex, nestedBi });
        }
        if (b.character && b.character.includes(keyword)) {
          results.push({ chapterIndex, blockIndex, type: 'character', content: b.content, character: b.character, matchText: b.character, nestedShowIndex, nestedBi });
        }
      }
    };

    chapters.forEach((chapter, chapterIndex) => {
      chapter.blocks.forEach((block, blockIndex) => {
        if (block.type === 'header' || block.type === 'footer') return;

        if (block.type === 'nested-choice-group') {
          (block.nestedOptions || []).forEach(opt => {
            if (opt.label.includes(keyword)) {
              results.push({ chapterIndex, blockIndex, type: 'nested-option', content: opt.label, matchText: opt.label, nestedShowIndex: opt.showIndex });
            }
            opt.blocks.forEach((b, bi) => searchBlock(b, chapterIndex, blockIndex, opt.showIndex, bi));
          });
          return;
        }

        searchBlock(block, chapterIndex, blockIndex);
      });
    });

    setSearchResults(results);
  };

  // 跳转到搜索结果
  const jumpToSearchResult = (chapterIndex: number, blockIndex: number, nestedShowIndex?: number, nestedBi?: number) => {
    setCurrentChapterIndex(chapterIndex);
    setShowSearchDialog(false);

    if (nestedShowIndex !== undefined) {
      setNestedSelectedOption(prev => ({ ...prev, [blockIndex]: nestedShowIndex }));
      setNestedHighlight({ blockIndex, showIndex: nestedShowIndex, bi: nestedBi });
      setTimeout(() => setNestedHighlight(null), 2000);
    }

    setTimeout(() => {
      // 嵌套内容块有自己的 ref key
      const refKey = nestedShowIndex !== undefined && nestedBi !== undefined
        ? `nested-${blockIndex}-${nestedShowIndex}-${nestedBi}`
        : `${chapterIndex}-${blockIndex}`;
      const blockElement = blockRefs.current[refKey] ?? blockRefs.current[`${chapterIndex}-${blockIndex}`];

      if (blockElement) {
        blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (nestedShowIndex === undefined) {
          blockElement.style.transition = 'background-color 0.3s';
          blockElement.style.backgroundColor = '#fef3c7';
          setTimeout(() => { blockElement.style.backgroundColor = ''; }, 2000);
        }
      }
    }, 100);
  };

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
                      setChapters(updatedChapters);
                      setInputText(regenerateInputText(updatedChapters));
                      const m = document.getElementById(`narr-convert-menu-${index}`);
                      if (m) m.style.display = 'none';
                    }} className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors">心理旁白</button>
                    <button onClick={() => {
                      const updatedChapters = [...chapters];
                      const b = updatedChapters[currentChapterIndex].blocks[index];
                      b.type = 'dialogue'; b.character = characterName || '角色名'; b.avatarStyle = '';
                      setChapters(updatedChapters);
                      setInputText(regenerateInputText(updatedChapters));
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
                      setChapters(updatedChapters);
                      setInputText(regenerateInputText(updatedChapters));
                      const m = document.getElementById(`narr-convert-menu-${index}`);
                      if (m) m.style.display = 'none';
                    }} className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors">普通旁白</button>
                    <button onClick={() => {
                      const updatedChapters = [...chapters];
                      const b = updatedChapters[currentChapterIndex].blocks[index];
                      b.type = 'dialogue'; b.character = '我'; b.avatarStyle = '';
                      setChapters(updatedChapters);
                      setInputText(regenerateInputText(updatedChapters));
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
                      setChapters(updatedChapters);
                      setInputText(regenerateInputText(updatedChapters));
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
          setChapters(updatedChapters);
          setInputText(regenerateInputText(updatedChapters));
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

  const renderNestedContentBlock = (block: ParsedBlock, bi: number, groupIndex: number, showIndex: number) => {
    // 此函数已移入 NestedChoiceGroup 组件
    return null;
  };

  const renderChapterPreview = (chapter: Chapter, chapterIndex: number) => {
    const chapterKey = `${chapter.character}${chapter.chapterNum}`;

    return (
      <div key={chapterKey} className="mb-0">
        <div className="bg-[#e8e8e0] p-5 rounded-lg border border-[#d0d0c8]">
          {chapter.blocks.map((block, index) => renderBlock(block, index))}
        </div>

        {/* 底部导航 */}
        {chapters[0]?.format !== 'general' && (
        <div className="flex justify-center gap-3 pt-4 pb-2">
          <button
            onClick={() => {
              if (currentChapterIndex > 0) {
                handleChapterClick(currentChapterIndex - 1);
              }
            }}
            disabled={currentChapterIndex === 0}
            className={`bg-white border border-gray-300 px-6 py-2.5 rounded text-sm transition-all ${currentChapterIndex === 0
              ? 'text-gray-400 cursor-not-allowed opacity-50'
              : 'text-gray-800 cursor-pointer hover:bg-gray-100 hover:border-gray-400'
              }`}
          >
            上一节
          </button>

          <button
            onClick={() => {
              if (currentChapterIndex < chapters.length - 1) {
                handleChapterClick(currentChapterIndex + 1);
              }
            }}
            disabled={currentChapterIndex === chapters.length - 1}
            className={`bg-white border border-gray-300 px-6 py-2.5 rounded text-sm transition-all ${currentChapterIndex === chapters.length - 1
              ? 'text-gray-400 cursor-not-allowed opacity-50'
              : 'text-gray-800 cursor-pointer hover:bg-gray-100 hover:border-gray-400'
              }`}
          >
            下一节
          </button>
        </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* 搜索对话框 */}
      {showSearchDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowSearchDialog(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-[600px] max-h-[70vh] mx-4 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">搜索内容</h3>
              <button
                onClick={() => setShowSearchDialog(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="关闭"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 搜索输入 */}
            <div className="px-5 py-3 border-b border-gray-100">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="输入关键词搜索旁白、对话或人名..."
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-900 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white"
                autoFocus
              />
            </div>

            {/* 结果列表 */}
            <div className="flex-1 overflow-y-auto p-4">
              {searchResults.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-400 py-8">
                  {searchKeyword ? '未找到匹配结果' : '请输入关键词开始搜索'}
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((result, idx) => (
                    <div
                      key={idx}
                      onClick={() => jumpToSearchResult(result.chapterIndex, result.blockIndex, result.nestedShowIndex, result.nestedBi)}
                      className="rounded-xl border border-gray-200 p-3 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400">
                          {chapters[result.chapterIndex].format === 'general'
                            ? '通用对话'
                            : `第 ${String(chapters[result.chapterIndex].chapterNum).padStart(2, '0')} 节`}
                        </span>
                        {result.type === 'narration' && (
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">旁白</span>
                        )}
                        {result.type === 'dialogue' && (
                          <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">对话</span>
                        )}
                        {result.type === 'character' && (
                          <span className="inline-flex items-center rounded-md bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">人名</span>
                        )}
                        {result.type === 'nested-option' && (
                          <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">嵌套选项</span>
                        )}
                      </div>
                      {result.character && (
                        <div className="text-sm font-medium text-gray-700 mb-0.5">{result.character}</div>
                      )}
                      <div className="text-sm text-gray-600 line-clamp-2">{result.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
                共找到 {searchResults.length} 条结果
              </div>
            )}
          </div>
        </div>
      )}

      {/* 头像选择器弹窗 */}
      {showAvatarPicker && (
        <AvatarPicker
          onSelect={handleAvatarSelect}
          onClose={() => setShowAvatarPicker(false)}
          currentAvatar={editingAvatar}
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

      {/* 批量头像选择器弹窗 */}
      {showBatchAvatarPicker && (
        <AvatarPicker
          onSelect={batchSetAvatar}
          onClose={() => setShowBatchAvatarPicker(false)}
          currentAvatar=""
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

      {/* 嵌套分歧内容块头像选择器 */}
      {showNestedAvatarPicker && (
        <AvatarPicker
          onSelect={(avatarName) => { setEditingNestedBlockAvatar(avatarName); setShowNestedAvatarPicker(false); }}
          onClose={() => setShowNestedAvatarPicker(false)}
          currentAvatar={editingNestedBlockAvatar}
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

      {/* 一键替换人名头像对话框 */}
      {showQuickReplaceDialog && (
        <QuickReplaceDialog
          characters={getCurrentChapterCharacters()}
          selectedCharacter={selectedCharacterName}
          onCharacterSelect={setSelectedCharacterName}
          onConfirm={(avatarName) => quickReplaceCharacterAvatar(selectedCharacterName, avatarName)}
          onBatchConfirm={batchReplaceMultipleCharacters}
          onClose={() => {
            setShowQuickReplaceDialog(false);
            setSelectedCharacterName('');
          }}
          avatarHistory={characterAvatarHistory}
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
      )}

      {/* 输入区域 */}
      {isInputCollapsed ? (
        <div className="shrink-0">
          <button
            onClick={() => setIsInputCollapsed(false)}
            className="w-full bg-white border border-gray-200 rounded px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm text-gray-700">输入文本</span>
            <span className="text-xs text-gray-400">点击展开</span>
          </button>
        </div>
      ) : (
        <div className="bg-white border-b border-gray-200 p-2 flex flex-col gap-2 shrink-0">
          <div className="flex justify-between items-center">
            <label className="text-sm text-gray-700">
              输入文本
            </label>
            <div className="flex gap-1.5">
              <button
                onClick={handleCopyText}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded transition-colors ${copySuccess ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                {copySuccess ? '已复制' : '复制文本'}
              </button>
              <button
                onClick={async () => {
                  const confirmed = await showConfirm({
                    title: '确认清空',
                    message: '确定要清空文本吗？'
                  });
                  if (confirmed) {
                    setInputText('');
                    setChapters([]);
                    localStorage.removeItem('textProofreader_inputText');
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 rounded transition-colors"
                title="清空文本"
              >
                清空文本
              </button>
              <button
                onClick={handleStartProofreading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
                title="解析文本并开始校对"
              >
                开始校对
              </button>
            </div>
          </div>

          <div ref={leftScrollRef} className="max-h-[360px] overflow-y-auto">
            <textarea
              value={inputText}
              onChange={handleTextChange}
              placeholder="请输入文本。密探格式：使用 ||| 分隔不同小节，例如：{{密探故事录入|头|法正|01}}{{旁白|【广陵王府】}}...|||{{密探故事录入|头|法正|02}}...&#10;通用格式：{{对话-头}}{{旁白|内容}}{{对话|人名|内容}}...{{对话-尾}}"
              className="w-full h-[340px] p-3 border border-gray-300 rounded-md text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* 章节导航 */}
      {chapters.length > 0 && chapters[0].format !== 'general' && (
        <div className="bg-white py-2 px-3 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            {/* 数字导航 */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {chapters.map((chapter, index) => {
                  const rawNum = chapter.chapterNum || String(index + 1);
                  const displayNum =
                    rawNum.length === 1 ? `0${rawNum}` : rawNum;
                  const isActive = index === currentChapterIndex;

                  return (
                    <button
                      key={index}
                      onClick={() => handleChapterClick(index)}
                      className={`px-3 py-1 rounded-full text-xs transition-colors whitespace-nowrap ${isActive
                        ? 'bg-[#c9a95e] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {displayNum}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 上一节/下一节按钮 */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  if (currentChapterIndex > 0) {
                    handleChapterClick(currentChapterIndex - 1);
                  }
                }}
                disabled={currentChapterIndex === 0}
                className={`px-3 py-1 rounded text-xs transition-colors ${currentChapterIndex === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                title="上一节"
              >
                ◀
              </button>
              <button
                onClick={() => {
                  if (currentChapterIndex < chapters.length - 1) {
                    handleChapterClick(currentChapterIndex + 1);
                  }
                }}
                disabled={currentChapterIndex === chapters.length - 1}
                className={`px-3 py-1 rounded text-xs transition-colors ${currentChapterIndex === chapters.length - 1
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                title="下一节"
              >
                ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 预览区域 */}
      {chapters.length > 0 && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* 多选工具栏 */}
          <div className="shrink-0 flex items-center gap-2 p-2 bg-white border-b border-gray-200">
            {/* 搜索按钮 */}
            <button
              onClick={() => setShowSearchDialog(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
              title="搜索旁白、对话和人名"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              搜索
            </button>

            {/* 一键替换人名头像按钮 */}
            <button
              onClick={() => {
                const characters = getCurrentChapterCharacters();
                if (characters.length === 0) {
                  addToast('当前小节没有对话', 'error');
                  return;
                }
                setShowQuickReplaceDialog(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-purple-600 rounded hover:bg-purple-700 transition-colors"
              title="一键替换指定人名的头像"
            >
              一键替换人名头像
            </button>

            <button
              onClick={toggleMultiSelectMode}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded transition-colors ${isMultiSelectMode
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              {isMultiSelectMode ? '退出头像多选' : '头像多选'}
            </button>

            {isMultiSelectMode && (
              <>
                <div className="h-4 w-px bg-gray-300"></div>

                <button
                  onClick={toggleSelectAllDialogues}
                  className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  {(() => {
                    const currentChapter = chapters[currentChapterIndex];
                    const dialogueIndices = currentChapter.blocks
                      .map((block, index) => ({ block, index }))
                      .filter(({ block }) => block.type === 'dialogue')
                      .map(({ index }) => index);
                    const allSelected = dialogueIndices.length > 0 && dialogueIndices.every(index => selectedBlockIndices.has(index));
                    return allSelected ? '取消全选' : '全选对话';
                  })()}
                </button>

                <div className="flex-1"></div>

                <span className="text-xs text-indigo-600 font-medium">
                  已选 {selectedBlockIndices.size + selectedNestedKeys.size} 项
                </span>

                {(selectedBlockIndices.size > 0 || selectedNestedKeys.size > 0) && (
                  <>
                    <button
                      onClick={() => setShowBatchAvatarPicker(true)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
                    >
                      批量设置头像
                    </button>
                    <button
                      onClick={async () => {
                        const confirmed = await showConfirm({
                          title: '确认清空',
                          message: `确定要清空选中的 ${selectedBlockIndices.size + selectedNestedKeys.size} 个对话的头像吗？`
                        });
                        if (confirmed) {
                          batchClearAvatar();
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-orange-600 rounded hover:bg-orange-700 transition-colors"
                    >
                      批量清空头像
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          <div ref={rightScrollRef} className="flex-1 min-h-0 overflow-y-auto pt-4">
            {/* 只显示当前选中的章节 */}
            {renderChapterPreview(chapters[currentChapterIndex], currentChapterIndex)}
          </div>
        </div>
      )}
    </div>
  );
};

export default TextProofreader2;
