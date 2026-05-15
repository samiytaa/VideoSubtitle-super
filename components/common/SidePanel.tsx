import React, { ReactNode } from 'react';
import RightSlidePanel from './RightSlidePanel';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  width?: string;
}

const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  width = 'w-96',
}) => (
  <RightSlidePanel
    open={isOpen}
    onClose={onClose}
    title={title}
    headerIcon={icon}
    widthClassName={width}
  >
    {children}
  </RightSlidePanel>
);

export default SidePanel;
