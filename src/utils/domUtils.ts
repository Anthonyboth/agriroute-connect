/**
 * DOM Utilities for safe DOM manipulation
 * Helps prevent removeChild and insertBefore errors in React apps
 */

/**
 * Checks if a DOM node is still attached to the document
 * @param node - The DOM node to check
 * @returns true if the node is attached to the document, false otherwise
 */
export function isElementAttached(node: Node | null | undefined): boolean {
  if (!node) return false;
  return document.contains(node);
}

/**
 * Safely removes a DOM node from its parent
 * Checks if the node is still attached before attempting removal
 * @param node - The DOM node to remove
 * @returns true if removal was successful, false if node was already detached
 */
export function safeRemove(node: Node | null | undefined): boolean {
  if (!node) return false;
  
  // Check if node is still attached to the document
  if (!isElementAttached(node)) {
    console.warn('safeRemove: Node is already detached from DOM, skipping removal');
    return false;
  }
  
  // Check if node has a parent
  if (!node.parentNode) {
    console.warn('safeRemove: Node has no parent, skipping removal');
    return false;
  }
  
  try {
    node.parentNode.removeChild(node);
    return true;
  } catch (error) {
    console.error('safeRemove: Error removing node', error);
    return false;
  }
}

/**
 * Safely clears all children from a container element
 * @param container - The container element to clear
 */
export function safeClearChildren(container: HTMLElement | null | undefined): void {
  if (!container || !isElementAttached(container)) {
    return;
  }
  
  // Using textContent = '' is safer than removing children individually
  container.textContent = '';
}

/**
 * Safely appends a child to a parent node
 * Checks if both nodes are valid and parent is attached
 * @param parent - The parent node
 * @param child - The child node to append
 * @returns true if append was successful
 */
export function safeAppendChild(
  parent: Node | null | undefined,
  child: Node | null | undefined
): boolean {
  if (!parent || !child) return false;
  
  if (!isElementAttached(parent)) {
    console.warn('safeAppendChild: Parent is not attached to DOM');
    return false;
  }
  
  try {
    parent.appendChild(child);
    return true;
  } catch (error) {
    console.error('safeAppendChild: Error appending child', error);
    return false;
  }
}
