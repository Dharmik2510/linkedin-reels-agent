import { useEffect, useMemo, useRef, useState } from "react";
import { RegenerateError, regenerateScript } from "../api";
import { useStore } from "../state/store";
import type { Script } from "../types";
import {
  copyText,
  formatInstagramPack,
  formatTeleprompter,
} from "../utils/scriptExport";
import {
  fieldsEqual,
  pickEditable,
  type ScriptEditableFields,
} from "../utils/scriptFields";
import styles from "./ScriptModal.module.css";

type CopyKind = "instagram" | "teleprompter" | null;

export default function ScriptModal() {
  const { state, dispatch } = useStore();
  const view = useMemo(
    () => ({
      scripts: state.scripts,
      activeScriptId: state.activeScriptId,
      tone: state.tone,
      stage: state.stage,
      regeneratingPostIndex: state.regeneratingPostIndex,
    }),
    [
      state.scripts,
      state.activeScriptId,
      state.tone,
      state.stage,
      state.regeneratingPostIndex,
    ],
  );
  const [copied, setCopied] = useState<CopyKind>(null);
  const [draft, setDraft] = useState<ScriptEditableFields | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);

  const script = view.activeScriptId
    ? view.scripts.find((s) => s.id === view.activeScriptId) ?? null
    : null;
  const open = script !== null;

  const pipelineBusy =
    view.stage === "scraping" || view.stage === "generating";
  const isRegenerating =
    script !== null && view.regeneratingPostIndex === script.postIndex;

  const close = () => {
    setCopied(null);
    setRegenError(null);
    dispatch({ type: "SET_ACTIVE_SCRIPT", id: null });
  };

  useEffect(() => {
    if (script) setDraft(pickEditable(script));
  }, [script?.id]);

  const wasRegenerating = useRef(false);
  useEffect(() => {
    if (wasRegenerating.current && !isRegenerating && script) {
      setDraft(pickEditable(script));
      setRegenError(null);
    }
    wasRegenerating.current = isRegenerating;
  }, [isRegenerating, script]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (!open || !script || !draft) return null;

  const index = view.scripts.findIndex((s) => s.id === script.id);
  const idxLabel = String(index + 1).padStart(2, "0");
  const dirty = !fieldsEqual(draft, pickEditable(script));

  const onCopy = async (kind: CopyKind) => {
    if (!kind) return;
    const merged = { ...script, ...draft };
    const text =
      kind === "instagram"
        ? formatInstagramPack(merged)
        : formatTeleprompter(merged);
    const ok = await copyText(text);
    if (ok) setCopied(kind);
  };

  const onSave = () => {
    dispatch({ type: "UPDATE_SCRIPT", id: script.id, fields: draft });
  };

  const onRevert = () => setDraft(pickEditable(script));

  const onRegenerate = async () => {
    if (pipelineBusy || isRegenerating) return;
    if (dirty && !window.confirm("Discard unsaved edits and regenerate this script?")) {
      return;
    }
    setRegenError(null);
    dispatch({ type: "REGENERATE_START", postIndex: script.postIndex });
    try {
      await regenerateScript(script.postIndex, view.tone);
    } catch (err) {
      dispatch({ type: "REGENERATE_END", postIndex: script.postIndex });
      const msg =
        err instanceof RegenerateError
          ? err.message
          : "Could not start regenerate";
      setRegenError(msg);
    }
  };

  const setField = <K extends keyof ScriptEditableFields>(
    key: K,
    value: ScriptEditableFields[K],
  ) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const displayScript: Script = { ...script, ...draft };

  return (
    <div className={styles.backdrop} onClick={close} role="presentation">
      <div
        className={`${styles.dialog} ${isRegenerating ? styles.dialogBusy : ""}`}
        role="dialog"
        aria-modal="true"
        aria-busy={isRegenerating}
        aria-label={`Script ${idxLabel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.close}
          aria-label="Close"
          onClick={close}
        >
          ×
        </button>

        {isRegenerating && (
          <div className={styles.regenOverlay} aria-hidden>
            <span className={styles.regenSpinner} />
            Regenerating…
          </div>
        )}

        <div className={styles.head}>
          <span className={styles.idx}>{idxLabel}</span>
          <div className={styles.headText}>
            <div className={styles.title}>{displayScript.title}</div>
            <div className={styles.meta}>
              <span className={styles.dur}>{displayScript.dur}s</span>
              <span>· {displayScript.sceneCount} scenes</span>
              <span>· {displayScript.author}</span>
              {script.edited && <span className={styles.editedBadge}>edited</span>}
            </div>
          </div>
        </div>

        <div className={styles.editBar}>
          <button
            type="button"
            className={styles.editBtn}
            disabled={!dirty || isRegenerating}
            onClick={onSave}
          >
            Save edits
          </button>
          <button
            type="button"
            className={styles.editBtnSecondary}
            disabled={!dirty || isRegenerating}
            onClick={onRevert}
          >
            Revert
          </button>
          <button
            type="button"
            className={styles.regenBtn}
            disabled={pipelineBusy || isRegenerating}
            title={
              pipelineBusy
                ? "Wait for the pipeline to finish"
                : "Regenerate from the saved LinkedIn post (no re-scrape)"
            }
            onClick={onRegenerate}
          >
            {isRegenerating ? (
              <>
                <span className={styles.regenSpinnerSm} />
                Regenerating…
              </>
            ) : (
              "Regenerate"
            )}
          </button>
        </div>

        {regenError && (
          <p className={styles.regenError} role="alert">
            {regenError}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.actionBtn} ${copied === "instagram" ? styles.actionOk : ""}`}
            disabled={isRegenerating}
            onClick={() => onCopy("instagram")}
          >
            {copied === "instagram" ? "Copied pack" : "Copy for Instagram"}
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${copied === "teleprompter" ? styles.actionOk : ""}`}
            disabled={isRegenerating}
            onClick={() => onCopy("teleprompter")}
          >
            {copied === "teleprompter" ? "Copied script" : "Copy teleprompter"}
          </button>
          {script.postUrl ? (
            <a
              className={styles.sourceLink}
              href={script.postUrl}
              target="_blank"
              rel="noreferrer"
            >
              Source post ↗
            </a>
          ) : null}
        </div>

        <div className={styles.body}>
          <label className={styles.field}>
            <span className={styles.sectionLabel}>// hook</span>
            <textarea
              className={styles.textarea}
              rows={2}
              value={draft.hookRaw}
              disabled={isRegenerating}
              onChange={(e) => setField("hookRaw", e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.sectionLabel}>// full script</span>
            <textarea
              className={`${styles.textarea} ${styles.textareaTall}`}
              rows={10}
              value={draft.body}
              disabled={isRegenerating}
              onChange={(e) => setField("body", e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.sectionLabel}>// caption</span>
            <textarea
              className={styles.textarea}
              rows={3}
              value={draft.caption}
              disabled={isRegenerating}
              onChange={(e) => setField("caption", e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.sectionLabel}>// cta</span>
            <textarea
              className={styles.textarea}
              rows={2}
              value={draft.cta}
              disabled={isRegenerating}
              onChange={(e) => setField("cta", e.target.value)}
            />
          </label>

          {displayScript.tags.length > 0 && (
            <>
              <div className={styles.sectionLabel}>// tags</div>
              <div className={styles.tags}>
                {displayScript.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
