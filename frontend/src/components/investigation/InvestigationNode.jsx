/**
 * InvestigationNode.jsx
 * Custom ReactFlow node for the OSINT investigation board.
 *
 * Each position has BOTH a source and target handle stacked on top of each
 * other so users can start or end a connection from any side of the node.
 *
 * File location: frontend/src/components/investigation/InvestigationNode.jsx
 */

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { NODE_TYPES } from "./nodeTypes";

function InvestigationNode({ data, selected }) {
  const typeDef = NODE_TYPES[data.nodeType] || NODE_TYPES.person;

  return (
    <div
      className={`inv-node inv-node--${data.nodeType} ${selected ? "inv-node--selected" : ""} ${data.status || ""}`}
      style={{
        "--node-color": typeDef.color,
        "--node-bg": typeDef.bg,
      }}
    >
      {/* Each position gets BOTH source + target so connections work in any direction */}
      <Handle type="target" position={Position.Top}    id="top-target"    className="inv-handle" />
      <Handle type="source" position={Position.Top}    id="top-source"    className="inv-handle" />

      <Handle type="target" position={Position.Bottom} id="bottom-target" className="inv-handle" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="inv-handle" />

      <Handle type="target" position={Position.Left}   id="left-target"   className="inv-handle" />
      <Handle type="source" position={Position.Left}   id="left-source"   className="inv-handle" />

      <Handle type="target" position={Position.Right}  id="right-target"  className="inv-handle" />
      <Handle type="source" position={Position.Right}  id="right-source"  className="inv-handle" />

      <div className="inv-node-inner">
        <div className="inv-node-header">
          <span className="inv-node-icon">{typeDef.icon}</span>
          <span className="inv-node-type">{typeDef.label}</span>
          {data.isSeed && <span className="inv-node-seed-badge">SEED</span>}
          {data.status === "correct" && <span className="inv-node-check">✓</span>}
        </div>
        <div className="inv-node-value">{data.value || "..."}</div>
        {data.notes && <div className="inv-node-notes">{data.notes}</div>}
      </div>
    </div>
  );
}

export default memo(InvestigationNode);