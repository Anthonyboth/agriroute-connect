/**
 * DOM Utilities for safe DOM manipulation
 *
 * Helps prevent removeChild and insertBefore errors in React apps and
 * generally avoid NotFoundError exceptions when manipulating nodes that
 * may already have been removed from the document.
 */

/**
 * Checks if a DOM node is still attached to the document
 * @param node - The DOM node to check
 * @returns true if the node is attached to the document, false otherwise
 */
export function isElementAttached(node: Node | null | undefined): boolean {
  if (!node) return false;

  // The global document is a Node; treat it as attached.
  if (node === document) return true;

  try {
    // document.contains handles Elements and other Node types.
    return document.contains(node);
  } catch (e) {
    // Defensive: if any error occurs, assume not attached.
    return false;
  }
}

/**
 * Safely removes a DOM node from its parent.
 * Checks if the node is attached before trying to remove it to avoid
 * NotFoundError exceptions (e.g. when React tries to remove a node
 * that's already been removed).
 *
 * @param node - The DOM node to remove
 * @returns true if the node was removed, false if it was already detached or null
 */
export function safeRemove(node: Node | null | undefined): boolean {
  if (!node) return false;

  if (!isElementAttached(node)) {
    // Node already detached or not in document
    return false;
  }

  try {
    // Prefer modern remove() when available
    const anyNode = node as any;
    if (typeof anyNode.remove === 'function') {
      anyNode.remove();
      return true;
    }

    // Fallback to parentNode.removeChild
    const parent = node.parentNode;
    if (parent) {
      parent.removeChild(node);
      return true;
    }

    return false;
  } catch (error) {
    // Do not throw - this is a safe helper.
    // Log to help debugging if unexpected errors occur.
    // eslint-disable-next-line no-console
    console.warn('[domUtils] safeRemove: error removing node', error);
    return false;
  }
}

/**
 * Safely clears all children from a container element.
 * If the container is not attached, the function is a no-op.
 *
 * @param container - The container element to clear
 */
export function safeClearChildren(container: HTMLElement | null | undefined): void {
  if (!container || !isElementAttached(container)) {
    return;
  }

  // Setting textContent to empty string is fast and safe across browsers.
  container.textContent = '';
}

/**
 * Safely appends a child to a parent node.
 * Verifies parent exists and is attached to the document.
 *
 * @param parent - The parent node
 * @param child - The child node to append
 * @returns true if append was successful, false otherwise
 */
export function safeAppendChild(
  parent: Node | null | undefined,
  child: Node | null | undefined
): boolean {
  if (!parent || !child) return false;

  if (!isElementAttached(parent)) {
    // Parent is not in document; avoid appending since it may be transient.
    // Caller can still append to detached nodes intentionally, but this helper
    // focuses on preventing DOM errors in mounted UI flows.
    // eslint-disable-next-line no-console
    console.warn('safeAppendChild: parent is not attached to the document, skipping append');
    return false;
  }

  try {
    parent.appendChild(child);
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('safeAppendChild: error appending child', error);
    return false;
  }
}