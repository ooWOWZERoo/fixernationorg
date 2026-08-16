import { useCallback, useState, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
  type NodeMouseHandler,
} from "@xyflow/react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Step = {
  id: string; order: number; type: string;
  config: Record<string, unknown>;
  posX: number | null; posY: number | null;
};

export type Template = { id: string; name: string; subject: string };

interface JourneyCanvasProps {
  journeyId: string;
  trigger: string;
  triggerConfig: Record<string, string> | null;
  initialSteps: Step[];
  templates: Template[];
  onStepsChange?: (steps: Step[]) => void;
}

// ── Step type meta ────────────────────────────────────────────────────────────

const STEP_META: Record<string, { label: string; bg: string; border: string; text: string; badge: string }> = {
  WAIT:       { label: "Wait",         bg: "#fffbeb", border: "#fbbf24", text: "#92400e", badge: "bg-amber-50 text-amber-700" },
  SEND_EMAIL: { label: "Send email",   bg: "#eff6ff", border: "#60a5fa", text: "#1e40af", badge: "bg-blue-50 text-blue-700" },
  ADD_TAG:    { label: "Add tag",      bg: "#f0fdf4", border: "#4ade80", text: "#166534", badge: "bg-emerald-50 text-emerald-700" },
  REMOVE_TAG: { label: "Remove tag",   bg: "#fef2f2", border: "#f87171", text: "#991b1b", badge: "bg-red-50 text-red-700" },
  WEBHOOK:    { label: "Webhook",      bg: "#f5f3ff", border: "#a78bfa", text: "#4c1d95", badge: "bg-violet-50 text-violet-700" },
  SEND_PUSH:  { label: "Push notify",  bg: "#fdf4ff", border: "#d946ef", text: "#701a75", badge: "bg-fuchsia-50 text-fuchsia-700" },
  CONDITION:  { label: "Condition",    bg: "#fffbeb", border: "#f59e0b", text: "#78350f", badge: "bg-yellow-50 text-yellow-700" },
  EXIT:       { label: "Exit",         bg: "#f1f5f9", border: "#94a3b8", text: "#334155", badge: "bg-slate-100 text-slate-600" },
};

const TRIGGER_LABELS: Record<string, string> = {
  MANUAL: "Manual", SIGNUP: "User signup", ROLE_CHANGE: "Role change",
  TAG_ADDED: "Tag added", APPLICATION_ACCEPTED: "Application accepted",
};

// ── Helper: compute positions ─────────────────────────────────────────────────

const CANVAS_CX = 300;
const NODE_GAP  = 140;

function computePosition(step: Step, fallbackIdx: number): { x: number; y: number } {
  if (step.posX !== null && step.posY !== null) {
    return { x: step.posX, y: step.posY };
  }
  return { x: CANVAS_CX - 130, y: 120 + fallbackIdx * NODE_GAP };
}

// ── Custom node: Trigger ──────────────────────────────────────────────────────

type TriggerData = {
  trigger: string;
  triggerConfig: Record<string, string> | null;
};

function TriggerNode({ data }: NodeProps) {
  const d = data as unknown as TriggerData;
  return (
    <div style={{ width: 260 }} className="rounded-xl border-2 border-navy/30 bg-navy shadow p-3 text-white cursor-default select-none">
      <div className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-1">Trigger</div>
      <div className="text-sm font-bold">{TRIGGER_LABELS[d.trigger] ?? d.trigger}</div>
      {d.triggerConfig?.role && <div className="mt-0.5 text-xs text-white/60">Role → {d.triggerConfig.role}</div>}
      {d.triggerConfig?.tag  && <div className="mt-0.5 text-xs text-white/60">Tag: {d.triggerConfig.tag}</div>}
      <Handle type="source" position={Position.Bottom} className="!bg-white/40 !w-2 !h-2 !border-0" />
    </div>
  );
}

// ── Custom node: Step ─────────────────────────────────────────────────────────

type StepData = {
  step: Step;
  onSelect: (step: Step) => void;
};

function stepSummary(step: Step): string {
  const c = step.config;
  switch (step.type) {
    case "WAIT":       return `Wait ${c.days ?? 1} day${(c.days as number) !== 1 ? "s" : ""}`;
    case "SEND_EMAIL": return c.templateId ? "Email (template)" : String(c.subject || "(no subject)");
    case "ADD_TAG":    return `+tag: ${c.tag || "(no tag)"}`;
    case "REMOVE_TAG": return `-tag: ${c.tag || "(no tag)"}`;
    case "WEBHOOK":    return `${c.method ?? "POST"} ${String(c.url || "").slice(0, 30) || "(no url)"}`;
    case "SEND_PUSH":  return String(c.title || "(no title)");
    case "CONDITION":  return `If ${c.field ?? "??"} ${c.operator ?? "="} ${c.value ?? "??"}`;
    case "EXIT":       return "End journey";
    default:           return step.type;
  }
}

