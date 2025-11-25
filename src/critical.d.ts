declare module 'critical' {
  export function generate(options: {
    inline: boolean;
    base: string;
    src: string;
    target: {
      html: string;
    };
    width: number;
    height: number;
    extract: boolean;
    minify: boolean;
    penthouse?: {
      timeout: number;
    };
  }): Promise<void>;
}
