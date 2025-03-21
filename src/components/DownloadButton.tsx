import React from "react";

interface DownloadButtonProps {
    url: string;
    fileName: string;
    label: string;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ url, fileName, label }) => {
    const handleDownload = () => {
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <button onClick={handleDownload} style={{ margin: "10px", padding: "10px 20px", cursor: "pointer" }}>
            {label}
        </button>
    );
};

export default DownloadButton;
