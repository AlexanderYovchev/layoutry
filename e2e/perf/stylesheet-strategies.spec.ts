import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { DocumentStyleCompiler } from "../../src/features/canvas/styling/documentStyleCompiler";
import {
  printStyleRule,
  ruleOrderKey,
} from "../../src/features/canvas/styling/printStyleRules";
import { perfDocument } from "../support/perfFixtures";

/*
 * BC-17.3 — measurement of the three candidate stylesheet update
 * strategies (BC-17.1.3 Report 1 §8.4). EXPERIMENTAL measurement code,
 * opt-in (LAYOUTRY_PERF=1); the production host implements only the
 * chosen strategy. Same compiled 1,000-element sheet and the same DOM in
 * every engine; every operation is timed through a forced style and
 * layout flush (getComputedStyle + offsetHeight), 30 samples each.
 *
 *   A  one <style> element whose text is rebuilt from cached per-node chunks
 *   B  CSSOM insertRule/deleteRule on one sheet, indexes from the buckets
 *   C  per-subtree <style> elements (50 nodes each), ordered bucket-major
 *      so the global cascade order holds
 */

test.skip(
  !process.env.LAYOUTRY_PERF,
  "opt-in performance measurement (LAYOUTRY_PERF=1)",
);

const OUT = path.join("test-results", "bc17-3-perf");

