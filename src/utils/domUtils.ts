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

/**
 * Safely removes all child nodes from an element
 * 
 * This function iterates through all child nodes and removes them safely,
 * preventing NotFoundError exceptions that can occur when nodes are
 * already detached or being manipulated by other code.
 * 
 * @param el - The element whose children should be removed
 * @returns The number of children successfully removed
 * 
 * @example
 * ```typescript
 * const container = document.getElementById('container');
 * const removedCount = safeClearChildren(container);
 * console.log(`Removed ${removedCount} children`);
 * ```
 */
export function safeClearChildren(el: Element | null | undefined): number {
  if (!el || !isElementAttached(el)) {
    return 0;
  }
  
  let removed = 0;
  try {
    // Create a snapshot of children since live collection changes during removal
    const children = Array.from(el.childNodes);
    for (const child of children) {
      try {
        if ('remove' in child && typeof (child as any).remove === 'function') {
          (child as any).remove();
        } else if (child.parentNode) {
          child.parentNode.removeChild(child);
        }
        removed++;
      } catch (e) {
        console.warn('[domUtils] Error removing child:', e);
      }
    }
  } catch (e) {
    console.warn('[domUtils] Error clearing children:', e);
  }
  return removed;
}

/**
 * Optional version of safeRemove that accepts possibly undefined nodes
 * 
 * @param node - The DOM node to remove (can be null or undefined)
 * @returns true if the node was removed, false otherwise
 */
export function optionalRemove(node?: Node | null): boolean {
  return safeRemove(node ?? null);
}
