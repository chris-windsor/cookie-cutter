import { load as loadEnv } from "https://deno.land/std/dotenv/mod.ts";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib";

const NO_FIELD_VALUE = 'no field value specified';

type PositionMap = Map<string, number[]>;
type ValueMap = Map<string, string>;

type SettingsMap = {
    input: string,
    output: string,
    positions: PositionMap,
    values: ValueMap
}

async function buildDataMaps() {
    const configData = await loadEnv();

    const positions = await Deno.readTextFile(configData['positions'] || './positions');    
    const positionsCollected = positions
        .split("\n")
        .map(line => {
            const [key, x, y] = line.split(",");
            return [key, [parseInt(x), parseInt(y)]];
        });
    const positionsMap: PositionMap = new Map((positionsCollected as Iterable<readonly [string, number[]]>));
    
    const values = await Deno.readTextFile(configData['values'] || './values');
    const valuesCollected = values
        .split("\n")
        .map(line => line.split(",")) ;    
    const valuesMap: ValueMap = new Map((valuesCollected as Iterable<readonly [string, string]>));

    return {
        input: configData['input'],
        output: configData['output'],
        positions: positionsMap,
        values: valuesMap,
    }
}

async function modifyPdf(settings: SettingsMap) {
    const existingPdfBytes = await Deno.readFile(settings.input);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const {height} = firstPage.getSize();
    
    for (const field of settings.positions.entries()) {
        const [fieldName, [x, y]] = field;
        
        firstPage.drawText((settings.values.get(fieldName) || NO_FIELD_VALUE), {
            x,
            y: height - y,
            size: 12,
            font: helveticaFont,
            color: rgb(0.95, 0.1, 0.1),
        });
    }

    const pdfBytes = await pdfDoc.save();
    await Deno.writeFile(settings.output, pdfBytes, { mode: 0o644 });
}

async function main() {
    const SETTINGS = Object.freeze(await buildDataMaps());

    modifyPdf(SETTINGS);
}

main();