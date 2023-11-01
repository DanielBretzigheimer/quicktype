import { promisify } from "util";
import { resolve, basename } from "path";
import fs from "fs";
import { quicktype, InputData, TypeScriptTargetLanguage, JSONSchemaInput, FetchingJSONSchemaStore } from "./src";

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

async function getFiles(dirOrFile: string): Promise<string[]> {
    // check if its file
    if (!(await stat(dirOrFile)).isDirectory()) return [dirOrFile];

    const subdirs = await readdir(dirOrFile);
    const files = await Promise.all(
        subdirs.map(async subdir => {
            const res = resolve(dirOrFile, subdir);
            return (await stat(res)).isDirectory() ? getFiles(res) : [res];
        })
    );
    return files.reduce((a, f) => a.concat(f), []);
}

async function generateTypes(basePath: string, resultFolder = "result", language: "ts" | "swift" = "ts") {
    const baseSchemaPath = `${basePath}\\schemas`;
    const allSchemas = await getFiles(`${baseSchemaPath}`);
    const targetSchemas = await getFiles(`${baseSchemaPath}`);

    function getTargetLanguage() {
        if (language === "ts") return new TypeScriptTargetLanguage();
        else if (language === "swift") return new TypeScriptTargetLanguage();
        else throw new Error(`Language ${language} is not supported.`);
    }

    // check if api directory exists and create it if not
    const resultPath = `${basePath}\\${resultFolder}`;
    if (!fs.existsSync(resultPath)) fs.mkdirSync(resultPath);

    let errors = new Array<unknown>();

    const schemaStore = new FetchingJSONSchemaStore();
    for (const file of targetSchemas) {
        if (file.includes("ignore")) continue;

        const typeName = basename(file, ".json");

        try {
            const schemaFileData = fs.readFileSync(file, "utf-8");
            const schemaInput = new JSONSchemaInput(schemaStore, undefined, allSchemas);
            schemaInput.addSourceSync({ name: typeName, schema: schemaFileData });

            const inputData = new InputData();
            inputData.addInput(schemaInput);

            const lang = getTargetLanguage();
            const result = await quicktype({
                inputData,
                lang,
                rendererOptions: {
                    "just-types": true,
                    "prefer-types": true,
                    "prefer-unions": false,
                    "prefer-const-values": true,
                    "generate-additional-property-access": false
                }
            });

            // write the result to a file
            const outputFilename = `${resultPath}\\${typeName}.${language}`;

            fs.writeFileSync(outputFilename, result.lines.join("\n"));

            console.info(`Generated types for ${typeName} and wrote them to ${outputFilename}`);
        } catch (e) {
            console.error(`Could not generate types for ${file}.`, e);
            errors.push(e);
        }
    }

    if (errors.length > 0) {
        console.error(`Failed to generate ${errors.length} types.`, errors);
    }
}

// generateTypes("F:\\Temp\\quicktype_samples");
generateTypes("C:\\Users\\dbret\\git\\json-schema-schemas", "api");
