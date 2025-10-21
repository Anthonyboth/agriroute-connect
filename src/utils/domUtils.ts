/**
 * DOM Utilities for safe DOM manipulation
 * 
 * These utilities help prevent common DOM errors that occur when trying to
 * manipulate nodes that have already been removed from the DOM tree.
 */

/**
 * Checks if a DOM element is currently attached to the document
 * 
 * @param node - The DOM node to check
 * @returns true if the node is attached to the document, false otherwise
 */
export function isElementAttached(node: Node | null | undefined): boolean {
  if (!node) {
    return false;
  }

  // Check if the node is the document itself
  if (node === document) {
    return true;
  }

  // Use contains() method to check if node is in the document
  // This works for both elements and other node types
  return document.contains(node);
}

/**
 * Safely removes a DOM node from its parent
 * 
 * This function checks if the node is still attached to the DOM before
 * attempting to remove it, preventing NotFoundError exceptions that can
 * occur when React or other code tries to remove already-removed nodes.
 * 
 * @param node - The DOM node to remove
 * @returns true if the node was removed, false if it was already detached or null
 * 
 * @example
 * ```typescript
 * // In a useEffect cleanup function
 * useEffect(() => {
 *   const element = document.createElement('div');
 *   document.body.appendChild(element);
 *   
 *   return () => {
 *     safeRemove(element); // Safe even if already removed
 *   };
 * }, []);
 * ```
 */
export function safeRemove(node: Node | null | undefined): boolean {
  if (!node) {
    return false;
  }

  // Check if node is still attached to the DOM
  if (!isElementAttached(node)) {
    return false;
  }

  try {
    // First try the modern remove() method if available
    if ('remove' in node && typeof node.remove === 'function') {
      node.remove();
      return true;
    }

    // Fallback to parentNode.removeChild for older environments
    const parent = node.parentNode;
    if (parent) {
      parent.removeChild(node);
      return true;
    }

    return false;
  } catch (error) {
    // Log the error but don't throw - this is a safety function
    console.warn('[domUtils] Error removing node:', error);
    return false;
  }
}
