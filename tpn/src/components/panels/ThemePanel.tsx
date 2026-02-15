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
    <Panel position="top-right">
      <select
        className="xy-theme__select"
        onChange={onChange}
        value={colorMode}
        data-testid="colormode-select"
      >
        <option value="dark">dark</option>
        <option value="light">light</option>
        <option value="system">system</option>
      </select>
    </Panel>
  );
};

export default ThemePanel;
