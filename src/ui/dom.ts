type Child = Node | string | null | undefined | false;

/** Minimal element builder. `html` sets innerHTML (only ever used with our own SVG strings). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { class?: string; html?: string; text?: string; attrs?: Record<string, string>; on?: Record<string, (e: Event) => void> } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.html !== undefined) node.innerHTML = props.html;
  if (props.text !== undefined) node.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {})) node.setAttribute(k, v);
  for (const [k, fn] of Object.entries(props.on ?? {})) node.addEventListener(k, fn);
  for (const c of children) if (c) node.append(c);
  return node;
}

export const button = (label: string, onClick: () => void, cls = "btn"): HTMLButtonElement =>
  el("button", { class: cls, text: label, attrs: { type: "button" }, on: { click: onClick } });

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