function StepNode({ data }: NodeProps) {
  const d = data as unknown as StepData;
  const meta = STEP_META[d.step.type] ?? STEP_META.WAIT;
  return (
    <div
      style={{ width: 260, borderColor: meta.border }}
      className="rounded-xl border-l-4 border border-slate-200 bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow select-none"
      onClick={() => d.onSelect(d.step)}
    >
      <Handle type="target" position={Position.Top}    className="!bg-slate-300 !w-2 !h-2 !border-0" />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.badge}`}>
            {meta.label}
          </span>
          <span className="text-xs text-slate-600 truncate">{stepSummary(d.step)}</span>
        </div>
        <div className="mt-1 text-[10px] text-slate-400 text-right">Step {d.step.order} · click to edit</div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="!bg-slate-300 !w-2 !h-2 !border-0"
      />
      {d.step.type === "CONDITION" && (
        <>
          <Handle type="source" position={Position.Right} id="true"
            style={{ top: "50%" }}
            className="!bg-green-400 !w-2.5 !h-2.5 !border-0" />
          <Handle type="source" position={Position.Left} id="false"
            style={{ top: "50%" }}
            className="!bg-red-400 !w-2.5 !h-2.5 !border-0" />
        </>
      )}
    </div>
  );
}

// ── Custom node: Exit ─────────────────────────────────────────────────────────

function ExitNode() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-300 bg-slate-100 text-slate-400 text-xs font-bold select-none cursor-default">
      End
      <Handle type="target" position={Position.Top} className="!bg-slate-300 !w-2 !h-2 !border-0" />
    </div>
  );
}

const nodeTypes = {
  triggerNode: TriggerNode,
  stepNode: StepNode,
  exitNode: ExitNode,
};

// ── Step config forms ─────────────────────────────────────────────────────────

function StepConfigForm({
  type, config, templates, onChange,
}: {
  type: string; config: Record<string, unknown>;
  templates: Template[];
  onChange: (c: Record<string, unknown>) => void;
}) {
  const input = (field: string, label: string, placeholder = "", inputType = "text") => (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input type={inputType} value={String(config[field] ?? "")}
        onChange={e => onChange({ ...config, [field]: e.target.value })}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
    </div>
  );

  if (type === "WAIT") {
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Days to wait</label>
        <input type="number" min={1} value={Number(config.days ?? 1)}
          onChange={e => onChange({ ...config, days: Math.max(1, parseInt(e.target.value) || 1) })}
          className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
      </div>
    );
  }
  if (type === "SEND_EMAIL") {
    const useTemplate = !!config.templateId;
    return (
      <div className="space-y-3">
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={!useTemplate}
              onChange={() => onChange({ subject: config.subject ?? "", htmlBody: config.htmlBody ?? "", textBody: config.textBody ?? "" })} />
            <span className="font-medium text-slate-700">Inline</span>
          </label>
          {templates.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={useTemplate} onChange={() => onChange({ templateId: templates[0].id })} />
              <span className="font-medium text-slate-700">Template</span>
            </label>
          )}
        </div>
        {useTemplate ? (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Template</label>
            <select value={String(config.templateId ?? "")}
              onChange={e => onChange({ ...config, templateId: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        ) : (
          <>
            {input("subject", "Subject *", "e.g. Welcome to Fixer Nation")}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">HTML body</label>
              <textarea rows={4} value={String(config.htmlBody ?? "")}
                onChange={e => onChange({ ...config, htmlBody: e.target.value })}
                placeholder="<p>Hi {{first_name}},</p>"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
            </div>
          </>
        )}
      </div>
    );
  }
  if (type === "ADD_TAG" || type === "REMOVE_TAG") {
    return input("tag", "Tag", "e.g. onboarded-provider");
  }
  if (type === "WEBHOOK") {
    return (
      <div className="space-y-3">
        {input("url", "URL *", "https://example.com/webhook")}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Method</label>
          <select value={String(config.method ?? "POST")} onChange={e => onChange({ ...config, method: e.target.value })}
            className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
            <option value="POST">POST</option>
            <option value="GET">GET</option>
          </select>
        </div>
      </div>
    );
  }
  if (type === "SEND_PUSH") {
    return (
      <div className="space-y-3">
        {input("title", "Title *", "New content just dropped")}
        {input("body", "Body", "Short description…")}
        {input("url", "Click URL", "https://fixernation.org/…")}
      </div>
    );
  }
  if (type === "CONDITION") {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Field</label>
          <select value={String(config.field ?? "userRole")} onChange={e => onChange({ ...config, field: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
            <option value="userRole">User role</option>
            <option value="tag">Has tag</option>
            <option value="daysSinceSignup">Days since signup</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Operator</label>
          <select value={String(config.operator ?? "equals")} onChange={e => onChange({ ...config, operator: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
            <option value="equals">equals</option>
            <option value="not_equals">not equals</option>
            <option value="greater_than">greater than</option>
            <option value="less_than">less than</option>
          </select>
        </div>
        {input("value", "Value", "e.g. MEMBER")}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">If false, skip to step #</label>
          <input type="number" min={1} value={Number(config.falseNextOrder ?? "")}
            onChange={e => onChange({ ...config, falseNextOrder: parseInt(e.target.value) || null })}
            placeholder="Leave blank to end journey"
            className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
          <p className="mt-1 text-xs text-slate-400">If blank, false path ends the enrollment.</p>
        </div>
      </div>
    );
  }
  if (type === "EXIT") {
    return <p className="text-sm text-slate-500">This step ends the journey enrollment immediately.</p>;
  }
  return null;
}

// ── Default configs ───────────────────────────────────────────────────────────

const DEFAULT_CONFIGS: Record<string, Record<string, unknown>> = {
  WAIT:       { days: 1 },
  SEND_EMAIL: { subject: "", htmlBody: "" },
  ADD_TAG:    { tag: "" },
  REMOVE_TAG: { tag: "" },
  WEBHOOK:    { url: "", method: "POST" },
  SEND_PUSH:  { title: "", body: "", url: "" },
  CONDITION:  { field: "userRole", operator: "equals", value: "", falseNextOrder: null },
  EXIT:       {},
};

// ── Main canvas (needs ReactFlowProvider wrapper) ─────────────────────────────

function CanvasInner({
  journeyId, trigger, triggerConfig, initialSteps, templates, onStepsChange,
}: JourneyCanvasProps) {
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [selectedStep, setSelectedStep] = useState<Step | null>(null);
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingType, setAddingType] = useState<string>("WAIT");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addingSaving, setAddingSaving] = useState(false);
  const posUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive RF nodes from steps
  const rfNodes: Node[] = useMemo(() => {
    const nodes: Node[] = [
      {
        id: "__trigger__",
        type: "triggerNode",
        position: { x: CANVAS_CX - 130, y: 30 },
        data: { trigger, triggerConfig } as unknown as Record<string, unknown>,
        draggable: false,
      },
    ];
    steps.forEach((step, idx) => {
      const pos = computePosition(step, idx);
      nodes.push({
        id: step.id,
        type: "stepNode",
        position: pos,
        data: {
          step,
          onSelect: (s: Step) => { setSelectedStep(s); setEditConfig({ ...s.config }); },
        } as unknown as Record<string, unknown>,
      });
    });
    return nodes;
  }, [steps, trigger, triggerConfig]);

  // Derive RF edges from steps
  const rfEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

    sortedSteps.forEach((step, idx) => {
      // Source: __trigger__ → first step
      if (idx === 0) {
        edges.push({
          id: `trigger-${step.id}`,
          source: "__trigger__", target: step.id,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
          style: { stroke: "#94a3b8" },
        });
      } else {
        const prev = sortedSteps[idx - 1];
        if (prev.type !== "CONDITION") {
          edges.push({
            id: `${prev.id}-${step.id}`,
            source: prev.id, target: step.id,
            markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
            style: { stroke: "#94a3b8" },
          });
        }
      }

      // CONDITION branching: add true/false edges
      if (step.type === "CONDITION") {
        const nextStep = sortedSteps[idx + 1];
        if (nextStep) {
          edges.push({
            id: `${step.id}-true`,
            source: step.id, sourceHandle: "true",
            target: nextStep.id,
            label: "Yes",
            labelStyle: { fill: "#166534", fontWeight: 700, fontSize: 11 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#4ade80" },
            style: { stroke: "#4ade80" },
          });
        }
        const falseOrder = (step.config.falseNextOrder as number | null) ?? null;
        if (falseOrder) {
          const falseTarget = steps.find(s => s.order === falseOrder);
          if (falseTarget) {
            edges.push({
              id: `${step.id}-false`,
              source: step.id, sourceHandle: "false",
              target: falseTarget.id,
              label: "No",
              labelStyle: { fill: "#991b1b", fontWeight: 700, fontSize: 11 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#f87171" },
              style: { stroke: "#f87171", strokeDasharray: "5 3" },
            });
          }
        }
      }
    });

    return edges;
  }, [steps]);

  const [nodes, , onNodesChange] = useNodesState(rfNodes);
  const [edges, , onEdgesChange] = useEdgesState(rfEdges);

  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id === "__trigger__") return;
    const { x, y } = node.position;
    // Debounce PATCH to avoid hammering the API
    if (posUpdateTimer.current) clearTimeout(posUpdateTimer.current);
    posUpdateTimer.current = setTimeout(() => {
      fetch("/api/admin/automations/step", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: node.id, posX: x, posY: y }),
      }).catch(() => {});
    }, 600);
  }, []);

  async function saveStep() {
    if (!selectedStep) return;
    setSaving(true);
    const res = await fetch("/api/admin/automations/step", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedStep.id, config: editConfig }),
    });
    if (res.ok) {
      const updated = await res.json();
      const next = steps.map(s => s.id === updated.id ? { ...s, config: updated.config } : s);
      setSteps(next);
      setSelectedStep(null);
      onStepsChange?.(next);
    }
    setSaving(false);
  }

  async function deleteStep() {
    if (!selectedStep || !confirm("Remove this step?")) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/automations/step?id=${selectedStep.id}`, { method: "DELETE" });
    if (res.ok) {
      const next = steps.filter(s => s.id !== selectedStep.id);
      setSteps(next);
      setSelectedStep(null);
      onStepsChange?.(next);
    }
    setDeleting(false);
  }

  async function addStep() {
    setAddingSaving(true);
    const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
    const lastStep = sortedSteps[sortedSteps.length - 1];
    const newPosY = lastStep
      ? (lastStep.posY ?? 120 + (steps.length - 1) * NODE_GAP) + NODE_GAP
      : 120;
    const res = await fetch("/api/admin/automations/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        journeyId,
        type: addingType,
        config: DEFAULT_CONFIGS[addingType] ?? {},
        posX: CANVAS_CX - 130,
        posY: newPosY,
      }),
    });
    if (res.ok) {
      const newStep: Step = await res.json();
      const next = [...steps, newStep];
      setSteps(next);
      setShowAddPanel(false);
      setAddingType("WAIT");
      onStepsChange?.(next);
    }
    setAddingSaving(false);
  }

  return (
    <div className="relative flex h-[620px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      {/* React Flow canvas */}
      <div className="flex-1 h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop as NodeMouseHandler}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e2e8f0" gap={20} />
          <Controls className="!bottom-4 !left-4 !top-auto" />
          <MiniMap nodeColor={(n) => {
            if (n.id === "__trigger__") return "#1e3a5f";
            const step = steps.find(s => s.id === n.id);
            return STEP_META[step?.type ?? ""]?.border ?? "#94a3b8";
          }} className="!bottom-4 !right-4 !top-auto !h-24 !w-36" />
        </ReactFlow>
      </div>

      {/* Add step button (floating, bottom-left above controls) */}
      <div className="absolute bottom-16 left-4 z-10">
        <button
          type="button"
          onClick={() => setShowAddPanel(v => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-navy px-3 py-2 text-xs font-bold text-white shadow-lg hover:bg-navy-dark transition-colors"
        >
          <span className="text-base leading-none">+</span>
          Add step
        </button>
      </div>

      {/* Add step panel */}
      {showAddPanel && (
        <div className="absolute bottom-28 left-4 z-20 w-56 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Step type</p>
          <select
            value={addingType}
            onChange={e => setAddingType(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          >
            {Object.entries(STEP_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={addStep} disabled={addingSaving}
              className="flex-1 rounded-lg bg-navy py-1.5 text-xs font-bold text-white hover:bg-navy-dark disabled:opacity-40">
              {addingSaving ? "Adding…" : "Add"}
            </button>
            <button type="button" onClick={() => setShowAddPanel(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Step editor side panel */}
      {selectedStep && (
        <div className="w-72 shrink-0 h-full overflow-y-auto border-l border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STEP_META[selectedStep.type]?.badge ?? "bg-slate-100 text-slate-600"}`}>
                {STEP_META[selectedStep.type]?.label ?? selectedStep.type}
              </span>
              <p className="mt-1 text-xs text-slate-400">Step {selectedStep.order}</p>
            </div>
            <button type="button" onClick={() => setSelectedStep(null)}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
          </div>

          <StepConfigForm
            type={selectedStep.type}
            config={editConfig}
            templates={templates}
            onChange={setEditConfig}
          />

          <div className="mt-5 flex flex-col gap-2">
            <button type="button" onClick={saveStep} disabled={saving}
              className="w-full rounded-lg bg-navy py-2 text-xs font-bold text-white hover:bg-navy-dark disabled:opacity-40">
              {saving ? "Saving…" : "Save step"}
            </button>
            <button type="button" onClick={() => setSelectedStep(null)}
              className="w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={deleteStep} disabled={deleting}
              className="w-full rounded-lg py-2 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-40">
              {deleting ? "Removing…" : "Remove step"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Public export: wraps in ReactFlowProvider ─────────────────────────────────

export function JourneyCanvas(props: JourneyCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
