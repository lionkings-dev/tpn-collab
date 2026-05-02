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
    <Panel position="bottom-center" className="editor-actions ui-panel">
      <div className="add-button">
        <button className="ui-button ui-button-secondary" onClick={addPlaces}>
          Places
        </button>
        <button className="ui-button ui-button-secondary" onClick={addTransition}>
          Transition
        </button>
        <button className="ui-button ui-button-secondary" onClick={addToken}>
          Token
        </button>
        <button className="ui-button ui-button-danger" onClick={clearCanvas}>
          Clear Canvas
        </button>
      </div>
    </Panel>
  );
};

export default ActionsPanel;
