import { Handle, Position } from "@xyflow/react";
import type { ChangeEvent } from "react";
import "./nodes.css";

type PlaceNodeData = {
  label: string;
  tokens?: number;
};

type TransitionNodeData = {
  lb: number;
  ub: number;
  isEditing?: boolean;
  updateTransitionTime: (nodeId: string, lb: number, ub: number) => void;
};

export function PlaceNode({ data }: { data: PlaceNodeData }) {
  return (
    <div className="place-node">
      {data.tokens === 1 && <div className="token" />}
      <div className="label">{data.label}</div>
      <Handle type="target" position={Position.Top} id="t.target" />
      <Handle type="source" position={Position.Top} id="t.source" />
      <Handle type="target" position={Position.Bottom} id="b.target" />
      <Handle type="source" position={Position.Bottom} id="b.source" />
      <Handle type="target" position={Position.Left} id="l.target" />
      <Handle type="source" position={Position.Left} id="l.source" />
      <Handle type="target" position={Position.Right} id="r.target" />
      <Handle type="source" position={Position.Right} id="r.source" />
    </div>
  );
}

export function TransitionNode({
  id,
  data,
}: {
  id: string;
  data: TransitionNodeData;
}) {
  const onLbChange = (evt: ChangeEvent<HTMLInputElement>) => {
    const newLb = parseInt(evt.target.value, 10);
    if (!isNaN(newLb)) {
      data.updateTransitionTime(id, newLb, data.ub);
    }
  };

  const onUbChange = (evt: ChangeEvent<HTMLInputElement>) => {
    const newUb = parseInt(evt.target.value, 10);
    if (!isNaN(newUb)) {
      data.updateTransitionTime(id, data.lb, newUb);
    }
  };

  return (
    <div className="transition-node">
      {data.isEditing && (
        <div className="edit-box">
          <label>lb:</label>
          <input type="number" min="0" value={data.lb} onChange={onLbChange} />
          <label>ub:</label>
          <input type="number" min="0" value={data.ub} onChange={onUbChange} />
        </div>
      )}
      <div>
        <div className="time">{`[${data.lb}, ${data.ub}]`}</div>
      </div>
      <Handle type="target" position={Position.Left} id="l.target" />
      <Handle type="source" position={Position.Left} id="l.source" />
      <Handle type="target" position={Position.Right} id="r.target" />
      <Handle type="source" position={Position.Right} id="r.source" />
    </div>
  );
}
