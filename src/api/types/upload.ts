export type UploadProgressEvent = {
  loaded: number;
  total: number;
  progress?: number;
};

export type UploadProgressHandler = (event: UploadProgressEvent) => void;
