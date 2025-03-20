import React from 'react';

interface DownloadButtonProps {
    url: string;
    fileName: string;
    onDownloadComplete: () => void;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ url, fileName, onDownloadComplete }) => {
    const handleDownload = () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onDownloadComplete();
    };

    return (
        <button onClick={handleDownload} style={{ marginTop: '10px', padding: '10px 20px', cursor: 'pointer' }}>
            Download {fileName}
        </button>
    );
};

export default DownloadButton;
