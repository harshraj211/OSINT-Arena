/**
 * InvestigationBoard.jsx
 * The core ReactFlow canvas for OSINT investigation challenges.
 *
 * Features:
 *  - Right-click canvas → context menu to add nodes
 *  - Drag from palette → add node
 *  - Connect nodes → edge label picker → server validation → green/red flash
 *  - Right-click node → delete (non-seed only)
 *  - Partial ELO shown on correct edges
 *  - Completion detection + bonus ELO modal
 *
 * File location: frontend/src/components/investigation/InvestigationBoard.jsx
 */

import { useState, useCallback, useRef, useEffect } from "react";
import ReactFlow, {
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  MarkerType,
  ConnectionMode,
} from "reactflow";
import "reactflow/dist/style.css";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";

import InvestigationNode from "./InvestigationNode";
import { NODE_TYPES, EDGE_TYPES } from "./nodeTypes";
import "./InvestigationBoard.css";

const verifyEdgeFn    = httpsCallable(functions, "verifyGraphEdge");
const completeInvFn   = httpsCallable(functions, "completeInvestigation");

const nodeTypes = { investigation: InvestigationNode };

let nodeIdCounter = 100;
const newId = () => `n${++nodeIdCounter}`;

export default function InvestigationBoard({ challenge, onEloUpdate }) {
  const reactFlowWrapper = useRef(null);
  const [rfInstance, setRfInstance]     = useState(null);

  // Seed node pre-populated from challenge
  const seedNode = {
    id: "seed-1",
    type: "investigation",
    position: { x: 400, y: 200 },
    data: {
      nodeType: challenge.seedNode?.type || "ip",
      value:    challenge.seedNode?.value || "?",
      notes:    challenge.seedNode?.notes || "",
      isSeed:   true,
      status:   "correct",
    },
    draggable: true,
    deletable: false,
  };

  const [nodes, setNodes, onNodesChange] = useNodesState([seedNode]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Context menu state (right-click canvas)
  const [ctxMenu, setCtxMenu]   = useState(null);
  const [ctxPos, setCtxPos]     = useState({ x: 0, y: 0 });
  const [flowPos, setFlowPos]   = useState({ x: 0, y: 0 });

  // Node context menu (right-click a node)
  const [nodeCtxMenu, setNodeCtxMenu] = useState(null);
  const [nodeCtxPos, setNodeCtxPos]   = useState({ x: 0, y: 0 });

  // Edge label picker (shown when connecting two nodes)
  const [pendingEdge, setPendingEdge] = useState(null);
  const [edgeLabelPos, setEdgeLabelPos] = useState({ x: 0, y: 0 });

  // Node value editor
  const [editingNode, setEditingNode] = useState(null);
  const [editValue, setEditValue]     = useState("");
  const [editNotes, setEditNotes]     = useState("");

  // Feedback
  const [verifying, setVerifying]   = useState(false);
  const [flashEdge, setFlashEdge]   = useState(null);
  const [totalElo, setTotalElo]     = useState(0);
  const [completed, setCompleted]   = useState(false);
  const [completionData, setCompletionData] = useState(null);

  // Track verified correct edges
  const correctEdges = useRef(new Set());
  const requiredEdgeCount = challenge.solutionGraph?.edges?.length || 0;

  // ── Delete node ───────────────────────────────────────────────────────────
  const deleteNode = useCallback((nodeId) => {
    // Never delete seed nodes
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.data?.isSeed) return;

    // Remove the node and any connected edges
    setNodes(ns => ns.filter(n => n.id !== nodeId));
    setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId));
    setNodeCtxMenu(null);
  }, [nodes, setNodes, setEdges]);

  // ── Delete selected nodes (keyboard) ──────────────────────────────────────
  const onKeyDown = useCallback((e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      // Don't interfere with input fields
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      // Delete all selected non-seed nodes
      setNodes(ns => {
        const toDelete = ns.filter(n => n.selected && !n.data?.isSeed).map(n => n.id);
        if (toDelete.length > 0) {
          setEdges(es => es.filter(e => !toDelete.includes(e.source) && !toDelete.includes(e.target)));
        }
        return ns.filter(n => !n.selected || n.data?.isSeed);
      });
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  // ── Add node from palette or context menu ─────────────────────────────────
  const addNode = useCallback((nodeType, position) => {
    const id = newId();
    const newNode = {
      id,
      type: "investigation",
      position,
      data: { nodeType, value: "", notes: "", status: "pending" },
    };
    setNodes(ns => [...ns, newNode]);
    // Immediately open editor for the new node
    setEditingNode(id);
    setEditValue("");
    setEditNotes("");
    setCtxMenu(null);
  }, [setNodes]);

  // ── Right-click context menu ──────────────────────────────────────────────
  const onPaneContextMenu = useCallback((e) => {
    e.preventDefault();
    if (!rfInstance) return;
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const pos = rfInstance.project({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    });
    setCtxPos({ x: e.clientX, y: e.clientY });
    setFlowPos(pos);
    setCtxMenu("node");
  }, [rfInstance]);

  const onPaneClick = useCallback(() => {
    setCtxMenu(null);
    setNodeCtxMenu(null);
    // Don't clear pendingEdge if user just finished connecting
    if (!connectingRef.current) {
      // Only clear if clicking pane without dragging a connection
    }
  }, []);

  // ── Right-click node → context menu to delete ─────────────────────────────
  const onNodeContextMenu = useCallback((e, node) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.data?.isSeed) return; // can't delete seed
    setNodeCtxMenu(node.id);
    setNodeCtxPos({ x: e.clientX, y: e.clientY });
    setCtxMenu(null);
  }, []);

  // ── Double-click node to edit ─────────────────────────────────────────────
  const onNodeDoubleClick = useCallback((_, node) => {
    setEditingNode(node.id);
    setEditValue(node.data.value || "");
    setEditNotes(node.data.notes || "");
  }, []);

  const saveNodeEdit = useCallback(() => {
    if (!editingNode) return;
    setNodes(ns => ns.map(n =>
      n.id === editingNode
        ? { ...n, data: { ...n.data, value: editValue, notes: editNotes } }
        : n
    ));
    setEditingNode(null);
  }, [editingNode, editValue, editNotes, setNodes]);

  // ── Connection handler — show edge label picker ───────────────────────────
  const connectingRef = useRef(false);

  const onConnectStart = useCallback(() => {
    connectingRef.current = true;
  }, []);

  const onConnectEnd = useCallback(() => {
    // Small delay so onConnect fires first if successful
    setTimeout(() => { connectingRef.current = false; }, 100);
  }, []);

  const onConnect = useCallback((params) => {
    if (!params.source || !params.target) return;
    if (params.source === params.target) return; // no self-loops
    connectingRef.current = false;

    // Don't create edge yet — show label picker first
    setPendingEdge(params);
  }, []);

  // Allow any connection between any two different nodes
  const isValidConnection = useCallback((connection) => {
    return connection.source !== connection.target;
  }, []);

  const confirmEdge = useCallback(async (relationshipType) => {
    if (!pendingEdge) return;
    setPendingEdge(null);
    setVerifying(true);

    const sourceNode = nodes.find(n => n.id === pendingEdge.source);
    const targetNode = nodes.find(n => n.id === pendingEdge.target);

    if (!sourceNode || !targetNode) { setVerifying(false); return; }

    // Optimistically add edge as "verifying"
    const edgeId = `e-${pendingEdge.source}-${pendingEdge.target}-${Date.now()}`;
    const newEdge = {
      id: edgeId,
      source: pendingEdge.source,
      target: pendingEdge.target,
      label: relationshipType,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed },
      className: "inv-edge inv-edge--verifying",
      data: { relationship: relationshipType, status: "verifying" },
    };
    setEdges(es => addEdge(newEdge, es));

    try {
      const res = await verifyEdgeFn({
        challengeId:      challenge.id,
        sourceType:       sourceNode.data.nodeType,
        sourceValue:      sourceNode.data.value,
        targetType:       targetNode.data.nodeType,
        targetValue:      targetNode.data.value,
        relationshipType,
      });

      const { correct, eloAwarded, totalCorrect, isComplete } = res.data;

      if (correct) {
        correctEdges.current.add(edgeId);
        const eloGain = eloAwarded || 2;
        setTotalElo(t => t + eloGain);
        onEloUpdate?.(eloGain);

        // Flash correct
        setFlashEdge({ id: edgeId, correct: true });
        setTimeout(() => setFlashEdge(null), 1500);

        setEdges(es => es.map(e =>
          e.id === edgeId
            ? { ...e, className: "inv-edge inv-edge--correct", data: { ...e.data, status: "correct" } }
            : e
        ));

        // Mark source/target nodes as "used correctly"
        setNodes(ns => ns.map(n =>
          n.id === pendingEdge.source || n.id === pendingEdge.target
            ? { ...n, data: { ...n.data, status: "correct" } }
            : n
        ));

        // Check completion
        if (isComplete || correctEdges.current.size >= requiredEdgeCount) {
          const completeRes = await completeInvFn({ challengeId: challenge.id });
          setCompletionData(completeRes.data);
          setCompleted(true);
        }
      } else {
        // Flash incorrect
        setFlashEdge({ id: edgeId, correct: false });
        setTimeout(() => {
          setFlashEdge(null);
          setEdges(es => es.filter(e => e.id !== edgeId));
        }, 1000);
      }
    } catch (err) {
      console.error("verifyGraphEdge failed:", err);
      setEdges(es => es.filter(e => e.id !== edgeId));
    } finally {
      setVerifying(false);
    }
  }, [pendingEdge, nodes, challenge.id, requiredEdgeCount, setEdges, setNodes, onEloUpdate]);

  // ── Drag from palette ─────────────────────────────────────────────────────
  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData("application/nodeType");
    if (!nodeType || !rfInstance) return;
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const pos = rfInstance.project({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    });
    addNode(nodeType, pos);
  }, [rfInstance, addNode]);

  // ── Edge styling based on flash state ─────────────────────────────────────
  const styledEdges = edges.map(e => {
    if (flashEdge?.id === e.id) {
      return {
        ...e,
        className: flashEdge.correct ? "inv-edge inv-edge--flash-correct" : "inv-edge inv-edge--flash-wrong",
      };
    }
    return e;
  });

  return (
    <div className="inv-board-root">
      {/* ── Node Palette ─────────────────────────────────────────────── */}
      <div className="inv-palette">
        <div className="inv-palette-title">NODE TYPES</div>
        {Object.entries(NODE_TYPES).map(([type, def]) => (
          <div
            key={type}
            className="inv-palette-item"
            style={{ "--node-color": def.color, "--node-bg": def.bg }}
            draggable
            onDragStart={e => e.dataTransfer.setData("application/nodeType", type)}
            onClick={() => {
              const pos = rfInstance?.project({ x: 300 + Math.random()*200, y: 150 + Math.random()*200 }) || { x: 300, y: 200 };
              addNode(type, pos);
            }}
            title={`Add ${def.label} node`}
          >
            <span className="inv-palette-icon">{def.icon}</span>
            <span className="inv-palette-label">{def.label}</span>
          </div>
        ))}

        {/* Progress */}
        <div className="inv-palette-divider" />
        <div className="inv-palette-progress">
          <div className="inv-progress-label">CONNECTIONS</div>
          <div className="inv-progress-value">
            <span className="inv-progress-current">{correctEdges.current.size}</span>
            <span className="inv-progress-sep">/</span>
            <span className="inv-progress-total">{requiredEdgeCount}</span>
          </div>
          <div className="inv-progress-bar">
            <div
              className="inv-progress-fill"
              style={{ width: `${requiredEdgeCount ? (correctEdges.current.size / requiredEdgeCount) * 100 : 0}%` }}
            />
          </div>
        </div>

        {totalElo > 0 && (
          <div className="inv-palette-elo">
            <span className="inv-elo-label">ELO EARNED</span>
            <span className="inv-elo-value">+{totalElo}</span>
          </div>
        )}
      </div>

      {/* ── Canvas ───────────────────────────────────────────────────── */}
      <div className="inv-canvas-wrap" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onInit={setRfInstance}
          onPaneContextMenu={onPaneContextMenu}
          onPaneClick={onPaneClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeContextMenu={onNodeContextMenu}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          connectionRadius={60}
          connectOnClick={true}
          isValidConnection={isValidConnection}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          deleteKeyCode={null}
          multiSelectionKeyCode="Shift"
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-border)" />
          <Controls className="inv-controls" />
          <MiniMap
            className="inv-minimap"
            nodeColor={n => NODE_TYPES[n.data?.nodeType]?.color || "#888"}
            maskColor="rgba(15,17,23,0.7)"
          />
        </ReactFlow>

        {/* Instructions overlay — hidden once nodes added */}
        {nodes.length === 1 && (
          <div className="inv-hint-overlay">
            <div className="inv-hint-text">
              <span>Drag node types from the palette</span>
              <span>or right-click the canvas to add nodes</span>
              <span>Double-click a node to enter its value</span>
              <span>Connect nodes to map relationships</span>
            </div>
          </div>
        )}

        {verifying && (
          <div className="inv-verifying-badge">Verifying connection...</div>
        )}
      </div>

      {/* ── Right-click context menu (canvas) ────────────────────────── */}
      {ctxMenu === "node" && (
        <div
          className="inv-ctx-menu"
          style={{ left: ctxPos.x, top: ctxPos.y }}
          onContextMenu={e => e.preventDefault()}
        >
          <div className="inv-ctx-title">Add Node</div>
          {Object.entries(NODE_TYPES).map(([type, def]) => (
            <button
              key={type}
              className="inv-ctx-item"
              style={{ "--node-color": def.color }}
              onClick={() => addNode(type, flowPos)}
            >
              <span>{def.icon}</span>
              <span>{def.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Right-click context menu (node) — delete/edit ────────────── */}
      {nodeCtxMenu && (
        <div
          className="inv-ctx-menu"
          style={{ left: nodeCtxPos.x, top: nodeCtxPos.y }}
          onContextMenu={e => e.preventDefault()}
        >
          <div className="inv-ctx-title">Node Actions</div>
          <button
            className="inv-ctx-item"
            onClick={() => {
              const node = nodes.find(n => n.id === nodeCtxMenu);
              if (node) {
                setEditingNode(node.id);
                setEditValue(node.data.value || "");
                setEditNotes(node.data.notes || "");
              }
              setNodeCtxMenu(null);
            }}
          >
            <span>✏️</span>
            <span>Edit Node</span>
          </button>
          <button
            className="inv-ctx-item inv-ctx-item--delete"
            onClick={() => deleteNode(nodeCtxMenu)}
          >
            <span>🗑️</span>
            <span>Delete Node</span>
          </button>
        </div>
      )}

      {/* ── Edge label picker ────────────────────────────────────────── */}
      {pendingEdge && (
        <div className="inv-edge-picker-backdrop" onClick={() => setPendingEdge(null)}>
          <div className="inv-edge-picker" onClick={e => e.stopPropagation()}>
            <div className="inv-edge-picker-title">Select Relationship Type</div>
            <div className="inv-edge-picker-grid">
              {EDGE_TYPES.map(rel => (
                <button
                  key={rel}
                  className="inv-edge-picker-btn"
                  onClick={() => confirmEdge(rel)}
                >
                  {rel.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <button className="inv-edge-picker-cancel" onClick={() => setPendingEdge(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Node editor modal ────────────────────────────────────────── */}
      {editingNode && (
        <div className="inv-node-editor-backdrop" onClick={saveNodeEdit}>
          <div className="inv-node-editor" onClick={e => e.stopPropagation()}>
            <div className="inv-node-editor-title">
              {NODE_TYPES[nodes.find(n => n.id === editingNode)?.data?.nodeType]?.icon}{" "}
              Edit {NODE_TYPES[nodes.find(n => n.id === editingNode)?.data?.nodeType]?.label}
            </div>
            <input
              className="inv-node-editor-input"
              placeholder="Value (e.g. john@example.com)"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveNodeEdit()}
              autoFocus
            />
            <textarea
              className="inv-node-editor-notes"
              placeholder="Notes (optional)"
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              rows={2}
            />
            <div className="inv-node-editor-actions">
              <button className="inv-node-editor-cancel" onClick={() => setEditingNode(null)}>Cancel</button>
              <button className="inv-node-editor-save" onClick={saveNodeEdit}>Save Node</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Completion modal ─────────────────────────────────────────── */}
      {completed && completionData && (
        <div className="inv-completion-backdrop">
          <div className="inv-completion-modal">
            <div className="inv-completion-icon">🔍</div>
            <div className="inv-completion-title">Investigation Complete</div>
            <div className="inv-completion-subtitle">All connections verified</div>
            <div className="inv-completion-elo">
              <span className="inv-completion-elo-label">Total ELO Earned</span>
              <span className="inv-completion-elo-value">+{completionData.totalElo || totalElo}</span>
            </div>
            {completionData.breakdown && (
              <div className="inv-completion-breakdown">
                <div className="inv-breakdown-row">
                  <span>Connections</span>
                  <span>+{completionData.breakdown.connections}</span>
                </div>
                <div className="inv-breakdown-row">
                  <span>Completion bonus</span>
                  <span>+{completionData.breakdown.bonus}</span>
                </div>
                {completionData.breakdown.timeBonus > 0 && (
                  <div className="inv-breakdown-row">
                    <span>Speed bonus</span>
                    <span>+{completionData.breakdown.timeBonus}</span>
                  </div>
                )}
              </div>
            )}
            <button
              className="inv-completion-btn"
              onClick={() => window.location.href = "/challenges"}
            >
              Back to Challenges
            </button>
          </div>
        </div>
      )}
    </div>
  );
}