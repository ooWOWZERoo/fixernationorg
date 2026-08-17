import { useState, useEffect } from "react";
import type { AudienceDefinition, AudienceRule } from "@/lib/audience";

interface ListOption  { id: string; name: string }
interface FieldOption { id: string; label: string; type: string }
interface GroupOption { id: string; name: string }
interface EventOption { id: string; title: string }

interface Props {
  value: AudienceDefinition;
  onChange: (d: AudienceDefinition) => void;
  lists: ListOption[];
}

interface PreviewResult {
  totalIncluded: number;
  totalSuppressed: number;
  suppressionBreakdown: { reason: string; count: number }[];
  sample: Array<{ id: string; email: string; firstName: string | null }>;
}

const ROLES = ["MEMBER", "CONSUMER", "PROVIDER", "AMBASSADOR", "ADMIN", "SUPER_ADMIN"];
const TOPICS = ["CAMPAIGNS", "NEWSLETTERS", "MORNING_BOOST", "PRODUCT_UPDATES"];
const CF_OPS: { value: string; label: string }[] = [
  { value: "set",      label: "is set (any value)" },
  { value: "not_set",  label: "is not set" },
  { value: "eq",       label: "equals" },
  { value: "ne",       label: "does not equal" },
  { value: "contains", label: "contains" },
];

function ruleDisplay(rule: AudienceRule, lists: ListOption[], fields: FieldOption[], groups: GroupOption[], events: EventOption[]): { badge: string; label: string } {
  switch (rule.type) {
    case "list":
      return { badge: "List", label: rule.label ?? lists.find((l) => l.id === rule.listId)?.name ?? rule.listId };
    case "role":
      return { badge: "Role", label: rule.role };
    case "tag":
      return { badge: "Tag", label: rule.tag };
    case "consent_topic":
      return { badge: "Consent", label: rule.topic };
    case "group":
      return { badge: "Group", label: rule.label ?? groups.find((g) => g.id === rule.groupId)?.name ?? rule.groupId };
    case "event_rsvp":
      return { badge: "Event RSVP", label: rule.label ?? events.find((e) => e.id === rule.eventId)?.title ?? rule.eventId };
    case "custom_field": {
      const fieldLabel = rule.fieldLabel ?? fields.find(f => f.id === rule.fieldId)?.label ?? rule.fieldId;
      const opLabel = CF_OPS.find(o => o.value === rule.op)?.label ?? rule.op;
      return {
        badge: "Custom field",
        label: rule.value ? `${fieldLabel} ${opLabel} "${rule.value}"` : `${fieldLabel} ${opLabel}`,
      };
    }
  }
}

type RuleType = AudienceRule["type"];

interface AddRuleFormProps {
  lists: ListOption[];
  fields: FieldOption[];
  groups: GroupOption[];
  events: EventOption[];
  onAdd: (rule: AudienceRule) => void;
  onCancel: () => void;
}

