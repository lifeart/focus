/**
 * DOM helper utilities for creating and manipulating elements.
 */

/** Create an element with optional attributes and children. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number | boolean | EventListenerOrEventListenerObject> | null,
  children?: (Node | string)[],
): HTMLElementTagNameMap[K];
export function el(
  tag: string,
  attrs?: Record<string, string | number | boolean | EventListenerOrEventListenerObject> | null,
  children?: (Node | string)[],
): HTMLElement;
export function el(
  tag: string,
  attrs?: Record<string, string | number | boolean | EventListenerOrEventListenerObject> | null,
  children?: (Node | string)[],
): HTMLElement {
  const element = document.createElement(tag);

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('on') && typeof value === 'function') {
        element.addEventListener(key.slice(2).toLowerCase(), value as EventListenerOrEventListenerObject);
      } else if (key === 'className') {
        element.className = String(value);
      } else if (typeof value === 'boolean') {
        if (value) element.setAttribute(key, '');
      } else {
        element.setAttribute(key, String(value));
      }
    }
  }

  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    }
  }

  return element;
}

/** Create a text node. */
export function text(content: string): Text {
  return document.createTextNode(content);
}

/** addEventListener shorthand. Returns a removal function. */
export function on(
  element: EventTarget,
  event: string,
  handler: EventListenerOrEventListenerObject,
  options?: AddEventListenerOptions,
): () => void {
  element.addEventListener(event, handler, options);
  return () => element.removeEventListener(event, handler, options);
}

/** querySelector shorthand. */
export function $(selector: string, parent: ParentNode = document): Element | null {
  return parent.querySelector(selector);
}

/** querySelectorAll shorthand. */
export function $$(selector: string, parent: ParentNode = document): NodeListOf<Element> {
  return parent.querySelectorAll(selector);
}

/** Remove all children from an element. */
export function clear(element: HTMLElement): void {
  element.innerHTML = '';
}

/** Show an element (set display to ''). */
export function show(element: HTMLElement, display = ''): void {
  element.style.display = display;
}

/** Hide an element (set display to 'none'). */
export function hide(element: HTMLElement): void {
  element.style.display = 'none';
}

/** Add a CSS class to an element. */
export function addClass(element: HTMLElement, ...classNames: string[]): void {
  element.classList.add(...classNames);
}

/** Remove a CSS class from an element. */
export function removeClass(element: HTMLElement, ...classNames: string[]): void {
  element.classList.remove(...classNames);
}

/** Toggle a CSS class on an element. */
export function toggleClass(element: HTMLElement, className: string, force?: boolean): void {
  element.classList.toggle(className, force);
}
