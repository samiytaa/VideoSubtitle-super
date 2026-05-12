export function buildPromptFromMessages(messages) {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content ?? ""}`)
    .join("\n\n");
}
