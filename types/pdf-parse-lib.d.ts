// pdf-parse ships its main entry point at /lib/pdf-parse.js. Importing the
// inner path (rather than the package root) is the standard workaround for
// pdf-parse's debug side effect that tries to read a test fixture at module
// load time. @types/pdf-parse only types the package root, so this declares
// the inner module and reuses the same signature.
declare module "pdf-parse/lib/pdf-parse.js" {
  import pdf from "pdf-parse";
  export = pdf;
}
