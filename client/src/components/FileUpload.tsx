interface FileUploadProps {
  onFileSelect: (file: File) => void;
  loading: boolean;
  progress: number;
}

export function FileUpload({ onFileSelect, loading, progress }: FileUploadProps) {
  return (
    <label className={`upload-zone ${loading ? 'upload-zone--loading' : ''}`}>
      <input
        type="file"
        accept="application/pdf,.pdf"
        disabled={loading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = '';
        }}
      />
      <span className="upload-icon" aria-hidden>
        📄
      </span>
      <span className="upload-title">
        {loading ? 'Extrayendo texto del PDF…' : 'Toca para cargar un PDF'}
      </span>
      <span className="upload-hint">El archivo se procesa en tu dispositivo</span>
      {loading && (
        <div className="progress-bar" role="progressbar" aria-valuenow={progress}>
          <span className="progress-bar__fill" style={{ width: `${progress}%` }} />
        </div>
      )}
    </label>
  );
}
