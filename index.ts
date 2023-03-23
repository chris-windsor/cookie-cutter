import { load as loadEnv } from "https://deno.land/std/dotenv/mod.ts";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib";

const NO_FIELD_VALUE = "no field value specified";
const FILL_COLOR = rgb(0.2, 0.1, 0.5); // Blue
// const FILL_COLOR = rgb(0.95, 0.1, 0.1); // Red

type TextMap = Map<string, number[]>;
type RadioMap = Map<string, number[][]>;
type CheckboxMap = Map<string, number[]>;
type MultiSelectMap = Map<string, number[][]>;
type ValueMap = Map<string, string>;

type SettingsMap = {
  input: string;
  output: string;
  textMap: TextMap;
  radioMap: RadioMap;
  checkboxMap: CheckboxMap;
  multiSelectMap: MultiSelectMap;
  values: ValueMap;
};

function filterDataLines(line: string) {
  const trimmedLine = line.trim();
  return trimmedLine.length && !trimmedLine.startsWith("#");
}

async function buildDataMaps() {
  const configData = await loadEnv();

  const positions = await Deno.readTextFile(
    configData["positions"] || "./positions",
  );
  const textFields: TextMap = new Map([]);
  const radioFields: RadioMap = new Map([]);
  const checkboxFields: CheckboxMap = new Map([]);
  const multiSelectFields: MultiSelectMap = new Map([]);
  for (const [lineIdx, rawLine] of positions.split("\n").entries()) {
    const line = rawLine.trim();
    if (!line.length || line.startsWith("#")) {
      continue;
    }

    const [type, key, page, x, y, size] = line.split(",");

    if (type === "t") {
      textFields.set(key, [
        parseInt(page),
        parseFloat(x),
        parseFloat(y),
        parseInt(size),
      ]);
    } else if (type === "r") {
      const currentRadioField = radioFields.get(key) || [];
      radioFields.set(
        key,
        currentRadioField.concat([[
          parseInt(page),
          parseFloat(x),
          parseFloat(y),
          parseInt(size),
        ]]),
      );
    } else if (type === "c") {
      checkboxFields.set(key, [
        parseInt(page),
        parseFloat(x),
        parseFloat(y),
        parseInt(size),
      ]);
    } else if (type === "m") {
      const currentMultiSelectField = multiSelectFields.get(key) || [];
      multiSelectFields.set(
        key,
        currentMultiSelectField.concat([[
          parseInt(page),
          parseFloat(x),
          parseFloat(y),
          parseInt(size),
        ]]),
      );
    } else {
      console.error(
        `Encounted unknown field type: '${type}' at line ${lineIdx + 1}`,
      );
    }
  }

  const values = await Deno.readTextFile(configData["values"] || "./values");
  const valuesCollected = values
    .split("\n")
    .filter(filterDataLines)
    .map((line) => line.split(","));
  const valuesMap: ValueMap = new Map(
    valuesCollected as Iterable<readonly [string, string]>,
  );

  return {
    input: configData["input"],
    output: configData["output"],
    textMap: textFields,
    radioMap: radioFields,
    checkboxMap: checkboxFields,
    multiSelectMap: multiSelectFields,
    values: valuesMap,
  };
}

async function modifyPdf(settings: SettingsMap) {
  const existingPdfBytes = await Deno.readFile(settings.input);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();

  for (const field of settings.textMap.entries()) {
    const [fieldName, [pageIndexAbsolute, x, y, size]] = field;

    const page = pages[pageIndexAbsolute - 1];
    const { height } = page.getSize();

    const textToDraw = settings.values.get(fieldName) || NO_FIELD_VALUE;

    page.drawText(textToDraw, {
      x,
      y: height - y,
      size: size || 9,
      font: helveticaFont,
      color: FILL_COLOR,
    });
  }

  for (const field of settings.radioMap.entries()) {
    const [fieldName, radioPositions] = field;
    const selectedIndex = settings.values.get(fieldName);

    if (!selectedIndex) {
      continue;
    }

    const [pageIndexAbsolute, x, y, size] =
      radioPositions[parseInt(selectedIndex)];

    const page = pages[pageIndexAbsolute - 1];
    const { height } = page.getSize();

    page.drawSquare({
      x,
      y: height - y,
      size: size || 10,
      color: FILL_COLOR,
    });
  }

  for (const field of settings.checkboxMap.entries()) {
    const [fieldName, [pageIndexAbsolute, x, y, size]] = field;

    const page = pages[pageIndexAbsolute - 1];
    const { height } = page.getSize();

    const shouldFill = settings.values.get(fieldName) == "1";
    if (!shouldFill) continue;

    page.drawSquare({
      x,
      y: height - y,
      size: size || 10,
      color: FILL_COLOR,
    });
  }

  for (const field of settings.multiSelectMap.entries()) {
    const [fieldName, selectPositions] = field;
    const selectedOptions = settings.values.get(fieldName);

    if (!selectedOptions) {
      continue;
    }

    for (const option of selectedOptions.split(";")) {
      if (!option || !option.length) continue;
      const [pageIndexAbsolute, x, y, size] = selectPositions[parseInt(option)];

      const page = pages[pageIndexAbsolute - 1];
      const { height } = page.getSize();

      page.drawSquare({
        x,
        y: height - y,
        size: size || 10,
        color: FILL_COLOR,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  await Deno.writeFile(settings.output, pdfBytes, { mode: 0o644 });
}

async function buildAndModify() {
  const SETTINGS = Object.freeze(await buildDataMaps());
  modifyPdf(SETTINGS);
}

async function main() {
  buildAndModify();
  const propertiesWatcher = Deno.watchFs(["./positions", "./values"]);
  for await (const _event of propertiesWatcher) {
    buildAndModify();
  }
}

main();
