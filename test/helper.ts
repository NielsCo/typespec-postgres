import fs from "fs";

export async function readAndNormalize(filePath: string) {
    const file = await fs.promises.readFile(filePath, "utf-8");
    return file.replace(/(?<!\r)\n/g, '\r\n');
}