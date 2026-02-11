import React from 'react';

type ControlsProps = {
  onAddNode: () => void;
};

const Controls: React.FC<ControlsProps> = ({ onAddNode }) => {
  return (
    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 4 }}>
      <button onClick={onAddNode}>Add Node</button>
    </div>
  );
};

export default Controls;
