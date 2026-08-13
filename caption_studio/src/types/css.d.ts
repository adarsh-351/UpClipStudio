declare module "*.css" {
  const content: Record<string, string> & { default: string };
  export default content;
  export const glass: string;
  export const glassPanel: string;
  export const btnPrimary: string;
  export const btnSecondary: string;
  export const inputField: string;
}
