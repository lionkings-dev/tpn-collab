import { Panel } from "@xyflow/react";
import React from "react";

type ActionsPanelProps = {
  addPlaces: () => void;
  addTransition: () => void;
  clearCanvas: () => void;
  addToken: () => void;
};

const ActionsPanel: React.FC<ActionsPanelProps> = ({
  addPlaces,
  addTransition,
  clearCanvas,
  addToken,
}) => {
  return (
    <Panel position="bottom-center">
      <div className="add-button">
        <button onClick={addPlaces}>Places</button>
        <button onClick={addTransition}>Transition</button>
        <button onClick={addToken}>Token</button>
        <button onClick={clearCanvas}>Clear Canvas</button>
      </div>
    </Panel>
  );
};

export default ActionsPanel;
