import React from 'react';
import { InsertBlockType } from '../../context/EditorBlockContext';

interface MenuButtonProps {
  onClick: () => void;
  variant?: 'default' | 'purple';
  children: React.ReactNode;
}

const MenuButton: React.FC<MenuButtonProps> = ({ onClick, variant = 'default', children }) => {
  const className = variant === 'purple'
    ? 'w-full px-3 py-2 text-xs text-left text-purple-700 hover:bg-purple-50 rounded transition-colors'
    : 'w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors';
  return <button onClick={onClick} className={className}>{children}</button>;
};

interface InsertMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (type: InsertBlockType) => void;
}

const InsertMenu = React.memo<InsertMenuProps>(({ isOpen, onClose, onInsert }) => {
  if (!isOpen) return null;
  return (
    <div
      className="absolute right-2 top-10 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex flex-col gap-1 min-w-[140px]"
      onClick={(e) => e.stopPropagation()}
    >
      <MenuButton onClick={() => { onInsert('narration'); onClose(); }}>插入普通旁白</MenuButton>
      <MenuButton onClick={() => { onInsert('narration-thought'); onClose(); }}>插入心理旁白</MenuButton>
      <MenuButton onClick={() => { onInsert('dialogue'); onClose(); }}>插入对话</MenuButton>
      <MenuButton onClick={() => { onInsert('nested-choice-group'); onClose(); }} variant="purple">插入嵌套分歧</MenuButton>
    </div>
  );
});

export default InsertMenu;
