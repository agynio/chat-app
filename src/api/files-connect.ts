import { create, createFileRegistry } from '@bufbuild/protobuf';
import { FileDescriptorProtoSchema, FieldDescriptorProto_Label, FieldDescriptorProto_Type } from '@bufbuild/protobuf/wkt';

// Hand-written descriptor mirroring agynio/api/gateway/v1/files.proto.
// Update this descriptor whenever the proto schema changes.
const filesDescriptor = create(FileDescriptorProtoSchema, {
  name: 'agynio/api/gateway/v1/files.proto',
  package: 'agynio.api.gateway.v1',
  syntax: 'proto3',
  messageType: [
    {
      name: 'UploadFileMetadata',
      field: [
        {
          name: 'filename',
          number: 1,
          label: FieldDescriptorProto_Label.OPTIONAL,
          type: FieldDescriptorProto_Type.STRING,
          jsonName: 'filename',
        },
        {
          name: 'content_type',
          number: 2,
          label: FieldDescriptorProto_Label.OPTIONAL,
          type: FieldDescriptorProto_Type.STRING,
          jsonName: 'contentType',
        },
        {
          name: 'size_bytes',
          number: 3,
          label: FieldDescriptorProto_Label.OPTIONAL,
          type: FieldDescriptorProto_Type.INT64,
          jsonName: 'sizeBytes',
        },
      ],
    },
    {
      name: 'UploadFileChunk',
      field: [
        {
          name: 'data',
          number: 1,
          label: FieldDescriptorProto_Label.OPTIONAL,
          type: FieldDescriptorProto_Type.BYTES,
          jsonName: 'data',
        },
      ],
    },
    {
      name: 'UploadFileRequest',
      field: [
        {
          name: 'metadata',
          number: 1,
          label: FieldDescriptorProto_Label.OPTIONAL,
          type: FieldDescriptorProto_Type.MESSAGE,
          typeName: '.agynio.api.gateway.v1.UploadFileMetadata',
          oneofIndex: 0,
          jsonName: 'metadata',
        },
        {
          name: 'chunk',
          number: 2,
          label: FieldDescriptorProto_Label.OPTIONAL,
          type: FieldDescriptorProto_Type.MESSAGE,
          typeName: '.agynio.api.gateway.v1.UploadFileChunk',
          oneofIndex: 0,
          jsonName: 'chunk',
        },
      ],
      oneofDecl: [{ name: 'payload' }],
    },
    {
      name: 'FileInfo',
      field: [
        {
          name: 'id',
          number: 1,
          label: FieldDescriptorProto_Label.OPTIONAL,
          type: FieldDescriptorProto_Type.STRING,
          jsonName: 'id',
        },
        {
          name: 'filename',
          number: 2,
          label: FieldDescriptorProto_Label.OPTIONAL,
          type: FieldDescriptorProto_Type.STRING,
          jsonName: 'filename',
        },
        {
          name: 'content_type',
          number: 3,
          label: FieldDescriptorProto_Label.OPTIONAL,
          type: FieldDescriptorProto_Type.STRING,
          jsonName: 'contentType',
        },
        {
          name: 'size_bytes',
          number: 4,
          label: FieldDescriptorProto_Label.OPTIONAL,
          type: FieldDescriptorProto_Type.INT64,
          jsonName: 'sizeBytes',
        },
        {
          name: 'created_at',
          number: 5,
          label: FieldDescriptorProto_Label.OPTIONAL,
          type: FieldDescriptorProto_Type.STRING,
          jsonName: 'createdAt',
        },
      ],
    },
    {
      name: 'UploadFileResponse',
      field: [
        {
          name: 'file',
          number: 1,
          label: FieldDescriptorProto_Label.OPTIONAL,
          type: FieldDescriptorProto_Type.MESSAGE,
          typeName: '.agynio.api.gateway.v1.FileInfo',
          jsonName: 'file',
        },
      ],
    },
  ],
});

const registry = createFileRegistry(filesDescriptor, () => {
  throw new Error('Unexpected external dependency in files descriptor');
});

function requireMessage(typeName: string) {
  const message = registry.getMessage(typeName);
  if (!message) {
    throw new Error(`Missing message descriptor: ${typeName}`);
  }
  return message;
}

export const uploadFileRequestDesc = requireMessage('agynio.api.gateway.v1.UploadFileRequest');
export const uploadFileResponseDesc = requireMessage('agynio.api.gateway.v1.UploadFileResponse');

export type UploadFileMetadata = {
  filename: string;
  contentType: string;
  sizeBytes: string;
};

export type UploadFileChunk = {
  data: Uint8Array;
};

export type UploadFileRequest = {
  payload:
    | { case: 'metadata'; value: UploadFileMetadata }
    | { case: 'chunk'; value: UploadFileChunk };
};

export type FileInfo = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: string | bigint;
  createdAt: string;
};

export type UploadFileResponse = {
  file?: FileInfo;
};
