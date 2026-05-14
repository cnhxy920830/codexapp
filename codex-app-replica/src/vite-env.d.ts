/// <reference types="vite/client" />

declare module "*.mjs?url" {
  const url: string;
  export default url;
}

declare module "*assets/workbook/*.js" {
  const workbookModule: any;
  export = workbookModule;
}
