import React from 'react';
import FormatConverter from '../FormatConverter';

const ProofreadTab: React.FC = () => (
  <div className="h-[calc(100vh-5rem)] flex flex-col">
    <section className="flex-1 flex flex-col min-h-0">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 p-4 flex-1 flex flex-col min-h-0">
        <FormatConverter />
      </div>
    </section>
  </div>
);

export default ProofreadTab;
