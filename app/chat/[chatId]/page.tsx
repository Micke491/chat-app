"use client";

import { use } from "react";
import ChatPageContent from "@/components/ui/ChatPageContent";

interface PageProps {
  params: Promise<{ chatId: string }>;
}

export default function ChatIdPage({ params }: PageProps) {
  const { chatId } = use(params);
  return <ChatPageContent chatId={chatId} />;
}
