import { useState } from 'react';
import FileUploader from './components/FileUploader';
import DownloadButton from './components/DownloadButton';

const App: React.FC = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  return (
    <div style={{ textAlign: 'center', marginTop: '20px' }}>
      <h2>Upload a File to Convert to CAR</h2>
      <FileUploader
        onFileProcessed={(blob, newFileName) => {
          const url = URL.createObjectURL(blob);
          setDownloadUrl(url);
          setFileName(newFileName);
        }}
      />
      {downloadUrl && fileName && (
        <DownloadButton url={downloadUrl} fileName={fileName} onDownloadComplete={() => {
          setDownloadUrl(null);
          setFileName(null);
        }} />
      )}
    </div>
  );
};

export default App;
