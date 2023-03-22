# cookie-cutter

pdfs suck to edit. the purpose of this project is to automate filling the same
pdf repeatedly.

this project uses [pdf-lib](https://www.npmjs.com/package/pdf-lib) which
supports AcroForms. the PDF I built this project for looks much better when
static text is placed instead though. will update eventually to support the
AcroForms

the best way to run this as of now is: `deno run -A --watch index.ts`
