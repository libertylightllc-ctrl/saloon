/**
 * The part of @vercel/og (0.11.1) that api/booking-card.ts uses, so type checks pass where the package is not installed
 * (this folder's node_modules is shared with another checkout). TypeScript uses this even where it is installed, so
 * keep it in step with the package when either changes.
 */
declare module '@vercel/og' {
  export class ImageResponse extends Response {
    constructor(
      element: unknown,
      options?: {
        width?: number;
        height?: number;
        fonts?: { name: string; data: ArrayBuffer | Buffer; weight?: 400 | 500 | 600 | 700; style?: 'normal' | 'italic' }[];
        headers?: Record<string, string>;
      },
    );
  }
}
