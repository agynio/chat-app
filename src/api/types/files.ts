export type FileRecord = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

export type FileMetadata = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: string | number;
  createdAt: string;
};

export type GetFileMetadataRequest = { fileId: string };
export type GetFileMetadataResponse = { file?: FileMetadata };
