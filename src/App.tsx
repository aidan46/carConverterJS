import React, { useState } from "react";
import FileUploader from "./components/FileUploader";
import DownloadButton from "./components/DownloadButton";

const App: React.FC = () => {
  const [carV1Url, setCarV1Url] = useState<string | null>(null);
  const [carV2Url, setCarV2Url] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      <h2>Upload a File to Convert to CAR</h2>
      <FileUploader
        onFilesProcessed={(carV1: string, carV2: string, originalFileName: string) => {
          setCarV1Url(carV1);
          setCarV2Url(carV2);
          setFileName(originalFileName);
        }}
      />

      {carV1Url && carV2Url && fileName && (
        <div style={{ marginTop: "10px" }}>
          <DownloadButton url={carV1Url} fileName={`${fileName}_v1.car`} label="Download CARv1" />
          <DownloadButton url={carV2Url} fileName={`${fileName}_v2.car`} label="Download CARv2" />
        </div>
      )}
    </div>
  );
};

export default App;
