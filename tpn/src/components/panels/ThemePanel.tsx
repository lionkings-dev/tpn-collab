import { Panel, type ColorMode } from "@xyflow/react";
import React, { type ChangeEventHandler } from "react";

type ThemePanelProps = {
  colorMode: ColorMode;
  setColorMode: (colorMode: ColorMode) => void;
};

const ThemePanel: React.FC<ThemePanelProps> = ({
  colorMode,
  setColorMode,
}) => {
  const onChange: ChangeEventHandler<HTMLSelectElement> = (evt) => {
    setColorMode(evt.target.value as ColorMode);
  };

  return (
    <Panel position="top-right" className="editor-theme ui-panel">
      <select
        className="ui-control xy-theme__select"
        onChange={onChange}
        value={colorMode}
        data-testid="colormode-select"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </Panel>
  );
};

export default ThemePanel;
