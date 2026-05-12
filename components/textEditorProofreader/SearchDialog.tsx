import React from 'react';
import { Chapter, SearchResult } from './types';

interface SearchDialogProps {
  open: boolean;
  keyword: string;
  results: SearchResult[];
  chapters: Chapter[];
  onClose: () => void;
  onSearch: (keyword: string) => void;
  onJump: (chapterIndex: number, blockIndex: number, nestedShowIndex?: number, nestedBi?: number) => void;
}

const SearchDialog: React.FC<SearchDialogProps> = ({
  open,
  keyword,
  results,
  chapters,
  onClose,
  onSearch,
  onJump
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[600px] max-h-[70vh] mx-4 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">搜索内容</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="关闭"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100">
          <input
            type="text"
            value={keyword}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="输入关键词搜索旁白、对话或人名..."
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-900 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {results.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400 py-8">
              {keyword ? '未找到匹配结果' : '请输入关键词开始搜索'}
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  onClick={() => onJump(result.chapterIndex, result.blockIndex, result.nestedShowIndex, result.nestedBi)}
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

        {results.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
            共找到 {results.length} 条结果
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchDialog;
