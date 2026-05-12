import React from 'react';

interface ConvertMenuOption {
  label: string;
  onClick: () => void;
}

interface ConvertMenuProps {
  isOpen: boolean;
  options: ConvertMenuOption[];
}

const ConvertMenu: React.FC<ConvertMenuProps> = ({ isOpen, options }) => {
  if (!isOpen) return null;

  return (
    <div
      className="absolute right-0 top-7 bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex flex-col gap-1 z-20 min-w-[120px]"
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((option, idx) => (
        <button
          key={`${option.label}-${idx}`}
          onClick={option.onClick}
          className="w-full px-3 py-2 text-xs text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default ConvertMenu;
