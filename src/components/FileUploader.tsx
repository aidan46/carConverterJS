import React, { useState } from "react";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { createCarV1Header, writeCarV1Blocks, createCarV2File } from "../utils/carGenerator";

const FileUploader: React.FC<{ onFilesProcessed: (carV1Url: string, carV2Url: string, fileName: string) => void }> = ({ onFilesProcessed }) => {
    const [fileName, setFileName] = useState<string | null>(null);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            console.error("No file selected.");
            return;
        }

        const newFileName = file.name.replace(/\.[^/.]+$/, "");

        const reader = new FileReader();
        reader.onload = async (e) => {
            if (!e.target?.result) {
                console.error("Failed to read file.");
                return;
            }

            const content = new Uint8Array(e.target.result as ArrayBuffer);
            console.log("File content read successfully.", { length: content.length });

            // Compute CID for the file
            const hash = await sha256.digest(content);
            const realCid = CID.create(1, 0x55, hash); // 0x55 is the raw codec
            console.log("Computed CID:", realCid.toString());

            // ✅ **Generate CARv1 Header**
            const carV1Header = createCarV1Header([realCid]);

            // ✅ **Generate CARv1 Blocks**
            const carV1Blocks = writeCarV1Blocks([{ cid: realCid, data: content }]);

            // ✅ **Combine CARv1 Header + Blocks**
            const carV1Bytes = new Uint8Array(carV1Header.length + carV1Blocks.length);
            carV1Bytes.set(carV1Header, 0);
            carV1Bytes.set(carV1Blocks, carV1Header.length);

            // ✅ **Generate CARv2 using the real CID**
            const carV2Bytes = createCarV2File(carV1Header, carV1Blocks, [{ cid: realCid, data: content }]);

            // ✅ **Convert to Blob for download**
            const carV1Blob = new Blob([carV1Bytes], { type: "application/octet-stream" });
            const carV2Blob = new Blob([carV2Bytes], { type: "application/octet-stream" });

            // ✅ **Create download URLs**
            const carV1Url = URL.createObjectURL(carV1Blob);
            const carV2Url = URL.createObjectURL(carV2Blob);

            // ✅ **Pass the generated URLs to parent component**
            onFilesProcessed(carV1Url, carV2Url, newFileName);
            setFileName(newFileName);
        };

        reader.readAsArrayBuffer(file);
    };

    return (
        <div>
            <input type="file" onChange={handleFileUpload} />
            {fileName && <p>File uploaded: {fileName}</p>}
        </div>
    );
};

export default FileUploader;
