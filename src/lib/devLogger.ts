/**
 * Dev-only logger utility.
 * All console.log calls in production are no-ops.
 * console.error and console.warn are always active.
 */

const isDev = import.meta.env.DEV;

export const devLog = (...args: unknown[]): void => {
  if (isDev) {
    console.log(...args);
  }
};

export const devWarn = (...args: unknown[]): void => {
  if (isDev) {
    console.warn(...args);
  }
};
