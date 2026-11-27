import type { StyleSheetChange } from "@/features/canvas/styling/documentStyleCompiler";
import type { StyleSurface } from "@/features/canvas/styling/styleIr";

/*
 * BC-17.3 — StyleSheetHost: installs and updates one surface's generated
 * document stylesheet (BC-17.1.3 Report 1 §8.4). Strategy, chosen by
 * measurement (BC-17.3 Report 2): CSSOM insertRule/deleteRule on one
 * <style> element. Each node owns a contiguous run of rules inside each
 * order key (bucket × tier), sorted by node id; a rule's index is computed from the keys
 * below it, so the global cascade order never depends on edit order. Only
 * the order keys whose text changed are rewritten: editing a node's
 * geometry replaces its base rule, not its defaults or state rules.
 *
 * A rule the engine refuses (a vendor selector it doesn't know, such as
 * ::-moz-progress-bar in Chromium) throws on insertRule; it is counted as
 * rejected and simply not owned, exactly as a browser drops it from a
 * text stylesheet. The host never reads or writes the document model.
 */

interface Owner {
  id: string;
  /** The rule texts this node asked for under this key (what a later change is compared against). */
  texts: readonly string[];
  /** How many of them the engine accepted (the rules actually installed). */
  count: number;
}

function sameTexts(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((text, index) => text === b[index]);
}

export class StyleSheetHost {
  private readonly element: HTMLStyleElement;
  /** Order key → the nodes owning rules under it, in sheet order. */
  private readonly owners = new Map<number, Owner[]>();
  private readonly totals = new Map<number, number>();
  /** Node id → the keys it owns rules under. */
  private readonly keysById = new Map<string, Set<number>>();
  /** insertRule + deleteRule calls so far (instrumentation for tests and the performance report). */
  mutations = 0;
  /** Rules the engine refused (unknown vendor selectors). */
  rejected = 0;

  /** Whether the host created its element (and so removes it) or fills one it was given. */
  private readonly owned: boolean;

  /**
   * `target` is either a document — the host then appends its own <style> to
   * the head — or a <style> element someone else owns, which the host only
   * fills through the CSSOM. The Canvas passes a React-rendered element:
   * React keeps it in the page, whereas a node injected into <head> can be
   * dropped by the framework's own head reconciliation during hydration
   * (BC-17.3, seen in about 1 load in 4 of the production build).
   */
  constructor(
    target: Document | HTMLStyleElement,
    readonly surface: Exclude<StyleSurface, "export">,
    readonly scope: string,
  ) {
    this.owned = !(target instanceof HTMLStyleElement);
    if (target instanceof HTMLStyleElement) {
      this.element = target;
      // An adopted element may hold rules already: its server-rendered text, or a previous host (another surface). The host owns them from here.
      const sheet = this.sheet;
      while (sheet.cssRules.length > 0)
        sheet.deleteRule(sheet.cssRules.length - 1);
    } else {
      this.element = target.createElement("style");
      target.head.appendChild(this.element);
    }
    this.element.dataset.lyDocumentStyles = surface;
    this.element.dataset.lySheet = scope;
  }

  private get sheet(): CSSStyleSheet {
    const sheet = this.element.sheet;
    if (!sheet) throw new Error("The document stylesheet is not attached.");
    return sheet;
  }

  private offset(key: number): number {
    let index = 0;
    for (const [other, total] of this.totals) if (other < key) index += total;
    return index;
  }

  /** Replaces one node's rules under one key (texts empty = remove them). */
  private replace(key: number, id: string, texts: readonly string[]) {
    const list = this.owners.get(key) ?? [];
    // Owners stay sorted by node id inside a key — the order printChunks
    // uses — so the installed sheet is always exactly the printed sheet.
    let index = this.offset(key);
    let position = 0;
    while (position < list.length && list[position].id < id) {
      index += list[position].count;
      position += 1;
    }
    const existing = list[position]?.id === id ? list[position] : undefined;
    if (existing && sameTexts(existing.texts, texts)) return;
    let total = this.totals.get(key) ?? 0;
    if (existing) {
      for (let n = 0; n < existing.count; n += 1) {
        this.sheet.deleteRule(index);
        this.mutations += 1;
      }
      total -= existing.count;
      list.splice(position, 1);
    }
    if (texts.length > 0) {
      let count = 0;
      for (const text of texts) {
        try {
          this.sheet.insertRule(text, index + count);
          this.mutations += 1;
          count += 1;
        } catch {
          this.rejected += 1;
        }
      }
      list.splice(position, 0, { id, texts, count });
      total += count;
    }
    const keys = this.keysById.get(id) ?? new Set<number>();
    if (texts.length > 0) keys.add(key);
    else keys.delete(key);
    if (keys.size > 0) this.keysById.set(id, keys);
    else this.keysById.delete(id);
    if (list.length > 0) this.owners.set(key, list);
    else this.owners.delete(key);
    if (total > 0) this.totals.set(key, total);
    else this.totals.delete(key);
  }

  /** Applies a compiler change set: each changed node's rules are replaced key by key, removed nodes' rules deleted. */
  apply(change: StyleSheetChange) {
    for (const [id, chunks] of change.changed) {
      const keys = new Set([
        ...(this.keysById.get(id) ?? []),
        ...(chunks ? chunks.keys() : []),
      ]);
      for (const key of [...keys].sort((a, b) => a - b))
        this.replace(key, id, chunks?.get(key) ?? []);
    }
  }

  /** The number of rules currently installed. */
  get ruleCount(): number {
    return this.sheet.cssRules.length;
  }

  /** Removes every rule; an element the host created is removed too (an adopted one belongs to its owner). */
  dispose() {
    if (this.owned) {
      this.element.remove();
      return;
    }
    const sheet = this.element.sheet;
    if (sheet)
      while (sheet.cssRules.length > 0)
        sheet.deleteRule(sheet.cssRules.length - 1);
  }
}
