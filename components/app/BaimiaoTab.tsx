import React from 'react';
import BaimiaoOcrTab from '../BaimiaoOcrTab';
import { MergedImage } from '../../types';

type BaimiaoTabProps = {
  mergedImages: MergedImage[];
  onOneClickRecognize: () => void;
};

const BaimiaoTab: React.FC<BaimiaoTabProps> = ({
  mergedImages,
  onOneClickRecognize,
}) => (
  <div className="pb-20">
    <section className="scroll-mt-20">
      <BaimiaoOcrTab mergedImages={mergedImages} onOneClickRecognize={onOneClickRecognize} />
    </section>
  </div>
);

export default BaimiaoTab;
