import React from 'react';

interface SearchBarProps {
  searchKeyword: string;
  currentMatchIndex: number;
  totalMatches: number;
  onSearchKeywordChange: (value: string) => void;
  onJumpToRelativeMatch: (direction: 1 | -1) => void;
  placeholder?: string;
  className?: string;
  embedded?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchKeyword,
  currentMatchIndex,
  totalMatches,
  onSearchKeywordChange,
  onJumpToRelativeMatch,
  placeholder = '搜索',
  className = '',
  embedded = false,
}) => (
  <div className={`${embedded ? 'flex min-w-0 flex-1 items-center gap-1.5' : 'px-3 py-2 border-b border-gray-100 flex items-center gap-1.5 shrink-0'} ${className}`.trim()}>
    <input type="text" value={searchKeyword} onChange={(e) => onSearchKeywordChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onJumpToRelativeMatch(e.shiftKey ? -1 : 1); } }} placeholder={placeholder} className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-200 rounded outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
    <span className={`shrink-0 text-[11px] w-14 text-center ${searchKeyword && totalMatches === 0 ? 'text-red-500' : 'text-gray-500'}`}>{searchKeyword ? `${totalMatches === 0 ? 0 : Math.min(currentMatchIndex + 1, totalMatches)}/${totalMatches}` : '--/--'}</span>
    <button onClick={() => onJumpToRelativeMatch(-1)} disabled={totalMatches === 0} className="shrink-0 px-2 py-1.5 text-xs text-gray-700 border border-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors">上一个</button>
    <button onClick={() => onJumpToRelativeMatch(1)} disabled={totalMatches === 0} className="shrink-0 px-2 py-1.5 text-xs text-gray-700 border border-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors">下一个</button>
  </div>
);

export default SearchBar;
