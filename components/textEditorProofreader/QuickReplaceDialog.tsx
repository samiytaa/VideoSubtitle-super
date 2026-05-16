import React, { useEffect, useRef, useState } from 'react';
import { findBestAvatarMatch, getAvatarPath, normalizeAvatarName } from '../../utils/avatarMap';
import AvatarPicker from '../AvatarPicker';
import { ExtractedFrame, VideoFile, ROI } from '../../types';
import CenteredModal from '../common/CenteredModal';

const ITEMS_PER_PAGE = 9;

export interface QuickReplaceDialogProps {
  characters: string[];
  selectedCharacter: string;
  onCharacterSelect: (character: string) => void;
  onConfirm: (avatarName: string) => void;
  onBatchConfirm: (characterAvatarMap: Record<string, string>) => void;
  onClose: () => void;
  avatarHistory: Record<string, string[]>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  extractedFrames?: ExtractedFrame[];
  onDeleteFrames?: (ids: string[]) => void;
  onJumpToTime?: (timestamp: string) => void;
  activeVideo?: VideoFile | null;
  videoSrc?: string | null;
  sharedVideoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  roi?: ROI | null;
  onCaptureFrame?: (frame: ExtractedFrame) => void;
}

const QuickReplaceDialog: React.FC<QuickReplaceDialogProps> = ({
  characters,
  selectedCharacter,
  onCharacterSelect,
  onConfirm,
  onBatchConfirm,
  onClose,
  avatarHistory,
  addToast,
  extractedFrames = [],
  onDeleteFrames,
  onJumpToTime,
  activeVideo,
  videoSrc,
  sharedVideoRef,
  roi,
  onCaptureFrame
}) => {
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [batchAvatarMap, setBatchAvatarMap] = useState<Record<string, string>>({});
  const [currentBatchCharacter, setCurrentBatchCharacter] = useState('');
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('quickReplaceDialog_currentPage');
    return saved ? Number(saved) : 1;
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const getPreferredAvatarForCharacter = (characterName: string) => {
    return findBestAvatarMatch(characterName) || normalizeAvatarName(avatarHistory[characterName]?.[0] || '') || '';
  };

  useEffect(() => {
    const initialMap: Record<string, string> = {};
    characters.forEach(character => {
      const preferredAvatar = getPreferredAvatarForCharacter(character);
      if (preferredAvatar) {
        initialMap[character] = preferredAvatar;
      }
    });
    setBatchAvatarMap(initialMap);
  }, [characters, avatarHistory]);

  useEffect(() => {
    if (!selectedCharacter) {
      setSelectedAvatar('');
      return;
    }

    setSelectedAvatar(getPreferredAvatarForCharacter(selectedCharacter));
  }, [selectedCharacter, avatarHistory]);

  useEffect(() => {
    localStorage.setItem('quickReplaceDialog_currentPage', String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    const saveScrollPosition = () => {
      if (scrollContainerRef.current) {
        localStorage.setItem('quickReplaceDialog_scrollTop', String(scrollContainerRef.current.scrollTop));
      }
    };
    const container = scrollContainerRef.current;
    if (container) container.addEventListener('scroll', saveScrollPosition);
    return () => { if (container) container.removeEventListener('scroll', saveScrollPosition); };
  }, []);

  useEffect(() => {
    const savedScrollTop = localStorage.getItem('quickReplaceDialog_scrollTop');
    if (scrollContainerRef.current && savedScrollTop) {
      scrollContainerRef.current.scrollTop = Number(savedScrollTop);
    }
  }, [currentPage]);

  const totalPages = Math.ceil(characters.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCharacters = characters.slice(startIndex, endIndex);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleAvatarSelect = (avatarName: string) => {
    if (mode === 'single') {
      setSelectedAvatar(avatarName);
    } else {
      if (currentBatchCharacter) {
        setBatchAvatarMap(prev => ({ ...prev, [currentBatchCharacter]: avatarName }));
        setCurrentBatchCharacter('');
      }
    }
    setShowAvatarPicker(false);
  };

  const handleConfirm = () => {
    if (mode === 'single') {
      if (!selectedCharacter) { addToast('请选择要替换的人名', 'error'); return; }
      if (!selectedAvatar) { addToast('请选择头像', 'error'); return; }
      onConfirm(selectedAvatar);
    } else {
      if (Object.keys(batchAvatarMap).length === 0) { addToast('请至少为一个人名设置头像', 'error'); return; }
      onBatchConfirm(batchAvatarMap);
    }
  };

  const handleQuickSelectFromHistory = (characterName: string, avatarName: string) => {
    const normalizedAvatarName = normalizeAvatarName(avatarName);
    if (mode === 'single') {
      onCharacterSelect(characterName);
      setSelectedAvatar(normalizedAvatarName);
    } else {
      setBatchAvatarMap(prev => ({ ...prev, [characterName]: normalizedAvatarName }));
    }
  };

  const getCharacterMatchedAvatar = (characterName: string) => {
    return getPreferredAvatarForCharacter(characterName);
  };

  const PaginationControls = () => (
    totalPages > 1 ? (
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-gray-600">
          第 {startIndex + 1}-{Math.min(endIndex, characters.length)} 项，共 {characters.length} 项
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >上一页</button>
          <span className="text-xs text-gray-700">{currentPage} / {totalPages}</span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >下一页</button>
        </div>
      </div>
    ) : null
  );

  const ItemsPerPageSelect = () => (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-600">每页显示：</label>
      <span className="inline-flex min-w-12 items-center justify-center rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-700">
        {ITEMS_PER_PAGE}
      </span>
    </div>
  );

  return (
    <>
      {showAvatarPicker && (
        <AvatarPicker
          onSelect={handleAvatarSelect}
          onClose={() => { setShowAvatarPicker(false); setCurrentBatchCharacter(''); }}
          currentAvatar={mode === 'single' ? selectedAvatar : (currentBatchCharacter ? batchAvatarMap[currentBatchCharacter] : '')}
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

      <CenteredModal
        open={true}
        onClose={onClose}
        title="🎭 智能头像"
        panelClassName="w-full max-w-2xl mx-4 flex max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        bodyClassName={null}
        footer={
          <>
            <button
              onClick={handleConfirm}
              disabled={mode === 'single' ? (!selectedCharacter || !selectedAvatar) : (Object.keys(batchAvatarMap).length === 0)}
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mode === 'single' ? '确认替换' : `批量替换 (${Object.keys(batchAvatarMap).length})`}
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >取消</button>
          </>
        }
      >
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* 模式切换 */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => { setMode('single'); setBatchAvatarMap({}); setCurrentBatchCharacter(''); }}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'single' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >单个替换</button>
              <button
                onClick={() => { setMode('batch'); setSelectedAvatar(''); onCharacterSelect(''); }}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'batch' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >批量替换</button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              {mode === 'single'
                ? 'ℹ️ 选择一个人名并设置头像，将替换该人名的所有对话头像'
                : 'ℹ️ 为多个人名依次设置头像，一次性完成批量替换'}
            </div>

            {characters.length === 0 ? (
              <div className="text-center py-8 text-gray-400">当前小节没有对话</div>
            ) : mode === 'single' ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">选择人名 ({characters.length} 个)</label>
                    <ItemsPerPageSelect />
                  </div>
                  <div className="grid grid-cols-3 gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    {paginatedCharacters.map((character) => {
                      const matchedAvatar = getCharacterMatchedAvatar(character);
                      const matchedAvatarPath = matchedAvatar ? getAvatarPath(matchedAvatar) : null;

                      return (
                        <button
                          key={character}
                          onClick={() => onCharacterSelect(character)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${selectedCharacter === character ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'}`}
                        >
                          <div className="flex items-center justify-center gap-2 min-w-0">
                            {matchedAvatarPath && (
                              <div className={`w-8 h-8 rounded-full overflow-hidden border-2 shrink-0 ${selectedCharacter === character ? 'border-white/80' : 'border-purple-200'}`}>
                                <img src={matchedAvatarPath} alt={matchedAvatar} className="w-full h-full object-cover" />
                              </div>
                            )}
                            <span className="truncate">{character}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <PaginationControls />
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">选择头像</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowAvatarPicker(true)}
                      disabled={!selectedCharacter}
                      className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >{selectedAvatar ? '更换头像' : '选择头像'}</button>
                    {selectedAvatar && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-green-500">
                          <img src={getAvatarPath(selectedAvatar) || ''} alt={selectedAvatar} className="w-full h-full object-cover" />
                        </div>
                        <div className="text-xs text-green-700 max-w-[120px] truncate">{selectedAvatar}</div>
                      </div>
                    )}
                  </div>
                  {selectedCharacter && avatarHistory[selectedCharacter]?.length > 0 && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="text-xs font-medium text-amber-800 mb-2">📜 最近使用的头像：</div>
                      <div className="flex gap-2">
                        {avatarHistory[selectedCharacter].map((avatarName, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedAvatar(avatarName)}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 transition-all"
                            title={avatarName}
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-amber-400">
                              <img src={getAvatarPath(avatarName) || ''} alt={avatarName} className="w-full h-full object-cover" />
                            </div>
                            <span className="text-xs text-amber-700 max-w-[80px] truncate">{avatarName}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {selectedCharacter && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
                    将替换所有 <strong>"{selectedCharacter}"</strong> 的对话头像
                    {selectedAvatar && <span> 为 <strong>"{selectedAvatar}"</strong></span>}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">为每个人名设置头像 ({characters.length} 个)</label>
                  <ItemsPerPageSelect />
                </div>

                <div className="space-y-1 max-h-96 overflow-y-auto p-3 bg-linear-to-br from-slate-50 to-gray-50 rounded-xl border border-gray-200 shadow-inner">
                  {paginatedCharacters.map((character) => {
                    const hasAvatar = !!batchAvatarMap[character];
                    const history = avatarHistory[character] || [];
                    return (
                      <div key={character} className="group hover:bg-gray-50 rounded-lg p-3 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="shrink-0 min-w-[60px]">
                            <span className="inline-block px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md">{character}</span>
                          </div>
                          {hasAvatar && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg shadow-sm">
                              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-emerald-400 shrink-0">
                                <img src={getAvatarPath(batchAvatarMap[character]) || ''} alt={batchAvatarMap[character]} className="w-full h-full object-cover" />
                              </div>
                              <span className="text-xs font-medium text-emerald-700 whitespace-nowrap max-w-[120px] truncate">{batchAvatarMap[character]}</span>
                              <button
                                onClick={() => { const newMap = { ...batchAvatarMap }; delete newMap[character]; setBatchAvatarMap(newMap); }}
                                className="ml-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full p-0.5 transition-colors"
                                title="清除"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )}
                          <button
                            onClick={() => { setCurrentBatchCharacter(character); setShowAvatarPicker(true); }}
                            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap shadow-sm ${hasAvatar ? 'bg-white text-emerald-600 border border-emerald-300 hover:bg-emerald-50' : 'bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-600'}`}
                          >{hasAvatar ? '更换头像' : '选择头像'}</button>
                          {history.length > 0 && (
                            <div className="flex items-center gap-2 ml-auto">
                              <span className="text-xs text-amber-600 font-medium">历史:</span>
                              <div className="flex gap-1.5">
                                {history.map((avatarName, index) => (
                                  <button
                                    key={index}
                                    onClick={() => handleQuickSelectFromHistory(character, avatarName)}
                                    className="w-9 h-9 rounded-full overflow-hidden border-2 border-amber-300 hover:border-amber-500 hover:scale-110 transition-all shadow-sm"
                                    title={avatarName}
                                  >
                                    <img src={getAvatarPath(avatarName) || ''} alt={avatarName} className="w-full h-full object-cover" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <PaginationControls />

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
                  已设置 <strong>{Object.keys(batchAvatarMap).length}</strong> / {characters.length} 个人名的头像
                </div>
              </div>
            )}
        </div>
      </CenteredModal>
    </>
  );
};

export default QuickReplaceDialog;
