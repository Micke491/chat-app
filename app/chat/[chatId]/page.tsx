"use client";

import { use } from "react";
import ChatPageContent from "@/components/chat/ChatPageContent";

interface PageProps {
  params: Promise<{ chatId: string }>;
}

export default function ChatIdPage({ params }: PageProps) {
  const { chatId } = use(params);
  return <ChatPageContent chatId={chatId} />;
}