function AddRuleForm({ lists, fields, groups, events, onAdd, onCancel }: AddRuleFormProps) {
  const [ruleType, setRuleType] = useState<RuleType>("list");
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [role, setRole] = useState("MEMBER");
  const [tag, setTag] = useState("");
  const [topic, setTopic] = useState("CAMPAIGNS");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [cfFieldId, setCfFieldId] = useState(fields[0]?.id ?? "");
  const [cfOp, setCfOp] = useState<string>("set");
  const [cfValue, setCfValue] = useState("");

  useEffect(() => {
    if (!cfFieldId && fields[0]) setCfFieldId(fields[0].id);
  }, [fields, cfFieldId]);
  useEffect(() => {
    if (!groupId && groups[0]) setGroupId(groups[0].id);
  }, [groups, groupId]);
  useEffect(() => {
    if (!eventId && events[0]) setEventId(events[0].id);
  }, [events, eventId]);

  function handleAdd() {
    let rule: AudienceRule | null = null;
    switch (ruleType) {
      case "list":
        if (!listId) return;
        rule = { type: "list", listId, label: lists.find((l) => l.id === listId)?.name };
        break;
      case "role":
        rule = { type: "role", role };
        break;
      case "tag":
        if (!tag.trim()) return;
        rule = { type: "tag", tag: tag.trim() };
        break;
      case "consent_topic":
        rule = { type: "consent_topic", topic };
        break;
      case "group":
        if (!groupId) return;
        rule = { type: "group", groupId, label: groups.find((g) => g.id === groupId)?.name };
        break;
      case "event_rsvp":
        if (!eventId) return;
        rule = { type: "event_rsvp", eventId, label: events.find((e) => e.id === eventId)?.title };
        break;
      case "custom_field":
        if (!cfFieldId) return;
        rule = {
          type: "custom_field",
          fieldId: cfFieldId,
          fieldLabel: fields.find(f => f.id === cfFieldId)?.label,
          op: cfOp as never,
          ...(cfOp !== "set" && cfOp !== "not_set" && cfValue.trim() ? { value: cfValue.trim() } : {}),
        };
        break;
    }
    if (rule) onAdd(rule);
  }

  const valueRequired = ruleType === "custom_field" && cfOp !== "set" && cfOp !== "not_set";

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl border border-navy/15 bg-slate-50 p-3">
      <div>
        <label className="mb-1 block text-xs font-semibold text-ink-soft">Type</label>
        <select
          value={ruleType}
          onChange={(e) => setRuleType(e.target.value as RuleType)}
          className="rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
        >
          <option value="list">On a list</option>
          <option value="role">Has role</option>
          <option value="tag">Has tag</option>
          <option value="consent_topic">Subscribed to topic</option>
          {groups.length > 0 && <option value="group">In a group</option>}
          {events.length > 0 && <option value="event_rsvp">RSVPd to event</option>}
          {fields.length > 0 && <option value="custom_field">Custom field</option>}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-ink-soft">Value</label>
        {ruleType === "list" && (
          <select
            value={listId}
            onChange={(e) => setListId(e.target.value)}
            className="rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            {lists.length === 0 && <option value="">— no lists —</option>}
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}
        {ruleType === "role" && (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {ruleType === "tag" && (
          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="e.g. member-onboarded"
            className="rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
          />
        )}
        {ruleType === "consent_topic" && (
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {ruleType === "group" && (
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        {ruleType === "event_rsvp" && (
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        )}
        {ruleType === "custom_field" && (
          <div className="flex flex-wrap gap-2">
            <select
              value={cfFieldId}
              onChange={(e) => setCfFieldId(e.target.value)}
              className="rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            >
              {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <select
              value={cfOp}
              onChange={(e) => setCfOp(e.target.value)}
              className="rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            >
              {CF_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {valueRequired && (
              <input
                type="text"
                value={cfValue}
                onChange={(e) => setCfValue(e.target.value)}
                placeholder="Value…"
                className="rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={
            (ruleType === "list" && !listId) ||
            (ruleType === "tag" && !tag.trim()) ||
            (ruleType === "group" && !groupId) ||
            (ruleType === "event_rsvp" && !eventId) ||
            (ruleType === "custom_field" && (!cfFieldId || (valueRequired && !cfValue.trim())))
          }
          className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-40"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-navy/15 px-3 py-1.5 text-sm text-ink-soft hover:bg-cream-panel"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function AudienceBuilder({ value, onChange, lists }: Props) {
  const [showAddInclude, setShowAddInclude] = useState(false);
  const [showAddExclude, setShowAddExclude] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);

  useEffect(() => {
    fetch("/api/admin/custom-fields?activeOnly=1")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setFields(data.map((f: { id: string; label: string; type: string }) => ({
            id: f.id, label: f.label, type: f.type,
          })));
        }
      })
      .catch(() => {});
    fetch("/api/admin/groups")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.groups)) {
          setGroups(data.groups.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
        }
      })
      .catch(() => {});
    fetch("/api/admin/events")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEvents(data.map((e: { id: string; title: string }) => ({ id: e.id, title: e.title })));
        }
      })
      .catch(() => {});
  }, []);

  function addInclude(rule: AudienceRule) {
    onChange({ ...value, include: [...value.include, rule] });
    setShowAddInclude(false);
    setPreview(null);
  }

  function addExclude(rule: AudienceRule) {
    onChange({ ...value, exclude: [...value.exclude, rule] });
    setShowAddExclude(false);
    setPreview(null);
  }

  function removeInclude(idx: number) {
    onChange({ ...value, include: value.include.filter((_, i) => i !== idx) });
    setPreview(null);
  }

  function removeExclude(idx: number) {
    onChange({ ...value, exclude: value.exclude.filter((_, i) => i !== idx) });
    setPreview(null);
  }

  function setLogic(logic: "OR" | "AND") {
    onChange({ ...value, logic });
    setPreview(null);
  }

  async function handlePreview() {
    setPreviewing(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/admin/campaigns/preview-audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Include rules */}
      <div className="rounded-xl border border-navy/8 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-navy">
            Include contacts who match
            <div className="flex overflow-hidden rounded-lg border border-navy/15 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLogic("OR")}
                className={`px-2.5 py-1 ${value.logic === "OR" ? "bg-navy text-white" : "text-ink-soft hover:bg-cream-panel"}`}
              >
                ANY
              </button>
              <button
                type="button"
                onClick={() => setLogic("AND")}
                className={`px-2.5 py-1 ${value.logic === "AND" ? "bg-navy text-white" : "text-ink-soft hover:bg-cream-panel"}`}
              >
                ALL
              </button>
            </div>
            of these rules:
          </div>
        </div>

        {value.include.length === 0 && (
          <p className="mb-2 text-sm text-ink-soft">No include rules — add one to define your audience.</p>
        )}

        <div className="space-y-1.5">
          {value.include.map((rule, idx) => {
            const { badge, label } = ruleDisplay(rule, lists, fields, groups, events);
            return (
              <div key={idx} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span className="shrink-0 rounded bg-navy/8 px-1.5 py-0.5 text-xs font-semibold text-navy">{badge}</span>
                <span className="flex-1 text-sm text-ink">{label}</span>
                <button
                  type="button"
                  onClick={() => removeInclude(idx)}
                  className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-50"
                  title="Remove rule"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {showAddInclude ? (
          <AddRuleForm
            lists={lists}
            fields={fields}
            groups={groups}
            events={events}
            onAdd={addInclude}
            onCancel={() => setShowAddInclude(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowAddInclude(true)}
            className="mt-2 rounded-lg border border-dashed border-navy/20 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-slate-50"
          >
            + Add include rule
          </button>
        )}
      </div>

      {/* Exclude rules */}
      <div className="rounded-xl border border-navy/8 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-navy">
          Exclude contacts who match any of these rules:
        </p>

        {value.exclude.length === 0 && (
          <p className="mb-2 text-sm text-ink-soft">No exclusions — contacts from include rules will all be eligible.</p>
        )}

        <div className="space-y-1.5">
          {value.exclude.map((rule, idx) => {
            const { badge, label } = ruleDisplay(rule, lists, fields, groups, events);
            return (
              <div key={idx} className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2">
                <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">{badge}</span>
                <span className="flex-1 text-sm text-ink">{label}</span>
                <button
                  type="button"
                  onClick={() => removeExclude(idx)}
                  className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-50"
                  title="Remove rule"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {showAddExclude ? (
          <AddRuleForm
            lists={lists}
            fields={fields}
            groups={groups}
            events={events}
            onAdd={addExclude}
            onCancel={() => setShowAddExclude(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowAddExclude(true)}
            className="mt-2 rounded-lg border border-dashed border-red-200 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-50"
          >
            + Add exclude rule
          </button>
        )}
      </div>

      {/* Preview */}
      <div>
        <button
          type="button"
          onClick={handlePreview}
          disabled={previewing || value.include.length === 0}
          className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-semibold text-navy hover:bg-cream-panel disabled:opacity-40"
        >
          {previewing ? "Checking…" : "Preview audience"}
        </button>
        {value.include.length === 0 && (
          <span className="ml-3 text-xs text-ink-soft">Add at least one include rule to preview.</span>
        )}

        {previewError && (
          <p className="mt-2 text-sm text-red-600">{previewError}</p>
        )}

        {preview && (
          <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm">
            <p className="font-semibold text-green-800">
              {preview.totalIncluded.toLocaleString()} contact{preview.totalIncluded !== 1 ? "s" : ""} will receive this email
            </p>
            {preview.totalSuppressed > 0 && (
              <ul className="mt-1 space-y-0.5 text-green-700">
                {preview.suppressionBreakdown.map(({ reason, count }) => (
                  <li key={reason} className="text-xs">
                    {count} suppressed — {reason.replace("_", " ")}
                  </li>
                ))}
              </ul>
            )}
            {preview.sample.length > 0 && (
              <p className="mt-2 text-xs text-green-700">
                Sample:{" "}
                {preview.sample
                  .map((c) => c.firstName ? `${c.firstName} (${c.email})` : c.email)
                  .join(", ")}
                {preview.totalIncluded > preview.sample.length && ` +${preview.totalIncluded - preview.sample.length} more`}
              </p>
            )}
            {preview.totalIncluded === 0 && (
              <p className="mt-1 text-xs text-amber-700">No contacts match these rules yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
