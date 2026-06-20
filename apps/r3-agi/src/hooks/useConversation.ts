import { useAGI } from "../store/useAGI";

export function useConversation() {
  const { chatMessages, addChatMessage, clearChat } = useAGI((s) => ({
    chatMessages: s.chatMessages,
    addChatMessage: s.addChatMessage,
    clearChat: s.clearChat,
  }));

  return {
    messages: chatMessages,
    addMessage: addChatMessage,
    clearMessages: clearChat,
  };
}