test("stylesheet update strategies at 1,000 elements", async ({
  page,
  browserName,
}) => {
  test.setTimeout(600_000);
  const fixture = perfDocument();
  const compiler = new DocumentStyleCompiler("design");
  compiler.update(fixture);
  const nodes = [...compiler.chunks().keys()]
    .sort()
    .map((id) => ({
      id,
      rules: (compiler.irOf(id)?.rules ?? []).map((rule) => ({
        key: ruleOrderKey(rule),
        text: printStyleRule(rule),
      })),
    }));
  const ruleCount = nodes.reduce((sum, node) => sum + node.rules.length, 0);

  await page.setContent(
    `<!doctype html><html><body><div id="host" style="position:relative;width:760px;height:2600px"></div></body></html>`,
  );
  const results = await page.evaluate(
    ({ nodes }) => {
      type Rule = { key: number; text: string };
      type NodeRules = { id: string; rules: Rule[] };
      const host = document.getElementById("host")!;
      const elements = new Map<string, HTMLElement>();
      for (const node of nodes) {
        if (node.id === "page-root" || node.id === "free") continue;
        const element = document.createElement(
          node.id.length % 3 === 0 ? "p" : "div",
        );
        element.className = `ly-n-${node.id}`;
        element.textContent = node.id;
        host.appendChild(element);
        elements.set(node.id, element);
      }
      const ids = [...elements.keys()];
      const flush = (element: HTMLElement) => {
        void getComputedStyle(element).backgroundColor;
        void document.body.offsetHeight;
      };
      const edited = (rules: Rule[], round: number): Rule[] =>
        rules.map((rule) => ({
          key: rule.key,
          text: rule.text.replace(
            /background-color: [^;]+;/,
            `background-color: #${(0x100000 + round * 997).toString(16).slice(-6)};`,
          ),
        }));

      interface Strategy {
        install(all: NodeRules[]): void;
        set(id: string, rules: Rule[] | null): void;
        dispose(): void;
      }

      function strategyA(): Strategy {
        const style = document.createElement("style");
        document.head.appendChild(style);
        const chunks = new Map<string, Rule[]>();
        const order: string[] = [];
        const render = () => {
          const keys = new Set<number>();
          for (const rules of chunks.values())
            for (const rule of rules) keys.add(rule.key);
          const parts: string[] = [];
          for (const key of [...keys].sort((a, b) => a - b))
            for (const id of order)
              for (const rule of chunks.get(id) ?? [])
                if (rule.key === key) parts.push(rule.text);
          style.textContent = parts.join("\n");
        };
        return {
          install(all) {
            for (const node of all) {
              chunks.set(node.id, node.rules);
              order.push(node.id);
            }
            render();
          },
          set(id, rules) {
            if (rules === null) chunks.delete(id);
            else {
              if (!chunks.has(id)) order.push(id);
              chunks.set(id, rules);
            }
            render();
          },
          dispose: () => style.remove(),
        };
      }

      function strategyB(): Strategy {
        const style = document.createElement("style");
        document.head.appendChild(style);
        const sheet = style.sheet!;
        // Per order key, the nodes in insertion order and how many rules each owns.
        const buckets = new Map<number, { id: string; count: number }[]>();
        const offset = (key: number) => {
          let index = 0;
          for (const [other, list] of buckets)
            if (other < key) for (const owner of list) index += owner.count;
          return index;
        };
        const remove = (id: string) => {
          for (const [key, list] of buckets) {
            let index = offset(key);
            for (let position = 0; position < list.length; position += 1) {
              const owner = list[position];
              if (owner.id === id) {
                for (let n = 0; n < owner.count; n += 1)
                  sheet.deleteRule(index);
                list.splice(position, 1);
                break;
              }
              index += owner.count;
            }
          }
        };
        const add = (id: string, rules: Rule[]) => {
          const byKey = new Map<number, Rule[]>();
          for (const rule of rules)
            byKey.set(rule.key, [...(byKey.get(rule.key) ?? []), rule]);
          for (const [key, list] of byKey) {
            if (!buckets.has(key)) buckets.set(key, []);
            const owners = buckets.get(key)!;
            let index =
              offset(key) + owners.reduce((sum, owner) => sum + owner.count, 0);
            for (const rule of list) sheet.insertRule(rule.text, index++);
            owners.push({ id, count: list.length });
          }
        };
        return {
          install(all) {
            for (const node of all) add(node.id, node.rules);
          },
          set(id, rules) {
            remove(id);
            if (rules) add(id, rules);
          },
          dispose: () => style.remove(),
        };
      }

      function strategyC(): Strategy {
        // One <style> per (bucket, group of 50 nodes), created in bucket-major order.
        const groupOf = new Map<string, number>();
        const groups = new Map<number, Map<string, Rule[]>>();
        const styles = new Map<string, HTMLStyleElement>();
        const keyOrder: number[] = [];
        const styleFor = (key: number, group: number) => {
          const name = `${key}:${group}`;
          let style = styles.get(name);
          if (!style) {
            style = document.createElement("style");
            // Insert after every style of a lower key or the same key and lower group.
            const after = [...styles.entries()].filter(([other]) => {
              const [k, g] = other.split(":").map(Number);
              return k < key || (k === key && g < group);
            });
            const anchor =
              after.length > 0
                ? after
                    .sort((a, b) => {
                      const [ka, ga] = a[0].split(":").map(Number);
                      const [kb, gb] = b[0].split(":").map(Number);
                      return ka - kb || ga - gb;
                    })
                    .at(-1)![1]
                : null;
            if (anchor) anchor.after(style as HTMLStyleElement);
            else document.head.appendChild(style);
            styles.set(name, style);
            if (!keyOrder.includes(key)) keyOrder.push(key);
          }
          return style;
        };
        const render = (group: number, keys: Set<number>) => {
          const members = groups.get(group)!;
          for (const key of keys) {
            const parts: string[] = [];
            for (const rules of members.values())
              for (const rule of rules)
                if (rule.key === key) parts.push(rule.text);
            styleFor(key, group).textContent = parts.join("\n");
          }
        };
        let next = 0;
        return {
          install(all) {
            for (const node of all) {
              const group = Math.floor(next++ / 50);
              groupOf.set(node.id, group);
              if (!groups.has(group)) groups.set(group, new Map());
              groups.get(group)!.set(node.id, node.rules);
            }
            for (const [group, members] of groups)
              render(
                group,
                new Set(
                  [...members.values()].flatMap((rules) =>
                    rules.map((rule) => rule.key),
                  ),
                ),
              );
          },
          set(id, rules) {
            let group = groupOf.get(id);
            if (group === undefined) {
              group = Math.floor(next++ / 50);
              groupOf.set(id, group);
              if (!groups.has(group)) groups.set(group, new Map());
            }
            const members = groups.get(group)!;
            const keys = new Set(
              [...(members.get(id) ?? []), ...(rules ?? [])].map(
                (rule) => rule.key,
              ),
            );
            if (rules === null) members.delete(id);
            else members.set(id, rules);
            render(group, keys);
          },
          dispose: () => styles.forEach((style) => style.remove()),
        };
      }

      const stats = (values: number[]) => {
        const sorted = [...values].sort((a, b) => a - b);
        return {
          median: sorted[Math.floor(sorted.length / 2)],
          p95: sorted[
            Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))
          ],
        };
      };
      const out: Record<string, Record<string, unknown>> = {};
      for (const [name, make] of [
        ["A", strategyA],
        ["B", strategyB],
        ["C", strategyC],
      ] as const) {
        const result: Record<string, unknown> = {};
        const installs: number[] = [];
        for (let run = 0; run < 5; run += 1) {
          const strategy = make();
          const start = performance.now();
          strategy.install(nodes);
          flush(elements.get(ids[0])!);
          installs.push(performance.now() - start);
          strategy.dispose();
        }
        result.initialInstall = stats(installs);
        const strategy = make();
        strategy.install(nodes);
        flush(elements.get(ids[0])!);
        const byId = new Map(nodes.map((node) => [node.id, node.rules]));
        const time = (
          label: string,
          operation: (round: number) => HTMLElement,
        ) => {
          const samples: number[] = [];
          for (let round = 0; round < 30; round += 1) {
            const start = performance.now();
            const element = operation(round);
            flush(element);
            samples.push(performance.now() - start);
          }
          result[label] = stats(samples);
        };
        time("singleEdit", (round) => {
          const id = ids[(round * 37) % ids.length];
          strategy.set(id, edited(byId.get(id)!, round));
          return elements.get(id)!;
        });
        time("tenNodeEdit", (round) => {
          let last = elements.get(ids[0])!;
          for (let n = 0; n < 10; n += 1) {
            const id = ids[(round * 53 + n * 97) % ids.length];
            strategy.set(id, edited(byId.get(id)!, round + n));
            last = elements.get(id)!;
          }
          return last;
        });
        time("insertion", (round) => {
          const id = `new-${round}`;
          const element = document.createElement("div");
          element.className = `ly-n-${id}`;
          host.appendChild(element);
          elements.set(id, element);
          strategy.set(
            id,
            byId
              .get(ids[round])!
              .map((rule) => ({
                key: rule.key,
                text: rule.text.replaceAll(`ly-n-${ids[round]}`, `ly-n-${id}`),
              })),
          );
          return element;
        });
        time("deletion", (round) => {
          const id = `new-${round}`;
          strategy.set(id, null);
          elements.get(id)!.remove();
          return host;
        });
        time("reparent", (round) => {
          const id = ids[(round * 31) % ids.length];
          const element = elements.get(id)!;
          host.prepend(element);
          strategy.set(id, byId.get(id)!);
          return element;
        });
        strategy.dispose();
        result.cleanupLeavesNoStyle =
          document.querySelectorAll("style").length === 0;
        out[name] = result;
      }
      return out;
    },
    { nodes },
  );
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, `strategies-${browserName}.json`),
    JSON.stringify(
      { browserName, nodes: nodes.length, rules: ruleCount, results },
      null,
      2,
    ),
  );
});
