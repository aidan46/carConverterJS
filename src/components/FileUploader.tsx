import React from 'react';
import { generateCarV1 } from '../utils/carGenerator';

interface FileUploaderProps {
    onFileProcessed: (blob: Blob, fileName: string) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileProcessed }) => {
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        console.log("File upload triggered");
        const file = event.target.files?.[0];
        if (!file) {
            console.log("No file selected");
            return;
        }

        console.log("File selected:", file.name);
        const newFileName = file.name.replace(/\.[^/.]+$/, '') + '.car';

        const reader = new FileReader();
        reader.onload = async (e) => {
            console.log("FileReader onload triggered");
            if (e.target?.result) {
                console.log("File read successfully");
                const content = new Uint8Array(e.target.result as ArrayBuffer);
                console.log("Content length:", content.length);
                const blob = await generateCarV1(content);
                console.log("Created blob");
                onFileProcessed(blob, newFileName);
            }
        };

        reader.onerror = (err) => console.error("FileReader error:", err);
        reader.readAsArrayBuffer(file);
    };

    return <input type="file" onChange={handleFileUpload} />;
};

export default FileUploader;
