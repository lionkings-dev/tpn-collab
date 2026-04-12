import { Handle, Position } from "@xyflow/react";
import { useEffect, useState, type ChangeEvent, type KeyboardEvent } from "react";
import "./nodes.css";

type PlaceNodeData = {
  label: string;
  tokens?: number;
};

type TransitionBound = number | null;

type TransitionNodeData = {
  label: string;
  lb: TransitionBound;
  ub: TransitionBound;
  isEditing?: boolean;
  updateTransitionTime: (
    nodeId: string,
    lb: TransitionBound,
    ub: TransitionBound,
  ) => boolean;
};

function formatTransitionBound(bound: TransitionBound) {
  return bound === null ? "inf" : String(bound);
}

function parseTransitionBoundInput(input: string) {
  const value = input.trim().toLowerCase();
  if (!value) return undefined;
  if (value === "inf" || value === "infinity") return null;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

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
  const [lbInput, setLbInput] = useState(() => formatTransitionBound(data.lb));
  const [ubInput, setUbInput] = useState(() => formatTransitionBound(data.ub));

  useEffect(() => {
    setLbInput(formatTransitionBound(data.lb));
  }, [data.lb]);

  useEffect(() => {
    setUbInput(formatTransitionBound(data.ub));
  }, [data.ub]);

  const onLbChange = (evt: ChangeEvent<HTMLInputElement>) => {
    setLbInput(evt.target.value);
  };

  const onUbChange = (evt: ChangeEvent<HTMLInputElement>) => {
    setUbInput(evt.target.value);
  };

  const commitLb = () => {
    const nextLb = parseTransitionBoundInput(lbInput);
    if (nextLb === undefined) {
      setLbInput(formatTransitionBound(data.lb));
      return;
    }

    const updated = data.updateTransitionTime(id, nextLb, data.ub);
    if (!updated) {
      setLbInput(formatTransitionBound(data.lb));
    }
  };

  const commitUb = () => {
    const nextUb = parseTransitionBoundInput(ubInput);
    if (nextUb === undefined) {
      setUbInput(formatTransitionBound(data.ub));
      return;
    }

    const updated = data.updateTransitionTime(id, data.lb, nextUb);
    if (!updated) {
      setUbInput(formatTransitionBound(data.ub));
    }
  };

  const onBoundKeyDown = (evt: KeyboardEvent<HTMLInputElement>) => {
    if (evt.key === "Enter") {
      evt.currentTarget.blur();
    }
  };

  return (
    <div className="transition-node">
      <div className="label">{data.label}</div>
      {data.isEditing && (
        <div className="edit-box">
          <label>lb:</label>
          <input
            type="text"
            value={lbInput}
            onChange={onLbChange}
            onBlur={commitLb}
            onKeyDown={onBoundKeyDown}
            placeholder="0 or inf"
          />
          <label>ub:</label>
          <input
            type="text"
            value={ubInput}
            onChange={onUbChange}
            onBlur={commitUb}
            onKeyDown={onBoundKeyDown}
            placeholder="0 or inf"
          />
        </div>
      )}
      <div>
        <div className="time">{`[${formatTransitionBound(data.lb)}, ${formatTransitionBound(data.ub)}]`}</div>
      </div>
      <Handle type="target" position={Position.Left} id="l.target" />
      <Handle type="source" position={Position.Left} id="l.source" />
      <Handle type="target" position={Position.Right} id="r.target" />
      <Handle type="source" position={Position.Right} id="r.source" />
    </div>
  );
}
