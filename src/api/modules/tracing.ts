import { connectPost } from '@/api/connect';
import type { ListSpansResponseWire } from '@/api/types/tracing';
import { extractRunIdFromListSpans } from './tracing-core';

const TRACING_SERVICE = '/api/agynio.api.gateway.v1.TracingGateway';

type ListSpansRequestWire = {
  organizationId: string;
  filter: { messageId: string };
  pageSize: number;
  pageToken: string;
  orderBy: 'LIST_SPANS_ORDER_BY_START_TIME_DESC';
};

export const tracingApi = {
  findRunIdByMessageId: async (organizationId: string, messageId: string): Promise<string | null> => {
    const resp = await connectPost<ListSpansRequestWire, ListSpansResponseWire>(TRACING_SERVICE, 'ListSpans', {
      organizationId,
      filter: { messageId },
      pageSize: 1,
      pageToken: '',
      orderBy: 'LIST_SPANS_ORDER_BY_START_TIME_DESC',
    });
    return extractRunIdFromListSpans(resp);
  },
};
