export type FileRecord = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

export type FileMetadataWire = {
  id?: string;
  filename?: string;
  contentType?: string;
  sizeBytes?: string | number | bigint;
  createdAt?: string;
};

export type GetFileMetadataRequest = { fileId: string };
export type GetFileMetadataResponse = { file?: FileMetadataWire };
