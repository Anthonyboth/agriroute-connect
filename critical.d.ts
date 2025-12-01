declare module 'critical' {
  interface CriticalOptions {
    inline?: boolean;
    base?: string;
    src?: string;
    target?: {
      html?: string;
    };
    width?: number;
    height?: number;
    extract?: boolean;
    minify?: boolean;
    penthouse?: {
      timeout?: number;
    };
  }

  export function generate(options: CriticalOptions): Promise<void>;
}
