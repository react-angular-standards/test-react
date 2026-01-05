/** @format */

import { useCallback } from 'react';

interface DynamicChannelRequest {
  commandId: string;
  tabIdLength: number;
  finalChannelCount: number;
  channelList: number[];
  tabUniqueId: string;
  userName: string;
}

export const useDataStreamRequester = () => {
  const formatAndSendReq = useCallback((ws: WebSocket, request: DynamicChannelRequest) => {
    const message = JSON.stringify(request);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    } else {
      console.warn('WebSocket is not open. Cannot send request.');
    }
  }, []);

  return { formatAndSendReq };
};
